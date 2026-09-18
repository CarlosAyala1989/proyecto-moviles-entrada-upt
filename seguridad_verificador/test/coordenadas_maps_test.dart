import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_verificador/servicios/coordenadas_maps.dart';

void main() {
  test('lee coordenadas decimales y enlaces con ubicación explícita', () {
    expect(leerCoordenadasMaps(' -18.013, -70.251 '), (
      latitud: -18.013,
      longitud: -70.251,
    ));
    expect(
      leerCoordenadasMaps(
        'https://www.google.com/maps/search/?api=1&query=-18.013%2C-70.251',
      ),
      (latitud: -18.013, longitud: -70.251),
    );
    expect(
      leerCoordenadasMaps(
        'https://www.google.com/maps/place/UPT/@0,0,15z/data=!3d-18.013!4d-70.251',
      ),
      (latitud: -18.013, longitud: -70.251),
    );
  });
  test(
    'no usa el centro de la cámara como puerta ni acepta coordenadas inválidas',
    () {
      expect(
        leerCoordenadasMaps('https://www.google.com/maps/@-18.013,-70.251,15z'),
        isNull,
      );
      expect(leerCoordenadasMaps('https://maps.app.goo.gl/abc'), isNull);
      expect(leerCoordenadasMaps('https://example.com/?q=1,2'), isNull);
      expect(leerCoordenadasMaps('91, 20'), isNull);
      expect(leerCoordenadasMaps('texto sin coordenadas'), isNull);
    },
  );
}
