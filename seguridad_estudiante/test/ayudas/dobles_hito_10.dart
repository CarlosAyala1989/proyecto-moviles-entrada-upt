import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:seguridad_estudiante/servicios/proveedor_ubicacion.dart';

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

class ClientePortadorFalso implements ContratoClienteApi {
  ClientePortadorFalso({required this.identidad, required this.codigoQr});

  final IdentidadDigital identidad;
  final CodigoQrTemporal codigoQr;
  UbicacionReportada? ubicacionRecibida;
  int consultasIdentidad = 0;
  int generacionesQr = 0;
  int revocacionesQr = 0;

  final SesionUsuario sesion = crearSesionPortador();

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
  Future<IdentidadDigital> consultarIdentidadDigital(String tokenAcceso) async {
    consultasIdentidad += 1;
    return identidad;
  }

  @override
  Future<List<RegistroIngresoReciente>> consultarIngresosRecientes(
    String tokenAcceso, {
    int limite = 20,
    UbicacionReportada? ubicacion,
  }) => throw UnsupportedError('Operación fuera del alcance de esta prueba.');

  @override
  Future<UsuarioSesion> consultarSesion(String tokenAcceso) async =>
      sesion.usuario;

  @override
  Future<CodigoQrTemporal> generarCodigoQr(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  ) async {
    generacionesQr += 1;
    ubicacionRecibida = ubicacion;
    return codigoQr;
  }

  @override
  Future<SesionUsuario> iniciarSesion(
    String identificador,
    String contrasena,
  ) async => sesion;

  @override
  Future<SesionUsuario> renovarSesion(String tokenRenovacion) async => sesion;

  @override
  Future<void> revocarCodigoQr(String tokenAcceso) async {
    revocacionesQr += 1;
  }

  @override
  Future<ResultadoValidacionIngreso> validarIngreso({
    required String tokenAcceso,
    required String codigoQr,
    required String puntoAccesoCodigo,
    required UbicacionReportada ubicacion,
  }) => throw UnsupportedError('Operación fuera del alcance de esta prueba.');
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

UsuarioSesion crearUsuarioPortador() => const UsuarioSesion(
  id: 10,
  codigoInstitucional: 'PRUEBA-EST-001',
  correoInstitucional: 'estudiante@example.invalid',
  nombres: 'María Elena',
  apellidos: 'Pérez Quispe',
  roles: ['ESTUDIANTE'],
);

SesionUsuario crearSesionPortador() {
  final ahora = DateTime.now().toUtc();
  return SesionUsuario(
    tokenAcceso: 'token-acceso-prueba',
    tokenRenovacion: 'token-renovacion-prueba',
    tokenAccesoExpiraEn: ahora.add(const Duration(days: 1)),
    tokenRenovacionExpiraEn: ahora.add(const Duration(days: 7)),
    usuario: crearUsuarioPortador(),
  );
}

IdentidadDigital crearIdentidadPortador({bool puedeSolicitar = true}) =>
    IdentidadDigital(
      id: 10,
      codigoInstitucional: 'PRUEBA-EST-001',
      correoInstitucional: 'estudiante@example.invalid',
      nombreCompleto: 'María Elena Pérez Quispe',
      fotoUrl: null,
      roles: const ['ESTUDIANTE'],
      estadoVerificacion: 'VERIFICADA',
      estadoUsuario: 'ACTIVO',
      estadoAutorizacion: 'AUTORIZADO',
      puedeSolicitarCodigoQr: puedeSolicitar,
      perfilAcademico: const PerfilAcademico(
        escuela: 'Ingeniería de Sistemas',
        facultad: 'Ingeniería',
        estadoAcademico: 'REGULAR',
        periodoAcademico: '2026-II',
      ),
    );

UbicacionReportada crearUbicacion() => UbicacionReportada(
  latitud: -18.013,
  longitud: -70.251,
  precisionMetros: 12,
  obtenidaEn: DateTime.utc(2026, 9, 12, 15),
);

CodigoQrTemporal crearCodigoQr(DateTime ahora) => CodigoQrTemporal(
  codigoQr: 'upt_qr_v1.credencial-opaca-de-prueba',
  estado: 'PENDIENTE',
  emitidaEn: ahora,
  expiraEn: ahora.add(const Duration(seconds: 15)),
  duracionSegundos: 15,
  unSoloUso: true,
  puntoAccesoCodigo: 'PRUEBA-LOCAL',
  puntoAccesoNombre: 'Puerta principal',
);
