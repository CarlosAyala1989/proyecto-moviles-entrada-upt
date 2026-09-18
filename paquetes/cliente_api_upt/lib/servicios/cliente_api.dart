import 'contratos_operacion.dart';
import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../configuracion/configuracion_api.dart';
import '../modelos/codigo_qr_temporal.dart';
import '../modelos/captcha_intranet.dart';
import '../modelos/estado_google_oauth.dart';
import '../modelos/identidad_digital.dart';
import '../modelos/inicio_google_oauth.dart';
import '../modelos/registro_ingreso_reciente.dart';
import '../modelos/perfil_intranet.dart';
import '../modelos/resultado_validacion_ingreso.dart';
import '../modelos/sesion_usuario.dart';
import '../modelos/ubicacion_reportada.dart';
import '../modelos/usuario_sesion.dart';
import 'contrato_cliente_api.dart';
import 'excepcion_api.dart';

class ClienteApi
    implements
        ContratoClienteApi,
        ContratoControlSeguridad,
        ContratoAdministracion {
  ClienteApi({
    String urlBase = ConfiguracionApi.urlBase,
    http.Client? clienteHttp,
    Duration tiempoEspera = ConfiguracionApi.duracionMaximaSolicitud,
  }) : _urlBase = urlBase.replaceFirst(RegExp(r'/+$'), ''),
       _clienteHttp = clienteHttp ?? http.Client(),
       _tiempoEspera = tiempoEspera;

  final String _urlBase;
  final http.Client _clienteHttp;
  final Duration _tiempoEspera;

  Duration get tiempoEspera => _tiempoEspera;

  Uri _construirUri(String ruta, [Map<String, String>? consulta]) {
    final uri = Uri.parse('$_urlBase$ruta');
    return consulta == null ? uri : uri.replace(queryParameters: consulta);
  }

  Map<String, String> _cabeceras({
    String? tokenAcceso,
    bool conCuerpo = false,
  }) {
    return {
      'accept': 'application/json',
      if (conCuerpo) 'content-type': 'application/json',
      if (tokenAcceso != null) 'authorization': 'Bearer $tokenAcceso',
    };
  }

  Future<Map<String, dynamic>> _solicitar({
    required String metodo,
    required String ruta,
    String? tokenAcceso,
    Map<String, dynamic>? cuerpo,
    Map<String, String>? consulta,
    Duration? tiempoEspera,
  }) async {
    final limiteEspera = tiempoEspera ?? _tiempoEspera;
    try {
      final solicitud = http.Request(metodo, _construirUri(ruta, consulta));
      solicitud.headers.addAll(
        _cabeceras(tokenAcceso: tokenAcceso, conCuerpo: cuerpo != null),
      );
      if (cuerpo != null) solicitud.body = jsonEncode(cuerpo);
      final transmitida = await _clienteHttp
          .send(solicitud)
          .timeout(limiteEspera);
      final respuesta = await http.Response.fromStream(
        transmitida,
      ).timeout(limiteEspera);
      final contenido = utf8.decode(respuesta.bodyBytes);
      final json = contenido.isEmpty
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(jsonDecode(contenido) as Map);

      if (respuesta.statusCode < 200 || respuesta.statusCode >= 300) {
        final error = json['error'];
        final errorJson = error is Map
            ? Map<String, dynamic>.from(error)
            : <String, dynamic>{};
        throw ExcepcionApi(
          codigo: errorJson['codigo'] as String? ?? 'ERROR_API',
          mensaje:
              errorJson['mensaje'] as String? ??
              'No pudimos completar esta acción.',
          estadoHttp: respuesta.statusCode,
        );
      }
      return json;
    } on ExcepcionApi {
      rethrow;
    } on TimeoutException {
      throw const ExcepcionApi(
        codigo: 'TIEMPO_ESPERA_AGOTADO',
        mensaje: 'Esto está tardando más de lo esperado.',
      );
    } on http.ClientException {
      throw const ExcepcionApi(
        codigo: 'ERROR_CONEXION',
        mensaje: 'No pudimos comunicarnos con el servicio.',
      );
    } on FormatException {
      throw const ExcepcionApi(
        codigo: 'RESPUESTA_INVALIDA',
        mensaje: 'Recibimos una respuesta inesperada.',
      );
    }
  }

  Map<String, dynamic> _datos(Map<String, dynamic> respuesta) {
    return Map<String, dynamic>.from(respuesta['datos'] as Map);
  }

  @override
  Future<CaptchaIntranet> obtenerCaptchaIntranet() async {
    final respuesta = await _solicitar(
      metodo: 'GET',
      ruta: '/registro-estudiante/intranet/captcha',
      tiempoEspera: ConfiguracionApi.duracionMaximaCaptchaIntranet,
    );
    return CaptchaIntranet.desdeJson(_datos(respuesta));
  }

  @override
  Future<PerfilIntranet> verificarIntranet({
    required String transaccionId,
    required String codigo,
    required String contrasena,
    required String captcha,
  }) async {
    final respuesta = await _solicitar(
      metodo: 'POST',
      ruta: '/registro-estudiante/intranet/verificar',
      cuerpo: {
        'transaccion_id': transaccionId,
        'codigo': codigo,
        'contrasena': contrasena,
        'captcha': captcha,
      },
      tiempoEspera: ConfiguracionApi.duracionMaximaVerificacionIntranet,
    );
    return PerfilIntranet.desdeJson(_datos(respuesta));
  }

  @override
  Future<InicioGoogleOauth> iniciarGoogle(String verificacionIntranetId) async {
    final respuesta = await _solicitar(
      metodo: 'POST',
      ruta: '/registro-estudiante/google/iniciar',
      cuerpo: {'verificacion_intranet_id': verificacionIntranetId},
    );
    return InicioGoogleOauth.desdeJson(_datos(respuesta));
  }

  @override
  Future<EstadoGoogleOauth> consultarEstadoGoogle(String transaccionId) async {
    final respuesta = await _solicitar(
      metodo: 'GET',
      ruta: '/registro-estudiante/google/estado/$transaccionId',
    );
    return EstadoGoogleOauth.desdeJson(_datos(respuesta));
  }

  @override
  Future<SesionUsuario> iniciarSesion(
    String identificador,
    String contrasena,
  ) async {
    final respuesta = await _solicitar(
      metodo: 'POST',
      ruta: '/autenticacion/iniciar-sesion',
      cuerpo: {'identificador': identificador, 'contrasena': contrasena},
    );
    return SesionUsuario.desdeJson(_datos(respuesta));
  }

  @override
  Future<SesionUsuario> renovarSesion(String tokenRenovacion) async {
    final respuesta = await _solicitar(
      metodo: 'POST',
      ruta: '/autenticacion/renovar-sesion',
      cuerpo: {'token_renovacion': tokenRenovacion},
    );
    return SesionUsuario.desdeJson(_datos(respuesta));
  }

  @override
  Future<UsuarioSesion> consultarSesion(String tokenAcceso) async {
    final respuesta = await _solicitar(
      metodo: 'GET',
      ruta: '/autenticacion/sesion',
      tokenAcceso: tokenAcceso,
    );
    final datos = _datos(respuesta);
    return UsuarioSesion.desdeJson(
      Map<String, dynamic>.from(datos['usuario'] as Map),
    );
  }

  @override
  Future<void> cerrarSesion(String tokenAcceso) async {
    await _solicitar(
      metodo: 'POST',
      ruta: '/autenticacion/cerrar-sesion',
      tokenAcceso: tokenAcceso,
    );
  }

  @override
  Future<IdentidadDigital> consultarIdentidadDigital(String tokenAcceso) async {
    final respuesta = await _solicitar(
      metodo: 'GET',
      ruta: '/identidad-digital',
      tokenAcceso: tokenAcceso,
    );
    return IdentidadDigital.desdeJson(_datos(respuesta));
  }

  @override
  Future<CodigoQrTemporal> generarCodigoQr(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  ) async {
    final respuesta = await _solicitar(
      metodo: 'POST',
      ruta: '/codigos-qr',
      tokenAcceso: tokenAcceso,
      cuerpo: {'ubicacion': ubicacion.aJson()},
    );
    return CodigoQrTemporal.desdeJson(_datos(respuesta));
  }

  @override
  Future<void> revocarCodigoQr(String tokenAcceso) async {
    await _solicitar(
      metodo: 'DELETE',
      ruta: '/codigos-qr/actual',
      tokenAcceso: tokenAcceso,
    );
  }

  @override
  Future<ResultadoValidacionIngreso> validarIngreso({
    required String tokenAcceso,
    required String codigoQr,
    required String puntoAccesoCodigo,
    required UbicacionReportada ubicacion,
  }) async {
    final respuesta = await _solicitar(
      metodo: 'POST',
      ruta: '/ingresos/validar',
      tokenAcceso: tokenAcceso,
      cuerpo: {
        'codigo_qr': codigoQr,
        'punto_acceso_codigo': puntoAccesoCodigo,
        'ubicacion': ubicacion.aJson(),
      },
    );
    return ResultadoValidacionIngreso.desdeJson(_datos(respuesta));
  }

  @override
  Future<List<RegistroIngresoReciente>> consultarIngresosRecientes(
    String tokenAcceso, {
    int limite = 20,
    UbicacionReportada? ubicacion,
  }) async {
    final respuesta = await _solicitar(
      metodo: 'GET',
      ruta: '/ingresos/recientes',
      tokenAcceso: tokenAcceso,
      consulta: {
        'limite': '$limite',
        if (ubicacion != null)
          ...ubicacion.aJson().map((clave, valor) => MapEntry(clave, '$valor')),
      },
    );
    final datos = respuesta['datos'] as List<dynamic>;
    return datos
        .map(
          (json) => RegistroIngresoReciente.desdeJson(
            Map<String, dynamic>.from(json as Map),
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<Map<String, dynamic>> comprobarUbicacionSeguridad(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  ) async => _datos(
    await _solicitar(
      metodo: 'POST',
      ruta: '/seguridad/comprobar-ubicacion',
      tokenAcceso: tokenAcceso,
      cuerpo: {'ubicacion': ubicacion.aJson()},
    ),
  );

  @override
  Future<List<Map<String, dynamic>>> consultarPuertas(
    String tokenAcceso,
  ) async {
    final respuesta = await _solicitar(
      metodo: 'GET',
      ruta: '/administracion/puntos-acceso',
      tokenAcceso: tokenAcceso,
      consulta: {'limite': '100'},
    );
    return List<Map<String, dynamic>>.from(respuesta['datos'] as List);
  }

  @override
  Future<void> guardarPuerta(
    String tokenAcceso,
    Map<String, dynamic> datos, {
    int? id,
  }) async {
    await _solicitar(
      metodo: id == null ? 'POST' : 'PATCH',
      ruta: '/administracion/puntos-acceso${id == null ? '' : '/$id'}',
      tokenAcceso: tokenAcceso,
      cuerpo: datos,
    );
  }

  @override
  Future<List<Map<String, dynamic>>> consultarGuardias(
    String tokenAcceso,
  ) async {
    final respuesta = await _solicitar(
      metodo: 'GET',
      ruta: '/administracion/guardias',
      tokenAcceso: tokenAcceso,
    );
    return List<Map<String, dynamic>>.from(respuesta['datos'] as List);
  }

  @override
  Future<void> guardarGuardia(
    String tokenAcceso,
    Map<String, dynamic> datos, {
    int? id,
  }) async {
    await _solicitar(
      metodo: id == null ? 'POST' : 'PUT',
      ruta: '/administracion/guardias${id == null ? '' : '/$id'}',
      tokenAcceso: tokenAcceso,
      cuerpo: datos,
    );
  }

  void cerrarCliente() => _clienteHttp.close();
}
