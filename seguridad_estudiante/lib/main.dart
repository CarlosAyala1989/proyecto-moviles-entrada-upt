import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import 'aplicacion/aplicacion_estudiante.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final controladorSesion = ControladorSesion(
    clienteApi: ClienteApi(),
    almacenSesion: AlmacenSesionSegura(),
    rolesPermitidos: const {'ESTUDIANTE', 'DOCENTE', 'TRABAJADOR'},
  );
  await controladorSesion.restaurar();
  runApp(AplicacionEstudiante(controladorSesion: controladorSesion));
}
