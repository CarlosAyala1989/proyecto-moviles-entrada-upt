import 'package:flutter/foundation.dart';

import '../modelos/sesion_usuario.dart';
import '../servicios/contrato_cliente_api.dart';
import '../servicios/excepcion_api.dart';
import '../utilidades/mensajes_usuario.dart';
import 'almacen_sesion.dart';

enum EstadoSesion {
  restaurando,
  noAutenticada,
  autenticando,
  autenticada,
  cerrando,
  error,
}

class ControladorSesion extends ChangeNotifier {
  ControladorSesion({
    required ContratoClienteApi clienteApi,
    required AlmacenSesion almacenSesion,
    required Set<String> rolesPermitidos,
    DateTime Function()? ahora,
  }) : _clienteApi = clienteApi,
       _almacenSesion = almacenSesion,
       _rolesPermitidos = Set.unmodifiable(rolesPermitidos),
       _ahora = ahora ?? DateTime.now;

  final ContratoClienteApi _clienteApi;
  final AlmacenSesion _almacenSesion;
  final Set<String> _rolesPermitidos;
  final DateTime Function() _ahora;
  Future<void> _colaAlmacen = Future<void>.value();
  Future<void>? _restauracionPendiente;
  ({int revision, Future<String> resultado})? _renovacionPendiente;
  EstadoSesion _estado = EstadoSesion.restaurando;
  SesionUsuario? _sesion;
  String? _mensajeError;
  int _revisionAutenticacion = 0;

  EstadoSesion get estado => _estado;
  SesionUsuario? get sesion => _sesion;
  String? get mensajeError => _mensajeError;
  int get revisionAutenticacion => _revisionAutenticacion;
  bool get estaAutenticada => _estado == EstadoSesion.autenticada;
  bool get estaProcesando => {
    EstadoSesion.restaurando,
    EstadoSesion.autenticando,
    EstadoSesion.cerrando,
  }.contains(_estado);

  bool _tieneRolPermitido(SesionUsuario sesion) {
    return sesion.usuario.roles.any(_rolesPermitidos.contains);
  }

  Future<void> restaurar() {
    final activa = _restauracionPendiente;
    if (activa != null) return activa;

    late final Future<void> resultado;
    resultado = _restaurar().whenComplete(() {
      if (identical(_restauracionPendiente, resultado)) {
        _restauracionPendiente = null;
      }
    });
    _restauracionPendiente = resultado;
    return resultado;
  }

  Future<void> _restaurar() async {
    final revision = ++_revisionAutenticacion;
    _renovacionPendiente = null;
    _sesion = null;
    _cambiarEstado(EstadoSesion.restaurando);
    SesionUsuario? recuperada;
    try {
      recuperada = await _almacenSesion.recuperar();
      if (!_revisionVigente(revision)) return;
      final ahora = _ahora();
      if (recuperada == null || recuperada.renovacionVencida(ahora)) {
        await _descartarSesion(siRevision: revision);
        return;
      }
      if (recuperada.accesoRequiereRenovacion(ahora)) {
        recuperada = await _clienteApi.renovarSesion(
          recuperada.tokenRenovacion,
        );
      } else {
        final usuarioActualizado = await _clienteApi.consultarSesion(
          recuperada.tokenAcceso,
        );
        recuperada = recuperada.conUsuario(usuarioActualizado);
      }
      if (!_revisionVigente(revision)) {
        await _cerrarRemotaSinFallar(recuperada.tokenAcceso);
        return;
      }
      if (!_tieneRolPermitido(recuperada)) {
        await _cerrarRemotaSinFallar(recuperada.tokenAcceso);
        await _descartarSesion(siRevision: revision);
        return;
      }
      await _guardarSesion(recuperada);
      if (!_revisionVigente(revision)) {
        await _cerrarRemotaSinFallar(recuperada.tokenAcceso);
        return;
      }
      _sesion = recuperada;
      _cambiarEstado(EstadoSesion.autenticada);
    } on ExcepcionApi {
      if (_revisionVigente(revision)) {
        await _descartarSesion(siRevision: revision);
      }
    } catch (_) {
      if (_revisionVigente(revision)) {
        await _descartarSesion(siRevision: revision);
      }
    }
  }

