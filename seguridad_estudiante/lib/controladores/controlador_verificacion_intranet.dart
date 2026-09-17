import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/foundation.dart';

import '../servicios/abridor_oauth.dart';

class ControladorVerificacionIntranet extends ChangeNotifier {
  ControladorVerificacionIntranet({
    required ContratoClienteApi clienteApi,
    required ControladorSesion controladorSesion,
    required AbridorOauth abridorOauth,
    Future<void> Function(Duration)? esperar,
    DateTime Function()? ahora,
  }) : _clienteApi = clienteApi,
       _controladorSesion = controladorSesion,
       _abridorOauth = abridorOauth,
       _esperar = esperar ?? Future<void>.delayed,
       _ahora = ahora ?? DateTime.now;

  final ContratoClienteApi _clienteApi;
  final ControladorSesion _controladorSesion;
  final AbridorOauth _abridorOauth;
  final Future<void> Function(Duration) _esperar;
  final DateTime Function() _ahora;
  CaptchaIntranet? captcha;
  PerfilIntranet? perfil;
  String? mensajeError;
  String? mensajeEstado;
  bool estaProcesando = false;
  bool _eliminado = false;

  void _notificar() {
    if (!_eliminado) notifyListeners();
  }

  Future<void> cargarCaptcha() async {
    if (estaProcesando || _eliminado) return;
    estaProcesando = true;
    mensajeError = null;
    mensajeEstado = null;
    perfil = null;
    _notificar();
    try {
      captcha = await _clienteApi.obtenerCaptchaIntranet();
    } on ExcepcionApi catch (error) {
      mensajeError = error.mensajeParaUsuario;
    } finally {
      estaProcesando = false;
      _notificar();
    }
  }

  Future<void> verificar({
    required String codigo,
    required String contrasena,
    required String textoCaptcha,
  }) async {
    final transaccionId = captcha?.transaccionId;
    if (transaccionId == null) {
      mensajeError = 'Primero carga la imagen e ingresa el número que aparece.';
      _notificar();
      return;
    }
    estaProcesando = true;
    mensajeError = null;
    mensajeEstado = null;
    perfil = null;
    _notificar();
    try {
      perfil = await _clienteApi.verificarIntranet(
        transaccionId: transaccionId,
        codigo: codigo,
        contrasena: contrasena,
        captcha: textoCaptcha,
      );
    } on ExcepcionApi catch (error) {
      mensajeError = error.mensajeParaUsuario;
      // La API consume la transacción antes de enviarla a la intranet, incluso
      // si el CAPTCHA o las credenciales fallan. Nunca se reutiliza una imagen.
      captcha = null;
    } finally {
      estaProcesando = false;
      _notificar();
    }
  }

  Future<void> iniciarGoogle() async {
    final verificacion = perfil;
    if (verificacion == null || estaProcesando || _eliminado) return;
    estaProcesando = true;
    mensajeError = null;
    mensajeEstado = 'Abriendo Google en el navegador…';
    _notificar();
    try {
      final inicio = await _clienteApi.iniciarGoogle(
        verificacion.verificacionId,
      );
      final abierto = await _abridorOauth.abrir(inicio.urlAutorizacion);
      if (!abierto) {
        throw const ExcepcionApi(
          codigo: 'NAVEGADOR_NO_DISPONIBLE',
          mensaje: 'No se pudo abrir el navegador para acceder a Google.',
        );
      }
      mensajeEstado =
          'Completa el acceso con tu cuenta @virtual.upt.pe en el navegador.';
      _notificar();

      while (!_eliminado && _ahora().isBefore(inicio.expiraEn)) {
        await _esperar(const Duration(seconds: 2));
        if (_eliminado) return;
        final estado = await _clienteApi.consultarEstadoGoogle(
          inicio.transaccionId,
        );
        if (estado.estaPendiente) continue;
        if (estado.tieneError) {
          mensajeError = mensajeErrorParaUsuario(
            estado.codigoError ?? 'GOOGLE_OAUTH_NO_COMPLETADO',
          );
          return;
        }
        if (estado.estaCompleta) {
          final aceptada = await _controladorSesion.adoptarSesionVerificada(
            estado.sesion!,
          );
          if (!aceptada) {
            mensajeError =
                _controladorSesion.mensajeError ??
                'Confirmamos tu identidad, pero no pudimos abrir tu cuenta. Inténtalo nuevamente.';
          }
          return;
        }
        mensajeError =
            'Google no terminó la comprobación como esperábamos. Vuelve a intentarlo.';
        return;
      }
      if (!_eliminado) {
        mensajeError =
            'Se acabó el tiempo para ingresar con Google. Vuelve a comenzar.';
      }
    } on ExcepcionApi catch (error) {
      mensajeError = error.mensajeParaUsuario;
    } catch (_) {
      mensajeError =
          'No pudimos abrir el acceso con Google. Revisa tu conexión e inténtalo nuevamente.';
    } finally {
      estaProcesando = false;
      mensajeEstado = null;
      _notificar();
    }
  }

  @override
  void dispose() {
    _eliminado = true;
    super.dispose();
  }
}
