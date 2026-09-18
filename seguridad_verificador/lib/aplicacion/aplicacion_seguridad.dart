import '../pantallas/pantalla_administracion.dart';
import '../pantallas/puerta_operativa_seguridad.dart';
import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import '../controladores/controlador_validacion_ingresos.dart';
import '../navegacion/rutas_seguridad.dart';
import '../pantallas/pantalla_escaner.dart';
import '../pantallas/pantalla_historial.dart';
import '../pantallas/pantalla_inicio_seguridad.dart';
import '../pantallas/pantalla_inicio_sesion_seguridad.dart';
import '../pantallas/pantalla_preparacion_seguridad.dart';
import '../tema/tema_seguridad.dart';

class AplicacionSeguridad extends StatelessWidget {
  const AplicacionSeguridad({
    required this.controladorSesion,
    this.clienteAdministracion,
    required this.controladorValidacion,
    super.key,
  });

  final ControladorSesion controladorSesion;
  final ContratoAdministracion? clienteAdministracion;
  final ControladorValidacionIngresos controladorValidacion;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controladorSesion,
      builder: (context, _) => MaterialApp(
        key: ValueKey(controladorSesion.revisionAutenticacion),
        title: 'Control de Acceso UPT',
        debugShowCheckedModeBanner: false,
        theme: construirTemaSeguridad(),
        routes: {
          RutasSeguridad.escaner: (_) =>
              PantallaEscaner(controlador: controladorValidacion),
          RutasSeguridad.historial: (_) =>
              PantallaHistorial(controlador: controladorValidacion),
        },
        home: _pantallaInicial(),
        builder: (context, child) {
          if (controladorSesion.estaAutenticada &&
              !controladorSesion.sesion!.usuario.roles.contains(
                'ADMINISTRADOR',
              ) &&
              controladorValidacion.exigeUbicacion) {
            return PuertaOperativaSeguridad(
              controlador: controladorValidacion,
              sesion: controladorSesion,
              child: child!,
            );
          }
          return child!;
        },
      ),
    );
  }

  Widget _pantallaInicial() {
    if (controladorSesion.estado == EstadoSesion.restaurando ||
        controladorSesion.estado == EstadoSesion.cerrando) {
      return const PantallaPreparacionSeguridad(
        titulo: 'Control de Acceso UPT',
        descripcion: 'Preparando una sesión segura…',
        icono: Icons.security,
        mostrarProgreso: true,
      );
    }
    if (controladorSesion.estaAutenticada) {
      if (controladorSesion.sesion!.usuario.roles.contains('ADMINISTRADOR') &&
          clienteAdministracion != null) {
        return PantallaAdministracion(
          sesion: controladorSesion,
          api: clienteAdministracion!,
        );
      }
      return PantallaInicioSeguridad(controladorSesion: controladorSesion);
    }
    return PantallaInicioSesionSeguridad(controladorSesion: controladorSesion);
  }
}
