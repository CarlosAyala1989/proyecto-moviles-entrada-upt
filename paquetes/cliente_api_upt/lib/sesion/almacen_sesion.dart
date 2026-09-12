import '../modelos/sesion_usuario.dart';

abstract interface class AlmacenSesion {
  Future<void> guardar(SesionUsuario sesion);
  Future<SesionUsuario?> recuperar();
  Future<void> limpiar();
}
