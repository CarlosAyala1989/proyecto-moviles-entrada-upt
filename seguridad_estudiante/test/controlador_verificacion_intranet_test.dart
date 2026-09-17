import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_estudiante/controladores/controlador_verificacion_intranet.dart';
import 'package:seguridad_estudiante/servicios/abridor_oauth.dart';

import 'ayudas/dobles_hito_10.dart';

class ClienteRegistroFalso extends ClientePortadorFalso {
  ClienteRegistroFalso()
    : super(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(DateTime.now().toUtc()),
      );

  @override
  Future<CaptchaIntranet> obtenerCaptchaIntranet() async => CaptchaIntranet(
    transaccionId: '0664b410-145e-4ef3-8d98-1055d8d57ee9',
    imagenBase64: 'AQID',
    tipoImagen: 'image/png',
    expiraEn: DateTime.now().toUtc().add(const Duration(minutes: 5)),
  );

  @override
  Future<PerfilIntranet> verificarIntranet({
    required String transaccionId,
    required String codigo,
    required String contrasena,
    required String captcha,
  }) async => PerfilIntranet(
    codigo: codigo,
    nombreApellidos: 'AYALA RAMOS, CARLOS DANIEL',
    verificacionId: '8bcdbcea-0682-4c77-a828-21855d6bcdfa',
    verificacionExpiraEn: DateTime.now().toUtc().add(
      const Duration(minutes: 10),
    ),
  );

  @override
  Future<InicioGoogleOauth> iniciarGoogle(String verificacionIntranetId) async {
    return InicioGoogleOauth(
      transaccionId: '70f998ec-088d-4966-8b7a-dd8a76a07560',
      urlAutorizacion: Uri.parse(
        'https://accounts.google.com/o/oauth2/v2/auth',
      ),
      expiraEn: DateTime.now().toUtc().add(const Duration(minutes: 10)),
    );
  }

  @override
  Future<EstadoGoogleOauth> consultarEstadoGoogle(String transaccionId) async {
    return EstadoGoogleOauth(estado: 'COMPLETA', sesion: sesion);
  }
}

class AbridorRegistroFalso implements AbridorOauth {
  Uri? url;

  @override
  Future<bool> abrir(Uri url) async {
    this.url = url;
    return true;
  }
}

void main() {
  test('completa intranet, Google y adopta la sesión emitida', () async {
    final cliente = ClienteRegistroFalso();
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'ESTUDIANTE'},
    );
    final abridor = AbridorRegistroFalso();
    final controlador = ControladorVerificacionIntranet(
      clienteApi: cliente,
      controladorSesion: sesion,
      abridorOauth: abridor,
      esperar: (_) async {},
    );

    await controlador.cargarCaptcha();
    await controlador.verificar(
      codigo: '2022074266',
      contrasena: '123456',
      textoCaptcha: '3868',
    );
    await controlador.iniciarGoogle();

    expect(abridor.url?.host, 'accounts.google.com');
    expect(sesion.estaAutenticada, isTrue);
    expect(sesion.sesion, same(cliente.sesion));
    expect(controlador.mensajeError, isNull);
    controlador.dispose();
    sesion.dispose();
  });
}
