import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import '../controladores/controlador_identidad_qr.dart';
import '../controladores/controlador_verificacion_intranet.dart';
import '../navegacion/rutas_estudiante.dart';
import '../pantallas/pantalla_codigo_qr.dart';
import '../pantallas/pantalla_identidad_digital.dart';
import '../pantallas/pantalla_inicio_estudiante.dart';
import '../pantallas/pantalla_inicio_sesion.dart';
import '../pantallas/pantalla_preparacion.dart';
import '../tema/tema_upt.dart';

class AplicacionEstudiante extends StatelessWidget {
  const AplicacionEstudiante({
    required this.controladorSesion,
    required this.controladorIdentidadQr,
    required this.controladorVerificacionIntranet,
    super.key,
  });

  final ControladorSesion controladorSesion;
  final ControladorIdentidadQr controladorIdentidadQr;
  final ControladorVerificacionIntranet controladorVerificacionIntranet;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controladorSesion,
      builder: (context, _) => MaterialApp(
        key: ValueKey(controladorSesion.revisionAutenticacion),
        title: 'Identidad Digital UPT',
        debugShowCheckedModeBanner: false,
        theme: construirTemaUpt(),
        routes: {
          RutasEstudiante.identidad: (_) =>
              PantallaIdentidadDigital(controlador: controladorIdentidadQr),
          RutasEstudiante.codigoQr: (_) =>
              PantallaCodigoQr(controlador: controladorIdentidadQr),
        },
        home: _pantallaInicial(),
      ),
    );
  }

  Widget _pantallaInicial() {
    if (controladorSesion.estado == EstadoSesion.restaurando ||
        controladorSesion.estado == EstadoSesion.cerrando) {
      return const PantallaPreparacion(
        titulo: 'Identidad Digital UPT',
        descripcion: 'Preparando una sesión segura…',
        icono: Icons.shield_outlined,
        mostrarProgreso: true,
      );
    }
    if (controladorSesion.estaAutenticada) {
      return PantallaInicioEstudiante(controladorSesion: controladorSesion);
    }
    return PantallaInicioSesion(
      controladorVerificacionIntranet: controladorVerificacionIntranet,
    );
  }
}
