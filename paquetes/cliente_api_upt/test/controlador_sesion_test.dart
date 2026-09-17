import 'dart:async';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';

class AlmacenSesionFalso implements AlmacenSesion {
  AlmacenSesionFalso([this.sesionGuardada]);

  SesionUsuario? sesionGuardada;
  int limpiezas = 0;
  bool fallarLimpieza = false;

  @override
  Future<void> guardar(SesionUsuario sesion) async {
    sesionGuardada = sesion;
  }

  @override
  Future<void> limpiar() async {
    limpiezas += 1;
    if (fallarLimpieza) throw StateError('almacenamiento no disponible');
    sesionGuardada = null;
  }

  @override
  Future<SesionUsuario?> recuperar() async => sesionGuardada;
}

class ClienteApiFalso implements ContratoClienteApi {
  ClienteApiFalso({
    required this.sesionInicio,
    required this.usuarioConsultado,
  });

  SesionUsuario sesionInicio;
  UsuarioSesion usuarioConsultado;
  int consultasSesion = 0;
  int cierresSesion = 0;
  int renovaciones = 0;
  Completer<SesionUsuario>? renovacionControlada;
  Completer<UsuarioSesion>? consultaControlada;
  Completer<void>? cierreControlado;
  bool fallarCierre = false;

  @override
  Future<CaptchaIntranet> obtenerCaptchaIntranet() =>
      throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<PerfilIntranet> verificarIntranet({
    required String transaccionId,
    required String codigo,
    required String contrasena,
    required String captcha,
  }) => throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<InicioGoogleOauth> iniciarGoogle(String verificacionIntranetId) =>
      throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<EstadoGoogleOauth> consultarEstadoGoogle(String transaccionId) =>
      throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<void> cerrarSesion(String tokenAcceso) async {
    cierresSesion += 1;
    if (fallarCierre) {
      throw const ExcepcionApi(
        codigo: 'ERROR_CONEXION',
        mensaje: 'Sin conexión.',
      );
    }
    await cierreControlado?.future;
  }

  @override
  Future<UsuarioSesion> consultarSesion(String tokenAcceso) async {
    consultasSesion += 1;
    return consultaControlada?.future ?? usuarioConsultado;
  }

  @override
  Future<SesionUsuario> iniciarSesion(
    String identificador,
    String contrasena,
  ) async => sesionInicio;

  @override
  Future<SesionUsuario> renovarSesion(String tokenRenovacion) {
    renovaciones += 1;
    return renovacionControlada?.future ?? Future.value(sesionInicio);
  }

  @override
  Future<IdentidadDigital> consultarIdentidadDigital(String tokenAcceso) =>
      throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<CodigoQrTemporal> generarCodigoQr(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  ) => throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<void> revocarCodigoQr(String tokenAcceso) =>
      throw UnsupportedError('Operación fuera del alcance de esta prueba.');

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

SesionUsuario crearSesionConVigencia({
  required DateTime ahora,
  required Duration vigenciaAcceso,
  String tokenAcceso = 'token-acceso-ficticio',
}) => SesionUsuario(
  tokenAcceso: tokenAcceso,
  tokenRenovacion: 'token-renovacion-ficticio',
  tokenAccesoExpiraEn: ahora.add(vigenciaAcceso),
  tokenRenovacionExpiraEn: ahora.add(const Duration(days: 1)),
  usuario: crearUsuario(['ESTUDIANTE']),
);

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

