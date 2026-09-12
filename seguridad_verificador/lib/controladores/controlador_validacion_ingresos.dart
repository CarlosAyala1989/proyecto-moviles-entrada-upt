import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/foundation.dart';

import '../servicios/proveedor_ubicacion.dart';

class ControladorValidacionIngresos extends ChangeNotifier {
  ControladorValidacionIngresos({
    required ContratoClienteApi clienteApi,
    required ControladorSesion controladorSesion,
    required ProveedorUbicacion proveedorUbicacion,
    required String puntoAccesoCodigo,
  }) : _clienteApi = clienteApi,
       _controladorSesion = controladorSesion,
       _proveedorUbicacion = proveedorUbicacion,
       _puntoAccesoCodigo = puntoAccesoCodigo.trim().toUpperCase(),
       _idUsuarioSesion = controladorSesion.estaAutenticada
           ? controladorSesion.sesion?.usuario.id
           : null {
    _controladorSesion.addListener(_alCambiarSesion);
  }

  final ContratoClienteApi _clienteApi;
  final ControladorSesion _controladorSesion;
  final ProveedorUbicacion _proveedorUbicacion;
  final String _puntoAccesoCodigo;

  EstadoCarga<ResultadoValidacionIngreso> _validacion =
      const EstadoCarga.inicial();
  EstadoCarga<List<RegistroIngresoReciente>> _historial =
      const EstadoCarga.inicial();
  int? _idUsuarioSesion;

  String get puntoAccesoCodigo => _puntoAccesoCodigo;
  EstadoCarga<ResultadoValidacionIngreso> get validacion => _validacion;
  EstadoCarga<List<RegistroIngresoReciente>> get historial => _historial;

  bool get configuracionPuntoValida =>
      RegExp(r'^[A-Z0-9][A-Z0-9_-]{0,49}$').hasMatch(_puntoAccesoCodigo);

  Future<bool> validarCodigoQr(String codigoQr) async {
    if (_validacion.fase == FaseCarga.cargando) return false;
    if (!configuracionPuntoValida) {
      _validacion = const EstadoCarga.error(
        'Configura un código de punto de acceso válido para este dispositivo.',
      );
      notifyListeners();
      return false;
    }

    _validacion = const EstadoCarga.cargando();
    notifyListeners();
    try {
      final token = await _controladorSesion.obtenerTokenAcceso();
      final ubicacion = await _proveedorUbicacion.obtenerUbicacionActual();
      final resultado = await _clienteApi.validarIngreso(
        tokenAcceso: token,
        codigoQr: codigoQr,
        puntoAccesoCodigo: _puntoAccesoCodigo,
        ubicacion: ubicacion,
      );
      if (resultado.autorizado && resultado.identidad == null) {
        _validacion = const EstadoCarga.error(
          'El backend autorizó el ingreso sin devolver una identidad verificable. No permitas el acceso.',
        );
        notifyListeners();
        return false;
      }
      _validacion = EstadoCarga.completada(resultado);
      _historial = const EstadoCarga.inicial();
      notifyListeners();
      return true;
    } on ExcepcionUbicacion catch (error) {
      _validacion = EstadoCarga.error(error.mensaje);
    } on ExcepcionApi catch (error) {
      _validacion = EstadoCarga.error(error.mensaje);
    } catch (_) {
      _validacion = const EstadoCarga.error(
        'No fue posible validar el código QR.',
      );
    }
    notifyListeners();
    return false;
  }

  Future<bool> cargarHistorial({bool forzar = false}) async {
    if (!forzar && _historial.fase == FaseCarga.completada) return true;
    if (_historial.fase == FaseCarga.cargando) return false;

    _historial = const EstadoCarga.cargando();
    notifyListeners();
    try {
      final token = await _controladorSesion.obtenerTokenAcceso();
      final registros = await _clienteApi.consultarIngresosRecientes(
        token,
        limite: 50,
      );
      _historial = EstadoCarga.completada(registros);
      notifyListeners();
      return true;
    } on ExcepcionApi catch (error) {
      _historial = EstadoCarga.error(error.mensaje);
    } catch (_) {
      _historial = const EstadoCarga.error(
        'No fue posible consultar el historial reciente.',
      );
    }
    notifyListeners();
    return false;
  }

  void reiniciarValidacion() {
    if (_validacion.fase == FaseCarga.cargando) return;
    _validacion = const EstadoCarga.inicial();
    notifyListeners();
  }

  void _alCambiarSesion() {
    final nuevoId = _controladorSesion.estaAutenticada
        ? _controladorSesion.sesion?.usuario.id
        : null;
    if (nuevoId == _idUsuarioSesion) return;
    _idUsuarioSesion = nuevoId;
    _validacion = const EstadoCarga.inicial();
    _historial = const EstadoCarga.inicial();
    notifyListeners();
  }

  @override
  void dispose() {
    _controladorSesion.removeListener(_alCambiarSesion);
    super.dispose();
  }
}