  Future<bool> iniciarSesion(String identificador, String contrasena) async {
    final revision = ++_revisionAutenticacion;
    _renovacionPendiente = null;
    _sesion = null;
    _mensajeError = null;
    _cambiarEstado(EstadoSesion.autenticando);
    SesionUsuario? nuevaSesion;
    try {
      nuevaSesion = await _clienteApi.iniciarSesion(identificador, contrasena);
      if (!_revisionVigente(revision)) {
        await _cerrarRemotaSinFallar(nuevaSesion.tokenAcceso);
        return false;
      }
      if (!_tieneRolPermitido(nuevaSesion)) {
        await _cerrarRemotaSinFallar(nuevaSesion.tokenAcceso);
        throw const ExcepcionApi(
          codigo: 'ROL_APLICACION_NO_AUTORIZADO',
          mensaje: 'Esta cuenta no está habilitada para usar esta aplicación.',
          estadoHttp: 403,
        );
      }
      await _guardarSesion(nuevaSesion);
      if (!_revisionVigente(revision)) {
        await _cerrarRemotaSinFallar(nuevaSesion.tokenAcceso);
        return false;
      }
      _sesion = nuevaSesion;
      _cambiarEstado(EstadoSesion.autenticada);
      return true;
    } on ExcepcionApi catch (error) {
      if (!_revisionVigente(revision)) return false;
      await _limpiarAlmacen();
      _mensajeError = error.mensajeParaUsuario;
      _sesion = null;
      _cambiarEstado(EstadoSesion.error);
      return false;
    } catch (_) {
      if (!_revisionVigente(revision)) return false;
      await _limpiarAlmacen();
      _mensajeError =
          'No pudimos abrir tu cuenta. Revisa tu conexión e inténtalo nuevamente.';
      _sesion = null;
      _cambiarEstado(EstadoSesion.error);
      return false;
    }
  }

  Future<bool> adoptarSesionVerificada(SesionUsuario nuevaSesion) async {
    final revision = ++_revisionAutenticacion;
    _renovacionPendiente = null;
    _sesion = null;
    _mensajeError = null;
    _cambiarEstado(EstadoSesion.autenticando);
    try {
      if (!_tieneRolPermitido(nuevaSesion)) {
        await _cerrarRemotaSinFallar(nuevaSesion.tokenAcceso);
        throw const ExcepcionApi(
          codigo: 'ROL_APLICACION_NO_AUTORIZADO',
          mensaje: 'Esta cuenta no está habilitada para usar esta aplicación.',
          estadoHttp: 403,
        );
      }
      await _guardarSesion(nuevaSesion);
      if (!_revisionVigente(revision)) {
        await _cerrarRemotaSinFallar(nuevaSesion.tokenAcceso);
        return false;
      }
      _sesion = nuevaSesion;
      _cambiarEstado(EstadoSesion.autenticada);
      return true;
    } on ExcepcionApi catch (error) {
      if (!_revisionVigente(revision)) return false;
      await _limpiarAlmacen();
      _mensajeError = error.mensajeParaUsuario;
      _cambiarEstado(EstadoSesion.error);
      return false;
    } catch (_) {
      if (!_revisionVigente(revision)) return false;
      await _cerrarRemotaSinFallar(nuevaSesion.tokenAcceso);
      await _limpiarAlmacen();
      _mensajeError =
          'Confirmamos tu identidad, pero no pudimos abrir tu cuenta. Inténtalo nuevamente.';
      _cambiarEstado(EstadoSesion.error);
      return false;
    }
  }

  Future<String> obtenerTokenAcceso() async {
    final actual = _sesion;
    final revision = _revisionAutenticacion;
    final ahora = _ahora();
    if (actual == null || actual.renovacionVencida(ahora)) {
      await _descartarSesion(siRevision: revision);
      throw const ExcepcionApi(
        codigo: 'SESION_VENCIDA',
        mensaje: 'La sesión ha vencido. Inicia sesión nuevamente.',
        estadoHttp: 401,
      );
    }
    if (!actual.accesoRequiereRenovacion(ahora)) return actual.tokenAcceso;

    final activa = _renovacionPendiente;
    final resultado = activa != null && activa.revision == revision
        ? activa.resultado
        : _iniciarRenovacion(actual, revision);
    if (activa == null || activa.revision != revision) {
      _renovacionPendiente = (revision: revision, resultado: resultado);
    }
    try {
      return await resultado;
    } finally {
      if (identical(_renovacionPendiente?.resultado, resultado)) {
        _renovacionPendiente = null;
      }
    }
  }

