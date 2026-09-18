import 'dart:io';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'aplicacion/aplicacion_seguridad.dart';
import 'controladores/controlador_validacion_ingresos.dart';
import 'servicios/proveedor_ubicacion.dart';
import 'tema/tema_seguridad.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final erroresConfiguracion = [
    ConfiguracionApi.validarUrlBase(exigirHttps: kReleaseMode),
  ].whereType<String>().toList(growable: false);
  if (erroresConfiguracion.isNotEmpty) {
    runApp(
      MaterialApp(
        title: 'Control de Acceso UPT',
        debugShowCheckedModeBanner: false,
        theme: construirTemaSeguridad(),
        home: PantallaConfiguracionInvalida(
          titulo: 'La aplicación necesita ayuda',
          mensaje: erroresConfiguracion.join('\n'),
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
    rolesPermitidos: const {'SEGURIDAD', 'ADMINISTRADOR'},
  );
  await controladorSesion.restaurar();
  final ProveedorUbicacion proveedorUbicacion =
      kDebugMode &&
          Platform.isLinux &&
          ConfiguracionUbicacionDesarrollo.simulada
      ? const ProveedorUbicacionSimuladaDesarrollo()
      : const ProveedorUbicacionDispositivo();
  final controladorValidacion = ControladorValidacionIngresos(
    clienteApi: clienteApi,
    controladorSesion: controladorSesion,
    proveedorUbicacion: proveedorUbicacion,
    controlSeguridadApi: clienteApi,
  );
  runApp(
    AplicacionSeguridad(
      clienteAdministracion: clienteApi,
      controladorSesion: controladorSesion,
      controladorValidacion: controladorValidacion,
    ),
  );
}
