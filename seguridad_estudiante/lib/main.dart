import 'dart:io';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'aplicacion/aplicacion_estudiante.dart';
import 'controladores/controlador_identidad_qr.dart';
import 'controladores/controlador_verificacion_intranet.dart';
import 'servicios/abridor_oauth.dart';
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
          titulo: 'La aplicación necesita ayuda',
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
  final ProveedorUbicacion proveedorUbicacion =
      kDebugMode &&
          Platform.isLinux &&
          ConfiguracionUbicacionDesarrollo.simulada
      ? const ProveedorUbicacionSimuladaDesarrollo()
      : const ProveedorUbicacionDispositivo();
  final controladorIdentidadQr = ControladorIdentidadQr(
    clienteApi: clienteApi,
    controladorSesion: controladorSesion,
    proveedorUbicacion: proveedorUbicacion,
  );
  final controladorVerificacionIntranet = ControladorVerificacionIntranet(
    clienteApi: clienteApi,
    controladorSesion: controladorSesion,
    abridorOauth: const AbridorOauthExterno(),
  );
  runApp(
    AplicacionEstudiante(
      controladorSesion: controladorSesion,
      controladorIdentidadQr: controladorIdentidadQr,
      controladorVerificacionIntranet: controladorVerificacionIntranet,
    ),
  );
}
