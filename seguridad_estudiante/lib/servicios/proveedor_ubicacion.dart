import 'dart:async';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:geolocator/geolocator.dart';

abstract interface class ProveedorUbicacion {
  Future<UbicacionReportada> obtenerUbicacionActual();
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
        'Activa la ubicación del dispositivo para solicitar el código QR.',
      );
    }

    var permiso = await Geolocator.checkPermission();
    if (permiso == LocationPermission.denied) {
      permiso = await Geolocator.requestPermission();
    }
    if (permiso == LocationPermission.denied) {
      throw const ExcepcionUbicacion(
        'Se necesita permiso de ubicación para comprobar el punto de acceso.',
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
        'La ubicación se desactivó antes de completar la solicitud.',
      );
    } on PermissionDeniedException {
      throw const ExcepcionUbicacion(
        'El sistema no permitió acceder a la ubicación del dispositivo.',
      );
    }
  }
}
