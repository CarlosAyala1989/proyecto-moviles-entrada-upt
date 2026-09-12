import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import '../navegacion/rutas_estudiante.dart';
import '../pantallas/pantalla_inicio_estudiante.dart';
import '../pantallas/pantalla_inicio_sesion.dart';
import '../pantallas/pantalla_preparacion.dart';
import '../tema/tema_upt.dart';

class AplicacionEstudiante extends StatelessWidget {
  const AplicacionEstudiante({
    required this.controladorSesion,
    super.key,
  });

  final ControladorSesion controladorSesion;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Identidad Digital UPT',
      debugShowCheckedModeBanner: false,
      theme: construirTemaUpt(),
      routes: {
        RutasEstudiante.identidad: (_) => const PantallaPreparacion(
          titulo: 'Identidad digital',
          descripcion: 'La consulta del perfil se completará en el Hito 10.',
          icono: Icons.badge_outlined,
        ),
        RutasEstudiante.codigoQr: (_) => const PantallaPreparacion(
          titulo: 'Código QR temporal',
          descripcion: 'La solicitud y visualización se completarán en el Hito 10.',
          icono: Icons.qr_code_2,
        ),
      },
      home: AnimatedBuilder(
        animation: controladorSesion,
        builder: (context, _) {
          if (
            controladorSesion.estado == EstadoSesion.restaurando
            || controladorSesion.estado == EstadoSesion.cerrando
          ) {
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
