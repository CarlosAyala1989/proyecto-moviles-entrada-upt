import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import 'aplicacion/aplicacion_seguridad.dart';
import 'configuracion/configuracion_seguridad.dart';
import 'controladores/controlador_validacion_ingresos.dart';
import 'servicios/proveedor_ubicacion.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final clienteApi = ClienteApi();
  final controladorSesion = ControladorSesion(
    clienteApi: clienteApi,
    almacenSesion: AlmacenSesionSegura(),
    rolesPermitidos: const {'SEGURIDAD'},
  );
  await controladorSesion.restaurar();
  final controladorValidacion = ControladorValidacionIngresos(
    clienteApi: clienteApi,
    controladorSesion: controladorSesion,
    proveedorUbicacion: const ProveedorUbicacionDispositivo(),
    puntoAccesoCodigo: ConfiguracionSeguridad.puntoAccesoCodigo,
  );
  runApp(
    AplicacionSeguridad(
      controladorSesion: controladorSesion,
      controladorValidacion: controladorValidacion,
    ),
  );
}
