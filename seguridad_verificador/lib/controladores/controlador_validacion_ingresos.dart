import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/foundation.dart';

import '../servicios/proveedor_ubicacion.dart';

class ControladorValidacionIngresos extends ChangeNotifier {
  ControladorValidacionIngresos({
    required ContratoClienteApi clienteApi,
    required ControladorSesion controladorSesion,
    required ProveedorUbicacion proveedorUbicacion,
    String puntoAccesoCodigo = '',
    ContratoControlSeguridad? controlSeguridadApi,
  }) : _clienteApi = clienteApi,
       _controladorSesion = controladorSesion,
       _proveedorUbicacion = proveedorUbicacion,
       _controlSeguridadApi = controlSeguridadApi,
       _puntoAccesoCodigo = puntoAccesoCodigo.trim().toUpperCase(),
       _revisionSesion = controladorSesion.revisionAutenticacion {
    _controladorSesion.addListener(_alCambiarSesion);
  }

  final ContratoClienteApi _clienteApi;
  final ControladorSesion _controladorSesion;
  final ProveedorUbicacion _proveedorUbicacion;
  String _puntoAccesoCodigo;
  final ContratoControlSeguridad? _controlSeguridadApi;
  bool habilitadoPorUbicacion = false;
  bool comprobandoUbicacion = false;
  String? bloqueoUbicacion;
  bool get exigeUbicacion => _controlSeguridadApi != null;

  Future<bool> comprobarDisponibilidad() async {
    if (_descartado ||
        comprobandoUbicacion ||
        !_controladorSesion.estaAutenticada) {
      return false;
    }
    if (_controlSeguridadApi == null) return true;
    final revision = _controladorSesion.revisionAutenticacion;
    comprobandoUbicacion = true;
    var permitido = false;
    bloqueoUbicacion = null;
    notifyListeners();
    try {
      final token = await _controladorSesion.obtenerTokenAcceso();
      if (!_solicitudVigente(revision)) return false;
      final ubicacion = await _proveedorUbicacion.obtenerUbicacionActual();
      final resultado = await _controlSeguridadApi.comprobarUbicacionSeguridad(
        token,
        ubicacion,
      );
      if (!_solicitudVigente(revision)) return false;
      _puntoAccesoCodigo =
          (resultado['punto_acceso'] as Map)['codigo'] as String;
      permitido = resultado['habilitado'] == true;
      return permitido;
    } on ExcepcionApi catch (error) {
      if (_solicitudVigente(revision)) {
        bloqueoUbicacion = error.mensajeParaUsuario;
      }
    } on ExcepcionUbicacion catch (error) {
      if (_solicitudVigente(revision)) bloqueoUbicacion = error.mensaje;
    } catch (_) {
      if (_solicitudVigente(revision)) {
        bloqueoUbicacion =
            'No pudimos comprobar tu ubicación. Revisa el GPS y tu conexión.';
      }
    } finally {
      if (revision == _controladorSesion.revisionAutenticacion) {
        comprobandoUbicacion = false;
        habilitadoPorUbicacion = permitido;
      }
      if (!_descartado) notifyListeners();
    }
    return false;
  }

  void _bloquearPorError(ExcepcionApi error) {
    if (exigeUbicacion &&
        {
          'SEGURIDAD_FUERA_DE_ZONA',
          'SEGURIDAD_SIN_ASIGNACION',
          'SEGURIDAD_PUNTO_NO_ASIGNADO',
          'PUNTO_ACCESO_INACTIVO',
          'UBICACION_DESACTUALIZADA',
          'PRECISION_UBICACION_INSUFICIENTE',
          'MOMENTO_UBICACION_INVALIDO',
        }.contains(error.codigo)) {
      habilitadoPorUbicacion = false;
      bloqueoUbicacion = error.mensajeParaUsuario;
    }
  }

  EstadoCarga<ResultadoValidacionIngreso> _validacion =
      const EstadoCarga.inicial();
  EstadoCarga<List<RegistroIngresoReciente>> _historial =
      const EstadoCarga.inicial();
  int _revisionSesion;
  bool _descartado = false;

  String get puntoAccesoCodigo => _puntoAccesoCodigo;
  EstadoCarga<ResultadoValidacionIngreso> get validacion => _validacion;
  EstadoCarga<List<RegistroIngresoReciente>> get historial => _historial;
  bool get usaUbicacionSimulada =>
      _proveedorUbicacion is ProveedorUbicacionSimuladaDesarrollo;

