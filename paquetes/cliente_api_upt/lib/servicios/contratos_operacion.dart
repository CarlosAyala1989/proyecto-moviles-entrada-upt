import '../modelos/ubicacion_reportada.dart';
import 'dart:typed_data';

abstract interface class ContratoControlSeguridad {
  Future<Map<String, dynamic>> comprobarUbicacionSeguridad(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  );
}

abstract interface class ContratoAdministracion {
  Future<Uint8List> obtenerMapaEstatico(
    String tokenAcceso, {
    required double latitud,
    required double longitud,
    required int zoom,
    int ancho = 600,
    int alto = 340,
  });
  Future<List<Map<String, dynamic>>> consultarPuertas(String tokenAcceso);
  Future<void> guardarPuerta(
    String tokenAcceso,
    Map<String, dynamic> datos, {
    int? id,
  });
  Future<List<Map<String, dynamic>>> consultarGuardias(String tokenAcceso);
  Future<void> guardarGuardia(
    String tokenAcceso,
    Map<String, dynamic> datos, {
    int? id,
  });
}

abstract interface class ContratoPreparacionOffline {
  Future<Map<String, dynamic>> prepararQrOffline(
    String tokenAcceso,
    String identificadorDispositivo,
    String plataforma,
  );
}
