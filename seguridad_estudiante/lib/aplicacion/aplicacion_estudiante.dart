import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import '../controladores/controlador_identidad_qr.dart';
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
    super.key,
  });

  final ControladorSesion controladorSesion;
  final ControladorIdentidadQr controladorIdentidadQr;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Identidad Digital UPT',
      debugShowCheckedModeBanner: false,
      theme: construirTemaUpt(),
      routes: {
        RutasEstudiante.identidad: (_) =>
            PantallaIdentidadDigital(controlador: controladorIdentidadQr),
        RutasEstudiante.codigoQr: (_) =>
            PantallaCodigoQr(controlador: controladorIdentidadQr),
      },
      home: AnimatedBuilder(
        animation: controladorSesion,
        builder: (context, _) {
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
            return PantallaInicioEstudiante(
              controladorSesion: controladorSesion,
            );
          }
          return PantallaInicioSesion(controladorSesion: controladorSesion);
        },
      ),
    );
  }
}
