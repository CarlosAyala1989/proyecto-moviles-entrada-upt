import 'dart:async';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:geolocator/geolocator.dart';

abstract interface class ProveedorUbicacion {
  Future<UbicacionReportada> obtenerUbicacionActual();
}

abstract final class ConfiguracionUbicacionDesarrollo {
  static const simulada = bool.fromEnvironment(
    'UBICACION_DESARROLLO_SIMULADA',
    defaultValue: false,
  );
  static const latitudTexto = String.fromEnvironment(
    'UBICACION_DESARROLLO_LATITUD',
    defaultValue: '-18.013',
  );
  static const longitudTexto = String.fromEnvironment(
    'UBICACION_DESARROLLO_LONGITUD',
    defaultValue: '-70.251',
  );
  static const precisionMetrosTexto = String.fromEnvironment(
    'UBICACION_DESARROLLO_PRECISION_METROS',
    defaultValue: '5',
  );
}

class ExcepcionUbicacion implements Exception {
  const ExcepcionUbicacion(this.mensaje);

  final String mensaje;

  @override
  String toString() => mensaje;
}

class ProveedorUbicacionDispositivo implements ProveedorUbicacion {
  const ProveedorUbicacionDispositivo();

  @override
  Future<UbicacionReportada> obtenerUbicacionActual() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const ExcepcionUbicacion(
        'Activa la ubicación del dispositivo para validar el ingreso.',
      );
    }

    var permiso = await Geolocator.checkPermission();
    if (permiso == LocationPermission.denied) {
      permiso = await Geolocator.requestPermission();
    }
    if (permiso == LocationPermission.denied) {
      throw const ExcepcionUbicacion(
        'Se necesita permiso de ubicación para validar el punto de acceso.',
      );
    }
    if (permiso == LocationPermission.deniedForever) {
      throw const ExcepcionUbicacion(
        'El permiso de ubicación está bloqueado. Habilítalo en los ajustes del dispositivo.',
      );
    }

    try {
      final posicion = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      return UbicacionReportada(
        latitud: posicion.latitude,
        longitud: posicion.longitude,
        precisionMetros: posicion.accuracy,
        obtenidaEn: posicion.timestamp,
      );
    } on TimeoutException {
      throw const ExcepcionUbicacion(
        'No se obtuvo una ubicación reciente. Inténtalo otra vez en un lugar con mejor señal.',
      );
    } on LocationServiceDisabledException {
      throw const ExcepcionUbicacion(
        'La ubicación se desactivó antes de comprobar el ingreso.',
      );
    } on PermissionDeniedException {
      throw const ExcepcionUbicacion(
        'El sistema no permitió acceder a la ubicación del dispositivo.',
      );
    } catch (_) {
      throw const ExcepcionUbicacion(
        'No fue posible obtener la ubicación. Comprueba que el servicio de ubicación esté disponible.',
      );
    }
  }
}

class ProveedorUbicacionSimuladaDesarrollo implements ProveedorUbicacion {
  const ProveedorUbicacionSimuladaDesarrollo();

  @override
  Future<UbicacionReportada> obtenerUbicacionActual() async {
    final latitud = double.tryParse(
      ConfiguracionUbicacionDesarrollo.latitudTexto,
    );
    final longitud = double.tryParse(
      ConfiguracionUbicacionDesarrollo.longitudTexto,
    );
    final precision = double.tryParse(
      ConfiguracionUbicacionDesarrollo.precisionMetrosTexto,
    );
    if (latitud == null || longitud == null || precision == null) {
      throw const ExcepcionUbicacion(
        'La ubicación de prueba no está escrita correctamente.',
      );
    }
    if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) {
      throw const ExcepcionUbicacion(
        'La ubicación de prueba está fuera de los valores permitidos.',
      );
    }
    if (precision <= 0) {
      throw const ExcepcionUbicacion(
        'La precisión de la ubicación de prueba no es válida.',
      );
    }
    return UbicacionReportada(
      latitud: latitud,
      longitud: longitud,
      precisionMetros: precision,
      obtenidaEn: DateTime.now().toUtc(),
    );
  }
}
