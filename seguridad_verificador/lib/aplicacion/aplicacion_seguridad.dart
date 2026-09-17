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
    required this.controladorValidacion,
    super.key,
  });

  final ControladorSesion controladorSesion;
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
      return PantallaInicioSeguridad(controladorSesion: controladorSesion);
    }
    return PantallaInicioSesionSeguridad(controladorSesion: controladorSesion);
  }
}
