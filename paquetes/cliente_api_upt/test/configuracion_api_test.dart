import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Configuración de la API móvil', () {
    test('admite HTTP sólo cuando no se exige producción', () {
      expect(
        ConfiguracionApi.validarUrlBase(
          valor: 'http://10.0.2.2:3000/api',
          exigirHttps: false,
        ),
        isNull,
      );
      expect(
        ConfiguracionApi.validarUrlBase(
          valor: 'http://10.0.2.2:3000/api',
          exigirHttps: true,
        ),
        contains('HTTPS'),
      );
    });

    test('admite una URL HTTPS con prefijo y barra final', () {
      expect(
        ConfiguracionApi.validarUrlBase(
          valor: 'https://acceso.upt.example/sistema/api/',
          exigirHttps: true,
        ),
        isNull,
      );
    });

    test('rechaza direcciones ajenas al contrato o con datos sensibles', () {
      expect(
        ConfiguracionApi.validarUrlBase(
          valor: 'https://usuario:clave@acceso.upt.example/api',
          exigirHttps: true,
        ),
        isNotNull,
      );
      expect(
        ConfiguracionApi.validarUrlBase(
          valor: 'https://acceso.upt.example/v1',
          exigirHttps: true,
        ),
        contains('/api'),
      );
    });
  });

  testWidgets('presenta un error de configuración sin intentar conexión', (
    probador,
  ) async {
    await probador.pumpWidget(
      const MaterialApp(
        home: PantallaConfiguracionInvalida(
          titulo: 'Configuración no válida',
          mensaje: 'Se requiere HTTPS.',
          icono: Icons.settings_suggest_outlined,
        ),
      ),
    );

    expect(find.text('Configuración no válida'), findsOneWidget);
    expect(find.text('Se requiere HTTPS.'), findsOneWidget);
    expect(find.textContaining('No se intentó conectar'), findsOneWidget);
  });
}
