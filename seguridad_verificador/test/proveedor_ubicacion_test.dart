import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:seguridad_verificador/servicios/proveedor_ubicacion.dart';

class PlataformaUbicacionFalsa extends GeolocatorPlatform {
  bool servicioActivo = true;
  LocationPermission permiso = LocationPermission.denied;
  LocationPermission respuestaPermiso = LocationPermission.whileInUse;
  int solicitudesPermiso = 0;
  int solicitudesPosicion = 0;
  bool agotarTiempo = false;
  LocationSettings? ajustes;

  @override
  Future<bool> isLocationServiceEnabled() async => servicioActivo;

  @override
  Future<LocationPermission> checkPermission() async => permiso;

  @override
  Future<LocationPermission> requestPermission() async {
    solicitudesPermiso++;
    return respuestaPermiso;
  }

  @override
  Future<Position> getCurrentPosition({
    LocationSettings? locationSettings,
  }) async {
    solicitudesPosicion++;
    ajustes = locationSettings;
    if (agotarTiempo) throw TimeoutException('Sin señal GPS');
    return Position(
      latitude: -18.013,
      longitude: -70.251,
      timestamp: DateTime.now().toUtc(),
      accuracy: 6,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late GeolocatorPlatform original;
  late PlataformaUbicacionFalsa plataforma;
  const proveedor = ProveedorUbicacionDispositivo();

  setUp(() {
    original = GeolocatorPlatform.instance;
    plataforma = PlataformaUbicacionFalsa();
    GeolocatorPlatform.instance = plataforma;
  });

  tearDown(() => GeolocatorPlatform.instance = original);

  test(
    'solicita permiso y devuelve una lectura nueva de alta precisión',
    () async {
      final posicion = await proveedor.obtenerUbicacionActual();
      expect(plataforma.solicitudesPermiso, 1);
      expect(plataforma.solicitudesPosicion, 1);
      expect(plataforma.ajustes!.accuracy, LocationAccuracy.high);
      expect(plataforma.ajustes!.timeLimit, const Duration(seconds: 12));
      expect(posicion.latitud, -18.013);
      expect(posicion.longitud, -70.251);
      expect(posicion.precisionMetros, 6);
    },
  );

  test('con permiso existente captura sin volver a solicitarlo', () async {
    plataforma.permiso = LocationPermission.whileInUse;
    await proveedor.obtenerUbicacionActual();
    expect(plataforma.solicitudesPermiso, 0);
    expect(plataforma.solicitudesPosicion, 1);
  });

  test(
    'GPS apagado exige activarlo y no solicita permisos ni posición',
    () async {
      plataforma.servicioActivo = false;
      await expectLater(
        proveedor.obtenerUbicacionActual(),
        throwsA(
          isA<ExcepcionUbicacion>().having(
            (e) => e.mensaje,
            'mensaje',
            contains('Activa la ubicación'),
          ),
        ),
      );
      expect(plataforma.solicitudesPermiso, 0);
      expect(plataforma.solicitudesPosicion, 0);
    },
  );

  test('permiso denegado no intenta obtener coordenadas', () async {
    plataforma.respuestaPermiso = LocationPermission.denied;
    await expectLater(
      proveedor.obtenerUbicacionActual(),
      throwsA(isA<ExcepcionUbicacion>()),
    );
    expect(plataforma.solicitudesPermiso, 1);
    expect(plataforma.solicitudesPosicion, 0);
  });

  test('permiso bloqueado indica que se habilite en ajustes', () async {
    plataforma.permiso = LocationPermission.deniedForever;
    await expectLater(
      proveedor.obtenerUbicacionActual(),
      throwsA(
        isA<ExcepcionUbicacion>().having(
          (e) => e.mensaje,
          'mensaje',
          contains('ajustes'),
        ),
      ),
    );
    expect(plataforma.solicitudesPermiso, 0);
    expect(plataforma.solicitudesPosicion, 0);
  });

  test('sin señal explica cómo repetir la captura', () async {
    plataforma.agotarTiempo = true;
    await expectLater(
      proveedor.obtenerUbicacionActual(),
      throwsA(
        isA<ExcepcionUbicacion>().having(
          (e) => e.mensaje,
          'mensaje',
          contains('mejor señal'),
        ),
      ),
    );
  });
}
