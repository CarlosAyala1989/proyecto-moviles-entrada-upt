import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class VisorEscanerQr extends StatefulWidget {
  const VisorEscanerQr({required this.alDetectar, super.key});

  final ValueChanged<String> alDetectar;

  @override
  State<VisorEscanerQr> createState() => _EstadoVisorEscanerQr();
}

class _EstadoVisorEscanerQr extends State<VisorEscanerQr>
    with WidgetsBindingObserver {
  late final MobileScannerController _controlador;
  bool _capturaProcesada = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controlador = MobileScannerController(
      autoStart: false,
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      formats: const [BarcodeFormat.qrCode],
      returnImage: false,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _iniciar());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_controlador.value.hasCameraPermission) return;
    switch (state) {
      case AppLifecycleState.resumed:
        unawaited(_iniciar());
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        unawaited(_detener());
    }
  }

  Future<void> _iniciar() async {
    if (!mounted ||
        _controlador.value.isRunning ||
        _controlador.value.isStarting) {
      return;
    }
    try {
      await _controlador.start();
    } on MobileScannerException {
      // El error queda disponible para errorBuilder en el visor.
    }
  }

  Future<void> _detener() async {
    if (!_controlador.value.isRunning) return;
    try {
      await _controlador.stop();
    } on MobileScannerException {
      // El visor puede desmontarse mientras se libera la cámara.
    }
  }

  void _procesarCaptura(BarcodeCapture captura) {
    if (_capturaProcesada) return;
    for (final codigo in captura.barcodes) {
      final valor = codigo.rawValue;
      if (codigo.format == BarcodeFormat.qrCode &&
          valor != null &&
          valor.isNotEmpty) {
        _capturaProcesada = true;
        unawaited(_detener());
        widget.alDetectar(valor);
        return;
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_controlador.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(
          controller: _controlador,
          onDetect: _procesarCaptura,
          errorBuilder: (context, error) =>
              _ErrorCamara(error: error, alReintentar: _iniciar),
          placeholderBuilder: (_) => const ColoredBox(
            color: Colors.black,
            child: Center(
              child: CircularProgressIndicator(color: Colors.white),
            ),
          ),
          tapToFocus: true,
        ),
        IgnorePointer(
          child: Center(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final lado = (constraints.maxWidth * 0.7).clamp(210.0, 300.0);
                return Container(
                  width: lado,
                  height: lado,
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.white, width: 3),
                    borderRadius: BorderRadius.circular(24),
                  ),
                );
              },
            ),
          ),
        ),
        Align(
          alignment: Alignment.bottomCenter,
          child: SafeArea(
            minimum: const EdgeInsets.all(16),
            child: ValueListenableBuilder<MobileScannerState>(
              valueListenable: _controlador,
              builder: (context, estado, _) => Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _ControlCamara(
                    etiqueta: estado.torchState == TorchState.on
                        ? 'Apagar linterna'
                        : 'Encender linterna',
                    icono: estado.torchState == TorchState.on
                        ? Icons.flash_on
                        : Icons.flash_off,
                    alPresionar: estado.torchState == TorchState.unavailable
                        ? null
                        : _controlador.toggleTorch,
                  ),
                  const SizedBox(width: 16),
                  _ControlCamara(
                    etiqueta: 'Cambiar cámara',
                    icono: Icons.cameraswitch_outlined,
                    alPresionar: (estado.availableCameras ?? 0) < 2
                        ? null
                        : _controlador.switchCamera,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ControlCamara extends StatelessWidget {
  const _ControlCamara({
    required this.etiqueta,
    required this.icono,
    required this.alPresionar,
  });

  final String etiqueta;
  final IconData icono;
  final VoidCallback? alPresionar;

  @override
  Widget build(BuildContext context) {
    return IconButton.filledTonal(
      tooltip: etiqueta,
      onPressed: alPresionar,
      icon: Icon(icono),
      style: IconButton.styleFrom(
        backgroundColor: Colors.white.withValues(alpha: 0.9),
        foregroundColor: Colors.black,
        disabledBackgroundColor: Colors.white.withValues(alpha: 0.45),
      ),
    );
  }
}

class _ErrorCamara extends StatelessWidget {
  const _ErrorCamara({required this.error, required this.alReintentar});

  final MobileScannerException error;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    final permisoDenegado =
        error.errorCode == MobileScannerErrorCode.permissionDenied;
    return ColoredBox(
      color: Theme.of(context).colorScheme.surface,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.no_photography_outlined,
                size: 64,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(height: 16),
              Text(
                permisoDenegado
                    ? 'Se necesita permiso de cámara. Si lo bloqueaste, habilítalo en los ajustes del dispositivo.'
                    : 'No fue posible iniciar la cámara en este dispositivo.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: alReintentar,
                icon: const Icon(Icons.refresh),
                label: const Text('Reintentar cámara'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
