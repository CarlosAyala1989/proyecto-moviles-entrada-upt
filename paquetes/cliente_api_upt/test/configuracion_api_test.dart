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
        contains('conexión protegida'),
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
        contains('servicio de la aplicación'),
      );
    });
  });

  testWidgets('presenta un error de configuración sin intentar conexión', (
    probador,
  ) async {
    await probador.pumpWidget(
      const MaterialApp(
        home: PantallaConfiguracionInvalida(
          titulo: 'No pudimos iniciar la aplicación',
          mensaje: 'Se requiere una conexión protegida.',
          icono: Icons.settings_suggest_outlined,
        ),
      ),
    );

    expect(find.text('No pudimos iniciar la aplicación'), findsOneWidget);
    expect(find.text('Se requiere una conexión protegida.'), findsOneWidget);
    expect(find.textContaining('Pide ayuda'), findsOneWidget);
  });
}
