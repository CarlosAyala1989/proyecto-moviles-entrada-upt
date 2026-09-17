import 'dart:async';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import '../controladores/controlador_validacion_ingresos.dart';
import '../navegacion/rutas_seguridad.dart';
import '../widgets/visor_escaner_qr.dart';

typedef ConstructorEscanerQr = Widget Function(ValueChanged<String> alDetectar);

class PantallaEscaner extends StatelessWidget {
  const PantallaEscaner({
    required this.controlador,
    this.constructorEscaner,
    super.key,
  });

  final ControladorValidacionIngresos controlador;
  final ConstructorEscanerQr? constructorEscaner;

  void _validar(String codigoQr) {
    unawaited(controlador.validarCodigoQr(codigoQr));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Validar ingreso')),
      body: AnimatedBuilder(
        animation: controlador,
        builder: (context, _) {
          final estado = controlador.validacion;
          return switch (estado.fase) {
            FaseCarga.inicial => _construirEscaner(context),
            FaseCarga.cargando => const _ValidandoIngreso(),
            FaseCarga.error => _MensajeValidacion(
              icono: Icons.error_outline,
              mensaje: estado.mensaje!,
              etiquetaAccion: 'Escanear otro código',
              alAccionar: controlador.reiniciarValidacion,
            ),
            FaseCarga.completada => _ResultadoIngreso(
              resultado: estado.datos!,
              alEscanearOtro: controlador.reiniciarValidacion,
            ),
          };
        },
      ),
    );
  }

  Widget _construirEscaner(BuildContext context) {
    final construir =
        constructorEscaner ??
        (alDetectar) => VisorEscanerQr(alDetectar: alDetectar);
    return Column(
      children: [
        Material(
          color: Theme.of(context).colorScheme.primaryContainer,
          child: ListTile(
            leading: const Icon(Icons.door_front_door_outlined),
            title: const Text('Puerta asignada a este equipo'),
            subtitle: Text(controlador.puntoAccesoCodigo),
          ),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 14, 20, 10),
          child: Text(
            'Escanea el código que aparece ahora en la pantalla del estudiante. Cambia cada 15 segundos.',
            textAlign: TextAlign.center,
          ),
        ),
        if (controlador.usaUbicacionSimulada)
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 10),
            child: Card(
              child: ListTile(
                leading: Icon(Icons.science_outlined),
                title: Text('Modo de prueba en Linux'),
                subtitle: Text(
                  'La ubicación de este equipo es simulada y no confirma que esté en la universidad.',
                ),
              ),
            ),
          ),
        Expanded(child: construir(_validar)),
      ],
    );
  }
}

class _ValidandoIngreso extends StatelessWidget {
  const _ValidandoIngreso();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 20),
            Text(
              'Estamos comprobando el código, la identidad y la ubicación…',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultadoIngreso extends StatelessWidget {
  const _ResultadoIngreso({
    required this.resultado,
    required this.alEscanearOtro,
  });

  final ResultadoValidacionIngreso resultado;
  final VoidCallback alEscanearOtro;

  @override
  Widget build(BuildContext context) {
    final autorizado = resultado.autorizado;
    final color = autorizado
        ? const Color(0xFF146C43)
        : const Color(0xFFB3261E);
    final identidad = resultado.identidad;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Semantics(
          liveRegion: true,
          label: autorizado ? 'Ingreso autorizado' : 'Ingreso denegado',
          child: Icon(
            autorizado ? Icons.check_circle : Icons.cancel,
            size: 92,
            color: color,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          autorizado ? 'INGRESO PERMITIDO' : 'INGRESO NO PERMITIDO',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: color,
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          mensajeDecisionIngresoParaUsuario(resultado.motivo),
          style: Theme.of(context).textTheme.titleMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        Card(
          child: ListTile(
            leading: const Icon(Icons.location_on_outlined),
            title: Text(resultado.puntoAccesoNombre),
            subtitle: Text('Punto ${resultado.puntoAccesoCodigo}'),
          ),
        ),
        if (autorizado && identidad != null) ...[
          const SizedBox(height: 12),
          _IdentidadAutorizada(identidad: identidad),
        ],
        if (!autorizado) ...[
          const SizedBox(height: 12),
          Card(
            color: Theme.of(context).colorScheme.errorContainer,
            child: ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('Qué ocurrió'),
              subtitle: Text(_etiquetaMotivo(resultado.motivo)),
            ),
          ),
        ],
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: alEscanearOtro,
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Escanear otro código'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () =>
              Navigator.pushNamed(context, RutasSeguridad.historial),
          icon: const Icon(Icons.history),
          label: const Text('Ver historial reciente'),
        ),
      ],
    );
  }
}

class _IdentidadAutorizada extends StatelessWidget {
  const _IdentidadAutorizada({required this.identidad});

  final IdentidadIngreso identidad;

  @override
  Widget build(BuildContext context) {
    final reemplazo = ColoredBox(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Icon(
        Icons.person,
        size: 58,
        color: Theme.of(context).colorScheme.onPrimaryContainer,
      ),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Semantics(
              image: true,
              label: 'Fotografía de ${identidad.nombreCompleto}',
              child: ClipOval(
                child: SizedBox.square(
                  dimension: 104,
                  child: identidad.fotoUrl == null
                      ? reemplazo
                      : Image.network(
                          identidad.fotoUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => reemplazo,
                        ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              identidad.nombreCompleto,
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            SelectableText(
              identidad.codigoInstitucional,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const Divider(height: 28),
            _DatoResultado(
              etiqueta: 'Tipo de usuario',
              valor: identidad.tiposUsuario.join(', '),
            ),
            if (identidad.escuela != null)
              _DatoResultado(etiqueta: 'Escuela', valor: identidad.escuela!),
            if (identidad.estadoAcademico != null)
              _DatoResultado(
                etiqueta: 'Estado académico',
                valor: identidad.estadoAcademico!,
              ),
          ],
        ),
      ),
    );
  }
}

class _DatoResultado extends StatelessWidget {
  const _DatoResultado({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              etiqueta,
              style: Theme.of(context).textTheme.labelLarge,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(valor, textAlign: TextAlign.end)),
        ],
      ),
    );
  }
}

class _MensajeValidacion extends StatelessWidget {
  const _MensajeValidacion({
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
            Icon(icono, size: 64, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 20),
            Semantics(
              liveRegion: true,
              child: Text(mensaje, textAlign: TextAlign.center),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: alAccionar,
              icon: const Icon(Icons.qr_code_scanner),
              label: Text(etiquetaAccion),
            ),
          ],
        ),
      ),
    );
  }
}

String _etiquetaMotivo(String motivo) {
  return mensajeDecisionIngresoParaUsuario(motivo);
}
