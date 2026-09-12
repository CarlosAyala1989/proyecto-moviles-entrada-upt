import '../modelos/codigo_qr_temporal.dart';
import '../modelos/identidad_digital.dart';
import '../modelos/registro_ingreso_reciente.dart';
import '../modelos/resultado_validacion_ingreso.dart';
import '../modelos/sesion_usuario.dart';
import '../modelos/ubicacion_reportada.dart';
import '../modelos/usuario_sesion.dart';

abstract interface class ContratoClienteApi {
  Future<SesionUsuario> iniciarSesion(String identificador, String contrasena);
  Future<SesionUsuario> renovarSesion(String tokenRenovacion);
  Future<UsuarioSesion> consultarSesion(String tokenAcceso);
  Future<void> cerrarSesion(String tokenAcceso);
  Future<IdentidadDigital> consultarIdentidadDigital(String tokenAcceso);
  Future<CodigoQrTemporal> generarCodigoQr(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  );
  Future<void> revocarCodigoQr(String tokenAcceso);
  Future<ResultadoValidacionIngreso> validarIngreso({
    required String tokenAcceso,
    required String codigoQr,
    required String puntoAccesoCodigo,
    required UbicacionReportada ubicacion,
  });
  Future<List<RegistroIngresoReciente>> consultarIngresosRecientes(
    String tokenAcceso, {
    int limite = 20,
  });
}
