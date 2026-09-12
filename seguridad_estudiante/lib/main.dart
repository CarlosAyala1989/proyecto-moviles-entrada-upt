import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import 'aplicacion/aplicacion_estudiante.dart';
import 'controladores/controlador_identidad_qr.dart';
import 'servicios/proveedor_ubicacion.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final clienteApi = ClienteApi();
  final controladorSesion = ControladorSesion(
    clienteApi: clienteApi,
    almacenSesion: AlmacenSesionSegura(),
    rolesPermitidos: const {'ESTUDIANTE', 'DOCENTE', 'TRABAJADOR'},
  );
  await controladorSesion.restaurar();
  final controladorIdentidadQr = ControladorIdentidadQr(
    clienteApi: clienteApi,
    controladorSesion: controladorSesion,
    proveedorUbicacion: const ProveedorUbicacionDispositivo(),
  );
  runApp(
    AplicacionEstudiante(
      controladorSesion: controladorSesion,
      controladorIdentidadQr: controladorIdentidadQr,
    ),
  );
}
