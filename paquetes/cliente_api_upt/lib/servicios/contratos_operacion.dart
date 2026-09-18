import '../modelos/ubicacion_reportada.dart';

abstract interface class ContratoControlSeguridad {
  Future<Map<String, dynamic>> comprobarUbicacionSeguridad(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  );
}

abstract interface class ContratoAdministracion {
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
