import 'dart:async';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/foundation.dart';

import '../servicios/proveedor_ubicacion.dart';

class ControladorIdentidadQr extends ChangeNotifier {
  ControladorIdentidadQr({
    required ContratoClienteApi clienteApi,
    required ControladorSesion controladorSesion,
    required ProveedorUbicacion proveedorUbicacion,
    DateTime Function()? ahora,
  }) : _clienteApi = clienteApi,
       _controladorSesion = controladorSesion,
       _proveedorUbicacion = proveedorUbicacion,
       _ahora = ahora ?? DateTime.now,
       _idUsuarioSesion = controladorSesion.estaAutenticada
           ? controladorSesion.sesion?.usuario.id
           : null {
    _controladorSesion.addListener(_alCambiarSesion);
  }

  final ContratoClienteApi _clienteApi;
  final ControladorSesion _controladorSesion;
  final ProveedorUbicacion _proveedorUbicacion;
  final DateTime Function() _ahora;

  EstadoCarga<IdentidadDigital> _identidad = const EstadoCarga.inicial();
  EstadoCarga<CodigoQrTemporal> _codigoQr = const EstadoCarga.inicial();
  int? _idUsuarioSesion;
  int _segundosRestantes = 0;
  bool _revocando = false;
  String? _mensajeCodigoQr;
  Timer? _temporizador;

  EstadoCarga<IdentidadDigital> get identidad => _identidad;
  EstadoCarga<CodigoQrTemporal> get codigoQr => _codigoQr;
  int get segundosRestantes => _segundosRestantes;
  bool get revocando => _revocando;
  String? get mensajeCodigoQr => _mensajeCodigoQr;
  bool get codigoQrVigente =>
      _codigoQr.fase == FaseCarga.completada && _segundosRestantes > 0;

  Future<bool> cargarIdentidad({bool forzar = false}) async {
    if (!forzar && _identidad.fase == FaseCarga.completada) return true;
    if (_identidad.fase == FaseCarga.cargando) return false;

    _identidad = const EstadoCarga.cargando();
    notifyListeners();
    try {
      final token = await _controladorSesion.obtenerTokenAcceso();
      final resultado = await _clienteApi.consultarIdentidadDigital(token);
      _identidad = EstadoCarga.completada(resultado);
      notifyListeners();
      return true;
    } on ExcepcionApi catch (error) {
      _identidad = EstadoCarga.error(error.mensaje);
    } catch (_) {
      _identidad = const EstadoCarga.error(
        'No fue posible consultar la identidad digital.',
      );
    }
    notifyListeners();
    return false;
  }

  Future<bool> generarCodigoQr() async {
    if (_codigoQr.fase == FaseCarga.cargando) return false;

    final identidadDisponible = await cargarIdentidad();
    final perfil = _identidad.datos;
    if (!identidadDisponible || perfil == null) return false;
    if (!perfil.puedeSolicitarCodigoQr) {
      _codigoQr = const EstadoCarga.error(
        'Tu identidad aún no cumple los requisitos para solicitar un código QR.',
      );
      notifyListeners();
      return false;
    }

    _cancelarTemporizador();
    _codigoQr = const EstadoCarga.cargando();
    _segundosRestantes = 0;
    _mensajeCodigoQr = null;
    notifyListeners();
    try {
      final token = await _controladorSesion.obtenerTokenAcceso();
      final ubicacion = await _proveedorUbicacion.obtenerUbicacionActual();
      final resultado = await _clienteApi.generarCodigoQr(token, ubicacion);
      _codigoQr = EstadoCarga.completada(resultado);
      _actualizarCuentaRegresiva();
      if (_segundosRestantes > 0) {
        _temporizador = Timer.periodic(
          const Duration(seconds: 1),
          (_) => _actualizarCuentaRegresiva(),
        );
      }
      return _segundosRestantes > 0;
    } on ExcepcionUbicacion catch (error) {
      _codigoQr = EstadoCarga.error(error.mensaje);
    } on ExcepcionApi catch (error) {
      _codigoQr = EstadoCarga.error(error.mensaje);
    } catch (_) {
      _codigoQr = const EstadoCarga.error(
        'No fue posible generar el código QR.',
      );
    }
    notifyListeners();
    return false;
  }

  Future<bool> revocarCodigoQr() async {
    if (!codigoQrVigente || _revocando) return !_revocando;
    _revocando = true;
    _mensajeCodigoQr = null;
    notifyListeners();
    try {
      final token = await _controladorSesion.obtenerTokenAcceso();
      await _clienteApi.revocarCodigoQr(token);
      _limpiarCodigoQr();
      _revocando = false;
      notifyListeners();
      return true;
    } on ExcepcionApi catch (error) {
      _mensajeCodigoQr = error.mensaje;
    } catch (_) {
      _mensajeCodigoQr = 'No fue posible anular el código QR.';
    }
    _revocando = false;
    notifyListeners();
    return false;
  }

  void _actualizarCuentaRegresiva() {
    final expiracion = _codigoQr.datos?.expiraEn;
    if (expiracion == null) {
      _segundosRestantes = 0;
      _cancelarTemporizador();
      notifyListeners();
      return;
    }
    final milisegundos = expiracion.difference(_ahora()).inMilliseconds;
    _segundosRestantes = milisegundos <= 0
        ? 0
        : (milisegundos / Duration.millisecondsPerSecond).ceil();
    if (_segundosRestantes == 0) _cancelarTemporizador();
    notifyListeners();
  }

  void _alCambiarSesion() {
    final nuevoId = _controladorSesion.estaAutenticada
        ? _controladorSesion.sesion?.usuario.id
        : null;
    if (nuevoId == _idUsuarioSesion) return;
    _idUsuarioSesion = nuevoId;
    _identidad = const EstadoCarga.inicial();
    _limpiarCodigoQr();
    notifyListeners();
  }

  void _limpiarCodigoQr() {
    _cancelarTemporizador();
    _codigoQr = const EstadoCarga.inicial();
    _segundosRestantes = 0;
    _revocando = false;
    _mensajeCodigoQr = null;
  }

  void _cancelarTemporizador() {
    _temporizador?.cancel();
    _temporizador = null;
  }

  @override
  void dispose() {
    _controladorSesion.removeListener(_alCambiarSesion);
    _cancelarTemporizador();
    super.dispose();
  }
}