  Future<void> cerrarSesion() async {
    final actual = _sesion;
    final revision = ++_revisionAutenticacion;
    _renovacionPendiente = null;
    _sesion = null;
    _mensajeError = null;
    _cambiarEstado(EstadoSesion.cerrando);
    // Se encola antes de esperar la red para que un login posterior se guarde
    // necesariamente después de esta limpieza.
    final limpieza = _limpiarAlmacen();
    var cierreRemotoCompletado = actual == null;
    try {
      if (actual != null) {
        await _clienteApi.cerrarSesion(actual.tokenAcceso);
        cierreRemotoCompletado = true;
      }
    } catch (_) {
      // El borrado local basta si el backend no está disponible.
    }
    final almacenamientoLimpio = await limpieza;
    if (!_revisionVigente(revision)) return;

    if (!cierreRemotoCompletado && !almacenamientoLimpio && actual != null) {
      _sesion = actual;
      _mensajeError =
          'No pudimos cerrar tu cuenta por completo. Inténtalo nuevamente.';
      _cambiarEstado(EstadoSesion.autenticada);
      return;
    }
    if (!almacenamientoLimpio) {
      _mensajeError =
          'Cerramos tu cuenta, pero quedaron datos pendientes por borrar en este dispositivo.';
    }
    _cambiarEstado(EstadoSesion.noAutenticada);
  }

  void limpiarError() {
    if (_estado != EstadoSesion.error) return;
    _mensajeError = null;
    _cambiarEstado(EstadoSesion.noAutenticada);
  }

  Future<String> _iniciarRenovacion(SesionUsuario actual, int revision) async {
    try {
      final renovada = await _clienteApi.renovarSesion(actual.tokenRenovacion);
      if (!_revisionVigente(revision) || !identical(_sesion, actual)) {
        await _cerrarRemotaSinFallar(renovada.tokenAcceso);
        throw const ExcepcionApi(
          codigo: 'SESION_CAMBIADA',
          mensaje: 'La cuenta abierta cambió. Vuelve a intentarlo.',
          estadoHttp: 401,
        );
      }
      if (!_tieneRolPermitido(renovada)) {
        await _cerrarRemotaSinFallar(renovada.tokenAcceso);
        await _descartarSesion(siRevision: revision);
        throw const ExcepcionApi(
          codigo: 'ROL_APLICACION_NO_AUTORIZADO',
          mensaje:
              'Esta cuenta ya no está habilitada para usar esta aplicación.',
          estadoHttp: 403,
        );
      }
      await _guardarSesion(renovada);
      if (!_revisionVigente(revision) || !identical(_sesion, actual)) {
        await _cerrarRemotaSinFallar(renovada.tokenAcceso);
        throw const ExcepcionApi(
          codigo: 'SESION_CAMBIADA',
          mensaje: 'La cuenta abierta cambió. Vuelve a intentarlo.',
          estadoHttp: 401,
        );
      }
      _sesion = renovada;
      notifyListeners();
      return renovada.tokenAcceso;
    } on ExcepcionApi {
      if (_revisionVigente(revision)) {
        await _descartarSesion(siRevision: revision);
      }
      rethrow;
    } catch (_) {
      if (_revisionVigente(revision)) {
        await _descartarSesion(siRevision: revision);
      }
      rethrow;
    }
  }

  Future<void> _cerrarRemotaSinFallar(String tokenAcceso) async {
    try {
      await _clienteApi.cerrarSesion(tokenAcceso);
    } catch (_) {
      // Una transición local nueva conserva prioridad sobre el cierre remoto.
    }
  }

  Future<void> _guardarSesion(SesionUsuario sesion) {
    return _ejecutarEnAlmacen(() => _almacenSesion.guardar(sesion));
  }

  Future<bool> _limpiarAlmacen() async {
    try {
      await _ejecutarEnAlmacen(_almacenSesion.limpiar);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _ejecutarEnAlmacen(Future<void> Function() operacion) {
    final resultado = _colaAlmacen.then(
      (_) => operacion(),
      onError: (_) => operacion(),
    );
    _colaAlmacen = resultado.catchError((_) {});
    return resultado;
  }

  Future<void> _descartarSesion({required int siRevision}) async {
    if (!_revisionVigente(siRevision)) return;
    _revisionAutenticacion += 1;
    _renovacionPendiente = null;
    _sesion = null;
    _cambiarEstado(EstadoSesion.noAutenticada);
    await _limpiarAlmacen();
  }

  bool _revisionVigente(int revision) => revision == _revisionAutenticacion;

  void _cambiarEstado(EstadoSesion nuevoEstado) {
    _estado = nuevoEstado;
    notifyListeners();
  }
}
