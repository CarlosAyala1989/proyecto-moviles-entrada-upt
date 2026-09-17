import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../controladores/controlador_identidad_qr.dart';

class PantallaCodigoQr extends StatefulWidget {
  const PantallaCodigoQr({required this.controlador, super.key});

  final ControladorIdentidadQr controlador;

  @override
  State<PantallaCodigoQr> createState() => _EstadoPantallaCodigoQr();
}

class _EstadoPantallaCodigoQr extends State<PantallaCodigoQr> {
  @override
  void initState() {
    super.initState();
    widget.controlador.cargarIdentidad();
  }

  @override
  void dispose() {
    widget.controlador.detenerRotacionAutomatica();
    super.dispose();
  }

  Future<void> _revocar() async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Anular código QR?'),
        content: const Text(
          'El código dejará de servir aunque todavía tenga tiempo disponible.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Anular'),
          ),
        ],
      ),
    );
    if (confirmado != true) return;
    final resultado = await widget.controlador.revocarCodigoQr();
    if (!mounted || !resultado) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('El código QR fue anulado.')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Código QR temporal')),
      body: AnimatedBuilder(
        animation: widget.controlador,
        builder: (context, _) {
          final identidad = widget.controlador.identidad;
          if (identidad.fase == FaseCarga.inicial ||
              identidad.fase == FaseCarga.cargando) {
            return const Center(child: CircularProgressIndicator());
          }
          if (identidad.fase == FaseCarga.error) {
            return _MensajeQr(
              icono: Icons.error_outline,
              mensaje: identidad.mensaje!,
              etiquetaAccion: 'Reintentar',
              alAccionar: () =>
                  widget.controlador.cargarIdentidad(forzar: true),
            );
          }
          if (!identidad.datos!.puedeSolicitarCodigoQr) {
            return _MensajeQr(
              icono: Icons.block_outlined,
              mensaje:
                  'Tu identidad aún no cumple los requisitos para solicitar un código QR.',
              etiquetaAccion: 'Actualizar identidad',
              alAccionar: () =>
                  widget.controlador.cargarIdentidad(forzar: true),
            );
          }
          return _construirEstadoCodigo();
        },
      ),
    );
  }

  Widget _construirEstadoCodigo() {
    final estado = widget.controlador.codigoQr;
    if (widget.controlador.revocando) {
      return const _GenerandoCodigoQr(mensaje: 'Anulando el código QR…');
    }
    if (estado.fase == FaseCarga.cargando) {
      return const _GenerandoCodigoQr();
    }
    if (estado.fase == FaseCarga.error) {
      return _MensajeQr(
        icono: Icons.warning_amber_rounded,
        mensaje: estado.mensaje!,
        etiquetaAccion: 'Intentar nuevamente',
        alAccionar: widget.controlador.iniciarRotacionAutomatica,
      );
    }
    if (estado.fase == FaseCarga.completada) {
      if (!widget.controlador.codigoQrVigente) {
        return _MensajeQr(
          icono: Icons.timer_off_outlined,
          mensaje: 'El código QR venció y ya no se muestra.',
          etiquetaAccion: 'Generar uno nuevo',
          alAccionar: widget.controlador.iniciarRotacionAutomatica,
        );
      }
      return _CodigoQrVigente(
        codigo: estado.datos!,
        segundosRestantes: widget.controlador.segundosRestantes,
        mensajeError: widget.controlador.mensajeCodigoQr,
        ubicacionSimulada: widget.controlador.usaUbicacionSimulada,
        alRevocar: _revocar,
      );
    }
    return _SolicitudCodigoQr(
      alGenerar: widget.controlador.iniciarRotacionAutomatica,
      ubicacionSimulada: widget.controlador.usaUbicacionSimulada,
    );
  }
}

class _SolicitudCodigoQr extends StatelessWidget {
  const _SolicitudCodigoQr({
    required this.alGenerar,
    required this.ubicacionSimulada,
  });

