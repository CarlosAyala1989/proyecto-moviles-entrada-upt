import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import 'aplicacion/aplicacion_seguridad.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final controladorSesion = ControladorSesion(
    clienteApi: ClienteApi(),
    almacenSesion: AlmacenSesionSegura(),
    rolesPermitidos: const {'SEGURIDAD'},
  );
  await controladorSesion.restaurar();
  runApp(AplicacionSeguridad(controladorSesion: controladorSesion));
}
