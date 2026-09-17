import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import '../controladores/controlador_validacion_ingresos.dart';

class PantallaHistorial extends StatefulWidget {
  const PantallaHistorial({required this.controlador, super.key});

  final ControladorValidacionIngresos controlador;

  @override
  State<PantallaHistorial> createState() => _EstadoPantallaHistorial();
}

class _EstadoPantallaHistorial extends State<PantallaHistorial> {
  @override
  void initState() {
    super.initState();
    widget.controlador.cargarHistorial();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Historial reciente')),
      body: AnimatedBuilder(
        animation: widget.controlador,
        builder: (context, _) {
          final estado = widget.controlador.historial;
          return switch (estado.fase) {
            FaseCarga.inicial || FaseCarga.cargando => const Center(
              child: CircularProgressIndicator(),
            ),
            FaseCarga.error => _ErrorHistorial(
              mensaje: estado.mensaje!,
              alReintentar: () =>
                  widget.controlador.cargarHistorial(forzar: true),
            ),
            FaseCarga.completada => _ListaHistorial(
              registros: estado.datos!,
              alActualizar: () =>
                  widget.controlador.cargarHistorial(forzar: true),
            ),
          };
        },
      ),
    );
  }
}

class _ListaHistorial extends StatelessWidget {
  const _ListaHistorial({required this.registros, required this.alActualizar});

  final List<RegistroIngresoReciente> registros;
  final Future<void> Function() alActualizar;

  @override
  Widget build(BuildContext context) {
    if (registros.isEmpty) {
      return RefreshIndicator(
        onRefresh: alActualizar,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 160),
            Icon(Icons.history, size: 64),
            SizedBox(height: 16),
            Text(
              'Todavía no comprobaste ningún ingreso.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: alActualizar,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: registros.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, indice) {
          if (indice == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                'Últimos ${registros.length} ingresos comprobados',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            );
          }
          return _RegistroHistorial(registro: registros[indice - 1]);
        },
      ),
    );
  }
}

class _RegistroHistorial extends StatelessWidget {
  const _RegistroHistorial({required this.registro});

  final RegistroIngresoReciente registro;

  @override
  Widget build(BuildContext context) {
    final autorizado = registro.resultado == 'AUTORIZADO';
    final color = autorizado
        ? const Color(0xFF146C43)
        : const Color(0xFFB3261E);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              autorizado ? Icons.check_circle : Icons.cancel,
              color: color,
              size: 32,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    autorizado ? 'INGRESO PERMITIDO' : 'INGRESO NO PERMITIDO',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: color,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (autorizado && registro.nombreCompleto != null)
                    Text(
                      registro.nombreCompleto!,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  if (autorizado && registro.codigoInstitucional != null)
                    Text(registro.codigoInstitucional!),
                  if (!autorizado) Text(_etiquetaMotivo(registro.motivo)),
                  const SizedBox(height: 6),
                  Text(
                    '${registro.puntoAccesoNombre} · ${_formatearFecha(registro.registradoEn)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorHistorial extends StatelessWidget {
  const _ErrorHistorial({required this.mensaje, required this.alReintentar});

  final String mensaje;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Semantics(liveRegion: true, child: Text(mensaje)),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: alReintentar,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}

String _formatearFecha(DateTime fecha) {
  final local = fecha.toLocal();
  String dos(int valor) => valor.toString().padLeft(2, '0');
  return '${dos(local.day)}/${dos(local.month)}/${local.year} '
      '${dos(local.hour)}:${dos(local.minute)}';
}

String _etiquetaMotivo(String motivo) =>
    mensajeDecisionIngresoParaUsuario(motivo);
