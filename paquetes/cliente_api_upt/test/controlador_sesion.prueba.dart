import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';

class AlmacenSesionFalso implements AlmacenSesion {
  AlmacenSesionFalso([this.sesionGuardada]);

  SesionUsuario? sesionGuardada;
  int limpiezas = 0;

  @override
  Future<void> guardar(SesionUsuario sesion) async {
    sesionGuardada = sesion;
  }

  @override
  Future<void> limpiar() async {
    limpiezas += 1;
    sesionGuardada = null;
  }

  @override
  Future<SesionUsuario?> recuperar() async => sesionGuardada;
}

class ClienteApiFalso implements ContratoClienteApi {
  ClienteApiFalso({required this.sesionInicio, required this.usuarioConsultado});

  SesionUsuario sesionInicio;
  UsuarioSesion usuarioConsultado;
  int consultasSesion = 0;
  int cierresSesion = 0;

  @override
  Future<void> cerrarSesion(String tokenAcceso) async {
    cierresSesion += 1;
  }

  @override
  Future<UsuarioSesion> consultarSesion(String tokenAcceso) async {
    consultasSesion += 1;
    return usuarioConsultado;
  }

  @override
  Future<SesionUsuario> iniciarSesion(
    String identificador,
    String contrasena,
  ) async => sesionInicio;

  @override
  Future<SesionUsuario> renovarSesion(String tokenRenovacion) async =>
      sesionInicio;

  @override
  Future<IdentidadDigital> consultarIdentidadDigital(String tokenAcceso) =>
      throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<CodigoQrTemporal> generarCodigoQr(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  ) => throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<List<RegistroIngresoReciente>> consultarIngresosRecientes(
    String tokenAcceso, {
    int limite = 20,
  }) => throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<ResultadoValidacionIngreso> validarIngreso({
    required String tokenAcceso,
    required String codigoQr,
    required String puntoAccesoCodigo,
    required UbicacionReportada ubicacion,
  }) => throw UnsupportedError('Operación fuera del alcance de esta prueba.');
}

UsuarioSesion crearUsuario(List<String> roles) => UsuarioSesion(
  id: 1,
  codigoInstitucional: 'PRUEBA-001',
  correoInstitucional: 'prueba@example.invalid',
  nombres: 'Usuario',
  apellidos: 'De Prueba',
  roles: roles,
);

SesionUsuario crearSesion(List<String> roles) {
  final ahora = DateTime.now().toUtc();
  return SesionUsuario(
    tokenAcceso: 'token-acceso-ficticio',
    tokenRenovacion: 'token-renovacion-ficticio',
    tokenAccesoExpiraEn: ahora.add(const Duration(minutes: 10)),
    tokenRenovacionExpiraEn: ahora.add(const Duration(days: 1)),
    usuario: crearUsuario(roles),
  );
}

void main() {
  group('Controlador de sesión', () {
    test('revalida una sesión guardada contra el backend', () async {
      final sesion = crearSesion(['ESTUDIANTE']);
      final almacen = AlmacenSesionFalso(sesion);
      final cliente = ClienteApiFalso(
        sesionInicio: sesion,
        usuarioConsultado: crearUsuario(['ESTUDIANTE']),
      );
      final controlador = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: almacen,
        rolesPermitidos: const {'ESTUDIANTE'},
      );

      await controlador.restaurar();

      expect(controlador.estado, EstadoSesion.autenticada);
      expect(cliente.consultasSesion, 1);
      expect(almacen.sesionGuardada, isNotNull);
    });

    test('rechaza una cuenta sin rol permitido en la aplicación', () async {
      final sesion = crearSesion(['ADMINISTRADOR']);
      final almacen = AlmacenSesionFalso();
      final cliente = ClienteApiFalso(
        sesionInicio: sesion,
        usuarioConsultado: sesion.usuario,
      );
      final controlador = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: almacen,
        rolesPermitidos: const {'SEGURIDAD'},
      );

      final resultado = await controlador.iniciarSesion(
        'PRUEBA-001',
        'Contrasena-ficticia-1!',
      );

      expect(resultado, isFalse);
      expect(controlador.estado, EstadoSesion.error);
      expect(cliente.cierresSesion, 1);
      expect(almacen.sesionGuardada, isNull);
    });
  });
}
