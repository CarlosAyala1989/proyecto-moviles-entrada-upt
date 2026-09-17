import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

/// Escáner Linux basado en zbarcam, que accede a la cámara V4L2 del equipo.
class VisorEscanerQrLinux extends StatefulWidget {
  const VisorEscanerQrLinux({required this.alDetectar, super.key});

  final ValueChanged<String> alDetectar;

  @override
  State<VisorEscanerQrLinux> createState() => _EstadoVisorEscanerQrLinux();
}

class _EstadoVisorEscanerQrLinux extends State<VisorEscanerQrLinux>
    with WidgetsBindingObserver {
  Process? _proceso;
  StreamSubscription<String>? _salida;
  StreamSubscription<String>? _errores;
  bool _escaneando = false;
  bool _capturaProcesada = false;
  String? _mensaje;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState estado) {
    if (estado != AppLifecycleState.resumed) {
      unawaited(_detenerEscaner());
    }
  }

  Future<void> _iniciarEscaner() async {
    if (_escaneando) return;
    setState(() {
      _escaneando = true;
      _mensaje = null;
    });
    try {
      final proceso = await Process.start('zbarcam', const [
        '--raw',
        '--nodisplay',
      ]);
      if (!mounted) {
        proceso.kill();
        return;
      }
      _proceso = proceso;
      _salida = proceso.stdout
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen(_procesarCodigo);
      _errores = proceso.stderr
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen((_) {});
      unawaited(proceso.exitCode.then(_alFinalizarProceso));
    } on ProcessException {
      if (!mounted) return;
      setState(() {
        _escaneando = false;
        _mensaje =
            'Falta un componente para usar la cámara en Linux. Pide ayuda al responsable del sistema.';
      });
    }
  }

  void _procesarCodigo(String valor) {
    final codigo = valor.trim();
    if (_capturaProcesada || codigo.isEmpty) return;
    _capturaProcesada = true;
    widget.alDetectar(codigo);
    unawaited(_detenerEscaner());
  }

  void _alFinalizarProceso(int _) {
    if (!mounted || _capturaProcesada || !_escaneando) return;
    setState(() {
      _escaneando = false;
      _mensaje = 'La cámara se detuvo antes de detectar un código QR.';
    });
  }

  Future<void> _detenerEscaner() async {
    final proceso = _proceso;
    _proceso = null;
    if (mounted && _escaneando) {
      setState(() => _escaneando = false);
    }
    await _salida?.cancel();
    _salida = null;
    await _errores?.cancel();
    _errores = null;
    proceso?.kill();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_detenerEscaner());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.videocam_outlined,
                size: 72,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 16),
              Text(
                _escaneando
                    ? 'Apunta la cámara al código QR.'
                    : 'Escanea el código QR con la cámara del equipo.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (_escaneando) ...[
                const SizedBox(height: 20),
                const CircularProgressIndicator(),
              ],
              if (_mensaje != null) ...[
                const SizedBox(height: 16),
                Text(
                  _mensaje!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _escaneando ? null : _iniciarEscaner,
                icon: const Icon(Icons.qr_code_scanner),
                label: Text(_escaneando ? 'Escaneando…' : 'Usar cámara'),
              ),
              if (_escaneando)
                TextButton(
                  onPressed: _detenerEscaner,
                  child: const Text('Cancelar'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
