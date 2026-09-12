import 'package:flutter/foundation.dart';

import '../modelos/sesion_usuario.dart';
import '../servicios/contrato_cliente_api.dart';
import '../servicios/excepcion_api.dart';
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
  })  : _clienteApi = clienteApi,
        _almacenSesion = almacenSesion,
        _rolesPermitidos = Set.unmodifiable(rolesPermitidos);

  final ContratoClienteApi _clienteApi;
  final AlmacenSesion _almacenSesion;
  final Set<String> _rolesPermitidos;
  EstadoSesion _estado = EstadoSesion.restaurando;
  SesionUsuario? _sesion;
  String? _mensajeError;

  EstadoSesion get estado => _estado;
  SesionUsuario? get sesion => _sesion;
  String? get mensajeError => _mensajeError;
  bool get estaAutenticada => _estado == EstadoSesion.autenticada;
  bool get estaProcesando => {
    EstadoSesion.restaurando,
    EstadoSesion.autenticando,
    EstadoSesion.cerrando,
  }.contains(_estado);

  bool _tieneRolPermitido(SesionUsuario sesion) {
    return sesion.usuario.roles.any(_rolesPermitidos.contains);
  }

  Future<void> restaurar() async {
    _cambiarEstado(EstadoSesion.restaurando);
    try {
      var recuperada = await _almacenSesion.recuperar();
      final ahora = DateTime.now();
      if (recuperada == null || recuperada.renovacionVencida(ahora)) {
        await _almacenSesion.limpiar();
        _sesion = null;
        _cambiarEstado(EstadoSesion.noAutenticada);
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
      if (!_tieneRolPermitido(recuperada)) {
        try {
          await _clienteApi.cerrarSesion(recuperada.tokenAcceso);
        } on ExcepcionApi {
          // La limpieza local no depende de la disponibilidad de la red.
        }
        await _descartarSesion();
        return;
      }
      await _almacenSesion.guardar(recuperada);
      _sesion = recuperada;
      _cambiarEstado(EstadoSesion.autenticada);
    } on ExcepcionApi {
      await _descartarSesion();
    } catch (_) {
      await _descartarSesion();
    }
  }

  Future<bool> iniciarSesion(String identificador, String contrasena) async {
    _mensajeError = null;
    _cambiarEstado(EstadoSesion.autenticando);
    try {
      final nuevaSesion = await _clienteApi.iniciarSesion(
        identificador,
        contrasena,
      );
      if (!_tieneRolPermitido(nuevaSesion)) {
        try {
          await _clienteApi.cerrarSesion(nuevaSesion.tokenAcceso);
        } on ExcepcionApi {
          // La respuesta de rol conserva prioridad sobre un fallo de cierre.
        }
        throw const ExcepcionApi(
          codigo: 'ROL_APLICACION_NO_AUTORIZADO',
          mensaje: 'La cuenta no tiene un rol permitido para esta aplicación.',
          estadoHttp: 403,
        );
      }
      await _almacenSesion.guardar(nuevaSesion);
      _sesion = nuevaSesion;
      _cambiarEstado(EstadoSesion.autenticada);
      return true;
    } on ExcepcionApi catch (error) {
      await _almacenSesion.limpiar();
      _mensajeError = error.mensaje;
      _sesion = null;
      _cambiarEstado(EstadoSesion.error);
      return false;
    } catch (_) {
      await _almacenSesion.limpiar();
      _mensajeError = 'No fue posible iniciar sesión.';
      _sesion = null;
      _cambiarEstado(EstadoSesion.error);
      return false;
    }
  }

  Future<String> obtenerTokenAcceso() async {
    var actual = _sesion;
    if (actual == null || actual.renovacionVencida(DateTime.now())) {
      await _descartarSesion();
      throw const ExcepcionApi(
        codigo: 'SESION_VENCIDA',
        mensaje: 'La sesión ha vencido. Inicia sesión nuevamente.',
        estadoHttp: 401,
      );
    }
    if (actual.accesoRequiereRenovacion(DateTime.now())) {
      try {
        actual = await _clienteApi.renovarSesion(actual.tokenRenovacion);
        if (!_tieneRolPermitido(actual)) {
          await _descartarSesion();
          throw const ExcepcionApi(
            codigo: 'ROL_APLICACION_NO_AUTORIZADO',
            mensaje: 'La cuenta ya no tiene un rol permitido para esta aplicación.',
            estadoHttp: 403,
          );
        }
        await _almacenSesion.guardar(actual);
        _sesion = actual;
        notifyListeners();
      } on ExcepcionApi {
        await _descartarSesion();
        rethrow;
      }
    }
    return actual.tokenAcceso;
  }

  Future<void> cerrarSesion() async {
    final actual = _sesion;
    _cambiarEstado(EstadoSesion.cerrando);
    try {
      if (actual != null) await _clienteApi.cerrarSesion(actual.tokenAcceso);
    } on ExcepcionApi {
      // La sesión local siempre se elimina, aunque el backend no responda.
    } finally {
      await _descartarSesion();
    }
  }

  void limpiarError() {
    if (_estado != EstadoSesion.error) return;
    _mensajeError = null;
    _cambiarEstado(EstadoSesion.noAutenticada);
  }

  Future<void> _descartarSesion() async {
    _sesion = null;
    await _almacenSesion.limpiar();
    _cambiarEstado(EstadoSesion.noAutenticada);
  }

  void _cambiarEstado(EstadoSesion nuevoEstado) {
    _estado = nuevoEstado;
    notifyListeners();
  }
}
