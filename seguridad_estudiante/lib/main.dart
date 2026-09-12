import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'aplicacion/aplicacion_estudiante.dart';
import 'controladores/controlador_identidad_qr.dart';
import 'servicios/proveedor_ubicacion.dart';
import 'tema/tema_upt.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final errorConfiguracion = ConfiguracionApi.validarUrlBase(
    exigirHttps: kReleaseMode,
  );
  if (errorConfiguracion != null) {
    runApp(
      MaterialApp(
        title: 'Identidad Digital UPT',
        debugShowCheckedModeBanner: false,
        theme: construirTemaUpt(),
        home: PantallaConfiguracionInvalida(
          titulo: 'Configuración no válida',
          mensaje: errorConfiguracion,
          icono: Icons.settings_suggest_outlined,
        ),
      ),
    );
    return;
  }
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