  final VoidCallback alGenerar;
  final bool ubicacionSimulada;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.qr_code_2,
                size: 88,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 20),
              Text(
                'Código temporal de ingreso',
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              const Text(
                'Al continuar, usaremos tu ubicación para comprobar que estás cerca de una puerta habilitada.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              const Text(
                'El código será de un solo uso y se renovará automáticamente cada 15 segundos mientras permanezcas en esta pantalla.',
                textAlign: TextAlign.center,
              ),
              if (ubicacionSimulada) ...[
                const SizedBox(height: 12),
                const Card(
                  child: ListTile(
                    leading: Icon(Icons.science_outlined),
                    title: Text('Modo de prueba en Linux'),
                    subtitle: Text(
                      'La ubicación mostrada es de prueba y no confirma que estés en la universidad.',
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: alGenerar,
                icon: const Icon(Icons.my_location),
                label: const Text('Usar mi ubicación y generar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GenerandoCodigoQr extends StatelessWidget {
  const _GenerandoCodigoQr({
    this.mensaje = 'Estamos comprobando tu ubicación y permiso de ingreso…',
  });

  final String mensaje;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 20),
            Text(mensaje, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _CodigoQrVigente extends StatelessWidget {
  const _CodigoQrVigente({
    required this.codigo,
    required this.segundosRestantes,
    required this.mensajeError,
    required this.ubicacionSimulada,
    required this.alRevocar,
  });

  final CodigoQrTemporal codigo;
  final int segundosRestantes;
  final String? mensajeError;
  final bool ubicacionSimulada;
  final VoidCallback alRevocar;

  @override
  Widget build(BuildContext context) {
    final urgente = segundosRestantes <= 10;
    final ladoQr = (MediaQuery.sizeOf(context).width - 88).clamp(160.0, 260.0);
    final colorTiempo = urgente
        ? Theme.of(context).colorScheme.error
        : Theme.of(context).colorScheme.primary;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Muestra este código al personal de seguridad',
          style: Theme.of(context).textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        Center(
          child: Semantics(
            image: true,
            label: 'Código QR temporal de ingreso',
            child: ExcludeSemantics(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x22000000),
                      blurRadius: 12,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: QrImageView(
                    data: codigo.codigoQr,
                    version: QrVersions.auto,
                    errorCorrectionLevel: QrErrorCorrectLevel.M,
                    size: ladoQr,
                    backgroundColor: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 18),
        Semantics(
          liveRegion: urgente,
          label: '$segundosRestantes segundos restantes',
          child: Column(
            children: [
              Text(
                '$segundosRestantes s',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: colorTiempo,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Text('Tiempo restante'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: ListTile(
            leading: const Icon(Icons.location_on_outlined),
            title: Text(codigo.puntoAccesoNombre),
            subtitle: Text('Punto ${codigo.puntoAccesoCodigo}'),
          ),
        ),
        if (ubicacionSimulada) ...[
          const SizedBox(height: 12),
          const Card(
            child: ListTile(
              leading: Icon(Icons.science_outlined),
              title: Text('Modo de prueba en Linux'),
              subtitle: Text(
                'Esta ubicación es simulada y sólo sirve para probar la aplicación.',
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        const Text(
          'No compartas capturas. Al escanearlo comprobaremos tu identidad, la puerta y las ubicaciones. Cada código sirve una sola vez.',
          textAlign: TextAlign.center,
        ),
        if (mensajeError != null) ...[
          const SizedBox(height: 12),
          Semantics(
            liveRegion: true,
            child: Card(
              color: Theme.of(context).colorScheme.errorContainer,
              child: ListTile(
                leading: const Icon(Icons.error_outline),
                title: const Text('No se pudo anular'),
                subtitle: Text(mensajeError!),
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: alRevocar,
          icon: const Icon(Icons.cancel_outlined),
          label: const Text('Anular código'),
        ),
      ],
    );
  }
}

class _MensajeQr extends StatelessWidget {
  const _MensajeQr({
    required this.icono,
    required this.mensaje,
    required this.etiquetaAccion,
    required this.alAccionar,
  });

  final IconData icono;
  final String mensaje;
  final String etiquetaAccion;
  final VoidCallback alAccionar;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icono, size: 64, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 20),
            Semantics(
              liveRegion: true,
              child: Text(mensaje, textAlign: TextAlign.center),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: alAccionar,
              icon: const Icon(Icons.refresh),
              label: Text(etiquetaAccion),
            ),
          ],
        ),
      ),
    );
  }
}
