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
       _revisionSesion = controladorSesion.revisionAutenticacion {
    _controladorSesion.addListener(_alCambiarSesion);
  }

  final ContratoClienteApi _clienteApi;
  final ControladorSesion _controladorSesion;
  final ProveedorUbicacion _proveedorUbicacion;
  final DateTime Function() _ahora;

  EstadoCarga<IdentidadDigital> _identidad = const EstadoCarga.inicial();
  EstadoCarga<CodigoQrTemporal> _codigoQr = const EstadoCarga.inicial();
  int _revisionSesion;
  int _segundosRestantes = 0;
  int _intentosFallidosConsecutivos = 0;
  int _segundosBloqueoReintento = 0;
  Timer? _temporizadorBloqueoReintento;
  bool _revocando = false;
  bool _rotacionAutomatica = false;
  bool _rotacionEnCurso = false;
  bool _descartado = false;
  String? _mensajeCodigoQr;
  Timer? _temporizador;

  EstadoCarga<IdentidadDigital> get identidad => _identidad;
  EstadoCarga<CodigoQrTemporal> get codigoQr => _codigoQr;
  int get segundosRestantes => _segundosRestantes;
  int get intentosFallidosConsecutivos => _intentosFallidosConsecutivos;
  int get segundosBloqueoReintento => _segundosBloqueoReintento;
  bool get estaBloqueadoPorReintentos => _segundosBloqueoReintento > 0;
  bool get revocando => _revocando;
  bool get rotacionAutomatica => _rotacionAutomatica;
  bool get usaUbicacionSimulada =>
      _proveedorUbicacion is ProveedorUbicacionSimuladaDesarrollo;
  String? get mensajeCodigoQr => _mensajeCodigoQr;
  bool get codigoQrVigente =>
      _codigoQr.fase == FaseCarga.completada && _segundosRestantes > 0;

  Future<bool> cargarIdentidad({bool forzar = false}) async {
    if (estaBloqueadoPorReintentos) return false;
    if (!forzar && _identidad.fase == FaseCarga.completada) return true;
    if (_identidad.fase == FaseCarga.cargando) return false;

    final revision = _controladorSesion.revisionAutenticacion;
    _identidad = const EstadoCarga.cargando();
    notifyListeners();
    try {
      final token = await _controladorSesion.obtenerTokenAcceso();
      if (!_solicitudVigente(revision)) return false;
      final resultado = await _clienteApi.consultarIdentidadDigital(token);
      if (!_solicitudVigente(revision)) return false;
      _intentosFallidosConsecutivos = 0;
      _identidad = EstadoCarga.completada(resultado);
      notifyListeners();
      return true;
    } on ExcepcionApi catch (error) {
      if (!_solicitudVigente(revision)) return false;
      _registrarFalloReintento();
      _identidad = EstadoCarga.error(error.mensajeParaUsuario);
    } catch (_) {
      if (!_solicitudVigente(revision)) return false;
      _registrarFalloReintento();
      _identidad = const EstadoCarga.error(
        'No fue posible consultar la identidad digital.',
      );
    }
    notifyListeners();
    return false;
  }

  void _registrarFalloReintento() {
    _intentosFallidosConsecutivos += 1;
    if (_intentosFallidosConsecutivos >= 3) {
      _iniciarBloqueoReintento();
    }
  }

  void _iniciarBloqueoReintento() {
    _cancelarTemporizadorBloqueo();
    _segundosBloqueoReintento = 10;
    _temporizadorBloqueoReintento = Timer.periodic(
      const Duration(seconds: 1),
      (timer) {
        if (_segundosBloqueoReintento > 1) {
          _segundosBloqueoReintento -= 1;
          notifyListeners();
        } else {
          _segundosBloqueoReintento = 0;
          _cancelarTemporizadorBloqueo();
          notifyListeners();
        }
      },
    );
  }

  void _cancelarTemporizadorBloqueo() {
    _temporizadorBloqueoReintento?.cancel();
    _temporizadorBloqueoReintento = null;
  }

  Future<bool> iniciarRotacionAutomatica() async {
    _rotacionAutomatica = true;
    final generado = await generarCodigoQr(mantenerRotacion: true);
    if (!generado && !_descartado) {
      _rotacionAutomatica = false;
      notifyListeners();
    }
    return generado;
  }

  void detenerRotacionAutomatica() {
    _rotacionAutomatica = false;
    _cancelarTemporizador();
    _codigoQr = const EstadoCarga.inicial();
    _segundosRestantes = 0;
  }

  Future<bool> generarCodigoQr({bool mantenerRotacion = false}) async {
    if (_codigoQr.fase == FaseCarga.cargando) return false;
    if (!mantenerRotacion) _rotacionAutomatica = false;

    final revision = _controladorSesion.revisionAutenticacion;
    final identidadDisponible = await cargarIdentidad();
    if (!_solicitudVigente(revision)) return false;
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
      if (!_solicitudVigente(revision)) return false;
      final ubicacion = await _proveedorUbicacion.obtenerUbicacionActual();
      if (!_solicitudVigente(revision)) return false;
      final resultado = await _clienteApi.generarCodigoQr(token, ubicacion);
      if (!_solicitudVigente(revision)) return false;
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
      if (!_solicitudVigente(revision)) return false;
      _codigoQr = EstadoCarga.error(error.mensaje);
    } on ExcepcionApi catch (error) {
      if (!_solicitudVigente(revision)) return false;
      _codigoQr = EstadoCarga.error(error.mensajeParaUsuario);
    } catch (_) {
      if (!_solicitudVigente(revision)) return false;
      _codigoQr = const EstadoCarga.error(
        'No fue posible generar el código QR.',
      );
    }
    notifyListeners();
    return false;
  }

  Future<bool> revocarCodigoQr() async {
    if (!codigoQrVigente || _revocando) return !_revocando;
    _rotacionAutomatica = false;
    final revision = _controladorSesion.revisionAutenticacion;
    _revocando = true;
    _mensajeCodigoQr = null;
    notifyListeners();
    try {
      final token = await _controladorSesion.obtenerTokenAcceso();
      if (!_solicitudVigente(revision)) return false;
      await _clienteApi.revocarCodigoQr(token);
      if (!_solicitudVigente(revision)) return false;
      _limpiarCodigoQr();
      _revocando = false;
      notifyListeners();
      return true;
    } on ExcepcionApi catch (error) {
      if (!_solicitudVigente(revision)) return false;
      _mensajeCodigoQr = error.mensajeParaUsuario;
    } catch (_) {
      if (!_solicitudVigente(revision)) return false;
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
    if (_segundosRestantes == 0) {
      _cancelarTemporizador();
      if (_rotacionAutomatica && !_rotacionEnCurso) {
        unawaited(_rotarCodigoQr());
      }
    }
    notifyListeners();
  }

  Future<void> _rotarCodigoQr() async {
    if (_descartado || !_rotacionAutomatica || _rotacionEnCurso) return;
    _rotacionEnCurso = true;
    final generado = await generarCodigoQr(mantenerRotacion: true);
    _rotacionEnCurso = false;
    if (!generado) _rotacionAutomatica = false;
    if (!_descartado) notifyListeners();
  }

  void _alCambiarSesion() {
    final nuevaRevision = _controladorSesion.revisionAutenticacion;
    if (nuevaRevision == _revisionSesion) return;
    _revisionSesion = nuevaRevision;
    _identidad = const EstadoCarga.inicial();
    _limpiarReintentos();
    _limpiarCodigoQr();
    notifyListeners();
  }

  bool _solicitudVigente(int revision) =>
      !_descartado &&
      revision == _controladorSesion.revisionAutenticacion &&
      _controladorSesion.estaAutenticada;

  void _limpiarReintentos() {
    _cancelarTemporizadorBloqueo();
    _intentosFallidosConsecutivos = 0;
    _segundosBloqueoReintento = 0;
  }

  void _limpiarCodigoQr() {
    _cancelarTemporizador();
    _codigoQr = const EstadoCarga.inicial();
    _segundosRestantes = 0;
    _revocando = false;
    _rotacionAutomatica = false;
    _rotacionEnCurso = false;
    _mensajeCodigoQr = null;
  }

  void _cancelarTemporizador() {
    _temporizador?.cancel();
    _temporizador = null;
  }

  @override
  void dispose() {
    _descartado = true;
    _revisionSesion += 1;
    _controladorSesion.removeListener(_alCambiarSesion);
    _cancelarTemporizador();
    _cancelarTemporizadorBloqueo();
    super.dispose();
  }
}