  bool get configuracionPuntoValida =>
      RegExp(r'^[A-Z0-9][A-Z0-9_-]{0,49}$').hasMatch(_puntoAccesoCodigo);

  Future<bool> validarCodigoQr(String codigoQr) async {
    if (_validacion.fase == FaseCarga.cargando) return false;
    if (!configuracionPuntoValida) {
      _validacion = const EstadoCarga.error(
        'Este equipo no tiene una puerta asignada correctamente. Pide ayuda al responsable del sistema.',
      );
      notifyListeners();
      return false;
    }

    final revision = _controladorSesion.revisionAutenticacion;
    _validacion = const EstadoCarga.cargando();
    notifyListeners();
    try {
      final token = await _controladorSesion.obtenerTokenAcceso();
      if (!_solicitudVigente(revision)) return false;
      final ubicacion = await _proveedorUbicacion.obtenerUbicacionActual();
      if (!_solicitudVigente(revision)) return false;
      final resultado = await _clienteApi.validarIngreso(
        tokenAcceso: token,
        codigoQr: codigoQr,
        puntoAccesoCodigo: _puntoAccesoCodigo,
        ubicacion: ubicacion,
      );
      if (!_solicitudVigente(revision)) return false;
      if (resultado.autorizado && resultado.identidad == null) {
        _validacion = const EstadoCarga.error(
          'No pudimos mostrar la identidad de la persona. No permitas el ingreso y vuelve a escanear.',
        );
        notifyListeners();
        return false;
      }
      _validacion = EstadoCarga.completada(resultado);
      _historial = const EstadoCarga.inicial();
      notifyListeners();
      return true;
    } on ExcepcionUbicacion catch (error) {
      if (!_solicitudVigente(revision)) return false;
      if (exigeUbicacion) {
        habilitadoPorUbicacion = false;
        bloqueoUbicacion = error.mensaje;
      }
      _validacion = EstadoCarga.error(error.mensaje);
    } on ExcepcionApi catch (error) {
      if (!_solicitudVigente(revision)) return false;
      _bloquearPorError(error);
      _validacion = EstadoCarga.error(error.mensajeParaUsuario);
    } catch (_) {
      if (!_solicitudVigente(revision)) return false;
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

    final revision = _controladorSesion.revisionAutenticacion;
    _historial = const EstadoCarga.cargando();
    notifyListeners();
    try {
      final token = await _controladorSesion.obtenerTokenAcceso();
      if (!_solicitudVigente(revision)) return false;
      final ubicacion = await _proveedorUbicacion.obtenerUbicacionActual();
      if (!_solicitudVigente(revision)) return false;
      final registros = await _clienteApi.consultarIngresosRecientes(
        token,
        limite: 50,
        ubicacion: ubicacion,
      );
      if (!_solicitudVigente(revision)) return false;
      _historial = EstadoCarga.completada(registros);
      notifyListeners();
      return true;
    } on ExcepcionUbicacion catch (error) {
      if (!_solicitudVigente(revision)) return false;
      if (exigeUbicacion) {
        habilitadoPorUbicacion = false;
        bloqueoUbicacion = error.mensaje;
      }
      _historial = EstadoCarga.error(error.mensaje);
    } on ExcepcionApi catch (error) {
      if (!_solicitudVigente(revision)) return false;
      _bloquearPorError(error);
      _historial = EstadoCarga.error(error.mensajeParaUsuario);
    } catch (_) {
      if (!_solicitudVigente(revision)) return false;
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
    final nuevaRevision = _controladorSesion.revisionAutenticacion;
    if (nuevaRevision == _revisionSesion) return;
    _revisionSesion = nuevaRevision;
    habilitadoPorUbicacion = false;
    comprobandoUbicacion = false;
    bloqueoUbicacion = null;
    if (exigeUbicacion) _puntoAccesoCodigo = '';
    _validacion = const EstadoCarga.inicial();
    _historial = const EstadoCarga.inicial();
    notifyListeners();
  }

  bool _solicitudVigente(int revision) =>
      !_descartado &&
      revision == _controladorSesion.revisionAutenticacion &&
      _controladorSesion.estaAutenticada;

  @override
  void dispose() {
    _descartado = true;
    _revisionSesion += 1;
    _controladorSesion.removeListener(_alCambiarSesion);
    super.dispose();
  }
}
