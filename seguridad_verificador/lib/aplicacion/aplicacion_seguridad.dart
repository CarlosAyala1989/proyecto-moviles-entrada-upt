import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import '../navegacion/rutas_seguridad.dart';
import '../pantallas/pantalla_inicio_seguridad.dart';
import '../pantallas/pantalla_inicio_sesion_seguridad.dart';
import '../pantallas/pantalla_preparacion_seguridad.dart';
import '../tema/tema_seguridad.dart';

class AplicacionSeguridad extends StatelessWidget {
  const AplicacionSeguridad({
    required this.controladorSesion,
    super.key,
  });

  final ControladorSesion controladorSesion;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Control de Acceso UPT',
      debugShowCheckedModeBanner: false,
      theme: construirTemaSeguridad(),
      routes: {
        RutasSeguridad.escaner: (_) => const PantallaPreparacionSeguridad(
          titulo: 'Escáner de códigos QR',
          descripcion: 'La captura y validación se completarán en el Hito 11.',
          icono: Icons.qr_code_scanner,
        ),
        RutasSeguridad.historial: (_) => const PantallaPreparacionSeguridad(
          titulo: 'Historial reciente',
          descripcion: 'La presentación del historial se completará en el Hito 11.',
          icono: Icons.history,
        ),
      },
      home: AnimatedBuilder(
        animation: controladorSesion,
        builder: (context, _) {
          if (
            controladorSesion.estado == EstadoSesion.restaurando
            || controladorSesion.estado == EstadoSesion.cerrando
          ) {
            return const PantallaPreparacionSeguridad(
              titulo: 'Control de Acceso UPT',
              descripcion: 'Preparando una sesión segura…',
              icono: Icons.security,
              mostrarProgreso: true,
            );
          }
          if (controladorSesion.estaAutenticada) {
            return PantallaInicioSeguridad(
              controladorSesion: controladorSesion,
            );
          }
          return PantallaInicioSesionSeguridad(
            controladorSesion: controladorSesion,
          );
        },
      ),
    );
  }
}
