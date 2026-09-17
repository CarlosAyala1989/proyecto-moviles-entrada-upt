import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:seguridad_verificador/servicios/proveedor_ubicacion.dart';

class AlmacenSesionFalso implements AlmacenSesion {
  SesionUsuario? sesion;

  @override
  Future<void> guardar(SesionUsuario sesion) async {
    this.sesion = sesion;
  }

  @override
  Future<void> limpiar() async {
    sesion = null;
  }

  @override
  Future<SesionUsuario?> recuperar() async => sesion;
}

class ClienteSeguridadFalso implements ContratoClienteApi {
  ClienteSeguridadFalso({
    required this.resultadoValidacion,
    this.registros = const [],
  });

  final ResultadoValidacionIngreso resultadoValidacion;
  final List<RegistroIngresoReciente> registros;
  final SesionUsuario sesion = crearSesionSeguridad();

  int validaciones = 0;
  int consultasHistorial = 0;
  String? codigoQrRecibido;
  String? puntoAccesoRecibido;
  UbicacionReportada? ubicacionRecibida;

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
  Future<void> cerrarSesion(String tokenAcceso) async {}

  @override
  Future<IdentidadDigital> consultarIdentidadDigital(String tokenAcceso) =>
      throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<List<RegistroIngresoReciente>> consultarIngresosRecientes(
    String tokenAcceso, {
    int limite = 20,
  }) async {
    consultasHistorial += 1;
    return registros.take(limite).toList(growable: false);
  }

  @override
  Future<UsuarioSesion> consultarSesion(String tokenAcceso) async =>
      sesion.usuario;

  @override
  Future<CodigoQrTemporal> generarCodigoQr(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  ) => throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<SesionUsuario> iniciarSesion(
    String identificador,
    String contrasena,
  ) async => sesion;

  @override
  Future<SesionUsuario> renovarSesion(String tokenRenovacion) async => sesion;

  @override
  Future<void> revocarCodigoQr(String tokenAcceso) =>
      throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<ResultadoValidacionIngreso> validarIngreso({
    required String tokenAcceso,
    required String codigoQr,
    required String puntoAccesoCodigo,
    required UbicacionReportada ubicacion,
  }) async {
    validaciones += 1;
    codigoQrRecibido = codigoQr;
    puntoAccesoRecibido = puntoAccesoCodigo;
    ubicacionRecibida = ubicacion;
    return resultadoValidacion;
  }
}

class ProveedorUbicacionFalso implements ProveedorUbicacion {
  ProveedorUbicacionFalso({required this.ubicacion, this.error});

  final UbicacionReportada ubicacion;
  final ExcepcionUbicacion? error;
  int solicitudes = 0;

  @override
  Future<UbicacionReportada> obtenerUbicacionActual() async {
    solicitudes += 1;
    if (error != null) throw error!;
    return ubicacion;
  }
}

UsuarioSesion crearUsuarioSeguridad() => const UsuarioSesion(
  id: 20,
  codigoInstitucional: 'PRUEBA-SEG-001',
  correoInstitucional: 'seguridad@example.invalid',
  nombres: 'Personal',
  apellidos: 'De Seguridad',
  roles: ['SEGURIDAD'],
);

SesionUsuario crearSesionSeguridad() {
  final ahora = DateTime.now().toUtc();
  return SesionUsuario(
    tokenAcceso: 'token-acceso-seguridad',
    tokenRenovacion: 'token-renovacion-seguridad',
    tokenAccesoExpiraEn: ahora.add(const Duration(days: 1)),
    tokenRenovacionExpiraEn: ahora.add(const Duration(days: 7)),
    usuario: crearUsuarioSeguridad(),
  );
}

UbicacionReportada crearUbicacion() => UbicacionReportada(
  latitud: -18.013,
  longitud: -70.251,
  precisionMetros: 10,
  obtenidaEn: DateTime.now().toUtc(),
);

ResultadoValidacionIngreso crearResultadoAutorizado() =>
    ResultadoValidacionIngreso(
      resultado: 'AUTORIZADO',
      motivo: 'ACCESO_AUTORIZADO',
      mensaje: 'Ingreso autorizado.',
      registradoEn: DateTime.utc(2026, 9, 12, 15),
      puntoAccesoCodigo: 'PRUEBA-LOCAL',
      puntoAccesoNombre: 'Puerta principal',
      identidad: const IdentidadIngreso(
        fotoUrl: null,
        nombreCompleto: 'María Elena Pérez Quispe',
        codigoInstitucional: 'PRUEBA-EST-001',
        tiposUsuario: ['ESTUDIANTE'],
        escuela: 'Ingeniería de Sistemas',
        estadoAcademico: 'REGULAR',
      ),
    );

ResultadoValidacionIngreso crearResultadoDenegado() =>
    ResultadoValidacionIngreso(
      resultado: 'DENEGADO',
      motivo: 'CREDENCIAL_YA_UTILIZADA',
      mensaje: 'El código QR ya fue utilizado.',
      registradoEn: DateTime.utc(2026, 9, 12, 15, 1),
      puntoAccesoCodigo: 'PRUEBA-LOCAL',
      puntoAccesoNombre: 'Puerta principal',
      identidad: null,
    );

List<RegistroIngresoReciente> crearHistorial() => [
  RegistroIngresoReciente(
    id: 2,
    resultado: 'DENEGADO',
    motivo: 'CREDENCIAL_YA_UTILIZADA',
    registradoEn: DateTime.utc(2026, 9, 12, 15, 1),
    puntoAccesoCodigo: 'PRUEBA-LOCAL',
    puntoAccesoNombre: 'Puerta principal',
    codigoInstitucional: null,
    nombreCompleto: null,
  ),
  RegistroIngresoReciente(
    id: 1,
    resultado: 'AUTORIZADO',
    motivo: 'ACCESO_AUTORIZADO',
    registradoEn: DateTime.utc(2026, 9, 12, 15),
    puntoAccesoCodigo: 'PRUEBA-LOCAL',
    puntoAccesoNombre: 'Puerta principal',
    codigoInstitucional: 'PRUEBA-EST-001',
    nombreCompleto: 'María Elena Pérez Quispe',
  ),
];