    test('comparte una sola restauración entre llamadas simultáneas', () async {
      final sesion = crearSesion(['ESTUDIANTE']);
      final cliente = ClienteApiFalso(
        sesionInicio: sesion,
        usuarioConsultado: sesion.usuario,
      )..consultaControlada = Completer<UsuarioSesion>();
      final controlador = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: AlmacenSesionFalso(sesion),
        rolesPermitidos: const {'ESTUDIANTE'},
      );
      addTearDown(controlador.dispose);

      final primera = controlador.restaurar();
      final segunda = controlador.restaurar();
      await Future<void>.delayed(Duration.zero);

      expect(cliente.consultasSesion, 1);
      cliente.consultaControlada!.complete(sesion.usuario);
      await Future.wait([primera, segunda]);
      expect(controlador.estaAutenticada, isTrue);
      expect(cliente.cierresSesion, 0);
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

    test(
      'adopta y guarda una sesión creada por identidad verificada',
      () async {
        final sesion = crearSesion(['ESTUDIANTE']);
        final almacen = AlmacenSesionFalso();
        final cliente = ClienteApiFalso(
          sesionInicio: sesion,
          usuarioConsultado: sesion.usuario,
        );
        final controlador = ControladorSesion(
          clienteApi: cliente,
          almacenSesion: almacen,
          rolesPermitidos: const {'ESTUDIANTE'},
        );

        expect(await controlador.adoptarSesionVerificada(sesion), isTrue);
        expect(controlador.estaAutenticada, isTrue);
        expect(almacen.sesionGuardada, same(sesion));
        expect(cliente.consultasSesion, 0);
      },
    );

    test(
      'comparte una sola renovación entre solicitudes simultáneas',
      () async {
        final ahora = DateTime.utc(2026, 9, 12, 15);
        final inicial = crearSesionConVigencia(
          ahora: ahora,
          vigenciaAcceso: const Duration(seconds: 10),
        );
        final renovada = crearSesionConVigencia(
          ahora: ahora,
          vigenciaAcceso: const Duration(minutes: 15),
          tokenAcceso: 'token-acceso-renovado',
        );
        final cliente = ClienteApiFalso(
          sesionInicio: inicial,
          usuarioConsultado: inicial.usuario,
        )..renovacionControlada = Completer<SesionUsuario>();
        final controlador = ControladorSesion(
          clienteApi: cliente,
          almacenSesion: AlmacenSesionFalso(),
          rolesPermitidos: const {'ESTUDIANTE'},
          ahora: () => ahora,
        );
        addTearDown(controlador.dispose);
        await controlador.iniciarSesion('PRUEBA-001', 'clave-de-prueba');

        final primera = controlador.obtenerTokenAcceso();
        final segunda = controlador.obtenerTokenAcceso();

        expect(cliente.renovaciones, 1);
        cliente.renovacionControlada!.complete(renovada);
        expect(await Future.wait([primera, segunda]), [
          'token-acceso-renovado',
          'token-acceso-renovado',
        ]);
        expect(controlador.estaAutenticada, isTrue);
      },
    );

    test('una renovación tardía no restaura una sesión cerrada', () async {
      final ahora = DateTime.utc(2026, 9, 12, 15);
      final inicial = crearSesionConVigencia(
        ahora: ahora,
        vigenciaAcceso: const Duration(seconds: 10),
      );
      final cliente = ClienteApiFalso(
        sesionInicio: inicial,
        usuarioConsultado: inicial.usuario,
      )..renovacionControlada = Completer<SesionUsuario>();
      final almacen = AlmacenSesionFalso();
      final controlador = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: almacen,
        rolesPermitidos: const {'ESTUDIANTE'},
        ahora: () => ahora,
      );
      addTearDown(controlador.dispose);
      await controlador.iniciarSesion('PRUEBA-001', 'clave-de-prueba');

      final renovacion = controlador.obtenerTokenAcceso();
      final errorRenovacion = expectLater(
        renovacion,
        throwsA(isA<ExcepcionApi>()),
      );
      await controlador.cerrarSesion();
      cliente.renovacionControlada!.complete(
        crearSesionConVigencia(
          ahora: ahora,
          vigenciaAcceso: const Duration(minutes: 15),
          tokenAcceso: 'token-tardio',
        ),
      );

      await errorRenovacion;
      expect(controlador.estaAutenticada, isFalse);
      expect(almacen.sesionGuardada, isNull);
    });

    test(
      'no declara cerrada la sesión si fallan revocación y borrado local',
      () async {
        final sesion = crearSesion(['ESTUDIANTE']);
        final almacen = AlmacenSesionFalso()..fallarLimpieza = true;
        final cliente = ClienteApiFalso(
          sesionInicio: sesion,
          usuarioConsultado: sesion.usuario,
        )..fallarCierre = true;
        final controlador = ControladorSesion(
          clienteApi: cliente,
          almacenSesion: almacen,
          rolesPermitidos: const {'ESTUDIANTE'},
        );
        addTearDown(controlador.dispose);
        await controlador.iniciarSesion('PRUEBA-001', 'clave-de-prueba');

        await controlador.cerrarSesion();

        expect(controlador.estaAutenticada, isTrue);
        expect(controlador.sesion, same(sesion));
        expect(controlador.mensajeError, contains('cerrar tu cuenta'));

        almacen.fallarLimpieza = false;
        cliente.fallarCierre = false;
        await controlador.cerrarSesion();
        expect(controlador.estaAutenticada, isFalse);
        expect(almacen.sesionGuardada, isNull);
      },
    );

    test('un cierre remoto tardío no borra un login posterior', () async {
      final inicial = crearSesion(['ESTUDIANTE']);
      final ahora = DateTime.now().toUtc();
      final nueva = crearSesionConVigencia(
        ahora: ahora,
        vigenciaAcceso: const Duration(minutes: 15),
        tokenAcceso: 'token-acceso-login-nuevo',
      );
      final almacen = AlmacenSesionFalso();
      final cliente = ClienteApiFalso(
        sesionInicio: inicial,
        usuarioConsultado: inicial.usuario,
      )..cierreControlado = Completer<void>();
      final controlador = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: almacen,
        rolesPermitidos: const {'ESTUDIANTE'},
      );
      addTearDown(controlador.dispose);
      await controlador.iniciarSesion('PRUEBA-001', 'clave-de-prueba');

      final cierreAnterior = controlador.cerrarSesion();
      cliente.sesionInicio = nueva;
      expect(
        await controlador.iniciarSesion('PRUEBA-001', 'clave-nueva'),
        isTrue,
      );
      expect(almacen.sesionGuardada, same(nueva));

      cliente.cierreControlado!.complete();
      await cierreAnterior;

      expect(controlador.sesion, same(nueva));
      expect(almacen.sesionGuardada, same(nueva));
      expect(controlador.estaAutenticada, isTrue);
    });

    test('usa el reloj inyectado para el umbral de renovación', () async {
      final ahora = DateTime.utc(2030, 1, 1, 12);
      final sesion = crearSesionConVigencia(
        ahora: ahora,
        vigenciaAcceso: const Duration(seconds: 31),
      );
      final cliente = ClienteApiFalso(
        sesionInicio: sesion,
        usuarioConsultado: sesion.usuario,
      );
      final controlador = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: AlmacenSesionFalso(),
        rolesPermitidos: const {'ESTUDIANTE'},
        ahora: () => ahora,
      );
      addTearDown(controlador.dispose);
      await controlador.iniciarSesion('PRUEBA-001', 'clave-de-prueba');

      expect(await controlador.obtenerTokenAcceso(), sesion.tokenAcceso);
      expect(cliente.renovaciones, 0);
    });
  });
}
