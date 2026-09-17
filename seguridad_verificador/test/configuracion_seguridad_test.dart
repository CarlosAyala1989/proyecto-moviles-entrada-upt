import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_verificador/configuracion/configuracion_seguridad.dart';

void main() {
  group('Configuración del punto de acceso', () {
    test('normaliza y acepta un código institucional', () {
      expect(
        ConfiguracionSeguridad.validarPuntoAcceso(
          valor: ' puerta-principal ',
          exigirPuntoInstitucional: true,
        ),
        isNull,
      );
    });

    test('permite el punto ficticio sólo fuera de producción', () {
      expect(
        ConfiguracionSeguridad.validarPuntoAcceso(
          valor: 'PRUEBA-LOCAL',
          exigirPuntoInstitucional: false,
        ),
        isNull,
      );
      expect(
        ConfiguracionSeguridad.validarPuntoAcceso(
          valor: 'PRUEBA-LOCAL',
          exigirPuntoInstitucional: true,
        ),
        contains('puerta de la universidad'),
      );
    });

    test('rechaza valores vacíos o con caracteres no permitidos', () {
      expect(
        ConfiguracionSeguridad.validarPuntoAcceso(
          valor: '',
          exigirPuntoInstitucional: false,
        ),
        isNotNull,
      );
      expect(
        ConfiguracionSeguridad.validarPuntoAcceso(
          valor: 'PUERTA PRINCIPAL',
          exigirPuntoInstitucional: false,
        ),
        isNotNull,
      );
    });
  });
}
