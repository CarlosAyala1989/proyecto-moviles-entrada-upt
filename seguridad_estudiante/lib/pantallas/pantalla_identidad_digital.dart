import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import '../controladores/controlador_identidad_qr.dart';
import '../navegacion/rutas_estudiante.dart';

class PantallaIdentidadDigital extends StatefulWidget {
  const PantallaIdentidadDigital({required this.controlador, super.key});

  final ControladorIdentidadQr controlador;

  @override
  State<PantallaIdentidadDigital> createState() =>
      _EstadoPantallaIdentidadDigital();
}

class _EstadoPantallaIdentidadDigital extends State<PantallaIdentidadDigital> {
  @override
  void initState() {
    super.initState();
    widget.controlador.cargarIdentidad();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Identidad digital')),
      body: AnimatedBuilder(
        animation: widget.controlador,
        builder: (context, _) {
          final estado = widget.controlador.identidad;
          return switch (estado.fase) {
            FaseCarga.inicial || FaseCarga.cargando => const Center(
              child: CircularProgressIndicator(),
            ),
            FaseCarga.error => _EstadoErrorIdentidad(
              mensaje: estado.mensaje!,
              alReintentar: () =>
                  widget.controlador.cargarIdentidad(forzar: true),
            ),
            FaseCarga.completada => _ContenidoIdentidad(
              identidad: estado.datos!,
              alActualizar: () =>
                  widget.controlador.cargarIdentidad(forzar: true),
            ),
          };
        },
      ),
    );
  }
}

class _ContenidoIdentidad extends StatelessWidget {
  const _ContenidoIdentidad({
    required this.identidad,
    required this.alActualizar,
  });

  final IdentidadDigital identidad;
  final Future<void> Function() alActualizar;

  @override
  Widget build(BuildContext context) {
    final perfil = identidad.perfilAcademico;
    return RefreshIndicator(
      onRefresh: alActualizar,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
          Center(child: _FotografiaIdentidad(identidad: identidad)),
          const SizedBox(height: 16),
          Text(
            identidad.nombreCompleto,
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            identidad.codigoInstitucional,
            style: Theme.of(context).textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              _EstadoPerfil(
                icono: Icons.verified_user_outlined,
                etiqueta: 'Identidad',
                valor: _estadoLegible(identidad.estadoVerificacion),
                favorable: identidad.estadoVerificacion == 'VERIFICADA',
              ),
              _EstadoPerfil(
                icono: Icons.person_outline,
                etiqueta: 'Cuenta',
                valor: _estadoLegible(identidad.estadoUsuario),
                favorable: identidad.estadoUsuario == 'ACTIVO',
              ),
              _EstadoPerfil(
                icono: Icons.door_front_door_outlined,
                etiqueta: 'Ingreso',
                valor: _estadoLegible(identidad.estadoAutorizacion),
                favorable: identidad.estadoAutorizacion == 'AUTORIZADO',
              ),
            ],
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _DatoIdentidad(
                    etiqueta: 'Correo institucional',
                    valor: identidad.correoInstitucional,
                  ),
                  _DatoIdentidad(
                    etiqueta: 'Tipo de usuario',
                    valor: identidad.roles.join(', '),
                  ),
                  if (perfil != null) ...[
                    if (perfil.escuela != null)
                      _DatoIdentidad(
                        etiqueta: 'Escuela',
                        valor: perfil.escuela!,
                      ),
                    if (perfil.facultad != null)
                      _DatoIdentidad(
                        etiqueta: 'Facultad',
                        valor: perfil.facultad!,
                      ),
                    _DatoIdentidad(
                      etiqueta: 'Estado académico',
                      valor: perfil.estadoAcademico,
                    ),
                    if (perfil.periodoAcademico != null)
                      _DatoIdentidad(
                        etiqueta: 'Periodo académico',
                        valor: perfil.periodoAcademico!,
                        esUltimo: true,
                      ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (identidad.puedeSolicitarCodigoQr)
            FilledButton.icon(
              onPressed: () =>
                  Navigator.pushNamed(context, RutasEstudiante.codigoQr),
              icon: const Icon(Icons.qr_code_2),
              label: const Text('Solicitar código QR'),
            )
          else
            const _AvisoNoHabilitado(),
        ],
      ),
    );
  }
}

class _FotografiaIdentidad extends StatelessWidget {
  const _FotografiaIdentidad({required this.identidad});

  final IdentidadDigital identidad;

  @override
  Widget build(BuildContext context) {
    final fotoUrl = identidad.fotoUrl;
    final reemplazo = ColoredBox(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Icon(
        Icons.person,
        size: 72,
        color: Theme.of(context).colorScheme.onPrimaryContainer,
      ),
    );
    return Semantics(
      image: true,
      label: 'Fotografía de ${identidad.nombreCompleto}',
      child: ClipOval(
        child: SizedBox.square(
          dimension: 128,
          child: fotoUrl == null
              ? reemplazo
              : Image.network(
                  fotoUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => reemplazo,
                ),
        ),
      ),
    );
  }
}

class _EstadoPerfil extends StatelessWidget {
  const _EstadoPerfil({
    required this.icono,
    required this.etiqueta,
    required this.valor,
    required this.favorable,
  });

  final IconData icono;
  final String etiqueta;
  final String valor;
  final bool favorable;

  @override
  Widget build(BuildContext context) {
    final color = favorable
        ? Theme.of(context).colorScheme.primary
        : Theme.of(context).colorScheme.error;
    return Chip(
      avatar: Icon(icono, size: 18, color: color),
      label: Text('$etiqueta: $valor'),
      side: BorderSide(color: color),
    );
  }
}

class _DatoIdentidad extends StatelessWidget {
  const _DatoIdentidad({
    required this.etiqueta,
    required this.valor,
    this.esUltimo = false,
  });

  final String etiqueta;
  final String valor;
  final bool esUltimo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: esUltimo ? 0 : 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(etiqueta, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 2),
          SelectableText(valor),
        ],
      ),
    );
  }
}

class _AvisoNoHabilitado extends StatelessWidget {
  const _AvisoNoHabilitado();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Card(
        color: Theme.of(context).colorScheme.errorContainer,
        child: const ListTile(
          leading: Icon(Icons.block_outlined),
          title: Text('Código QR no disponible'),
          subtitle: Text(
            'Todavía no podemos confirmar tu permiso de ingreso. Pide ayuda a la universidad.',
          ),
        ),
      ),
    );
  }
}

String _estadoLegible(String estado) {
  const estados = {
    'VERIFICADA': 'confirmada',
    'PENDIENTE': 'por confirmar',
    'ACTIVO': 'activa',
    'INACTIVO': 'inactiva',
    'AUTORIZADO': 'permitido',
    'NO_AUTORIZADO': 'no permitido',
  };
  return estados[estado] ?? estado.toLowerCase().replaceAll('_', ' ');
}

class _EstadoErrorIdentidad extends StatelessWidget {
  const _EstadoErrorIdentidad({
    required this.mensaje,
    required this.alReintentar,
  });

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
              size: 56,
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
