import 'dart:convert';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('revoca la credencial temporal autenticada', () async {
    late http.Request solicitudRecibida;
    final clienteHttp = MockClient((solicitud) async {
      solicitudRecibida = solicitud;
      return http.Response(
        jsonEncode({
          'datos': {'revocadas': 1},
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    });
    final cliente = ClienteApi(
      urlBase: 'https://api.example.invalid/api/',
      clienteHttp: clienteHttp,
    );

    await cliente.revocarCodigoQr('token-acceso-prueba');

    expect(solicitudRecibida.method, 'DELETE');
    expect(
      solicitudRecibida.url.toString(),
      'https://api.example.invalid/api/codigos-qr/actual',
    );
    expect(
      solicitudRecibida.headers['authorization'],
      'Bearer token-acceso-prueba',
    );
  });

  test(
    'permite configurar tiempoEspera personalizado desde el constructor',
    () {
      final clientePorDefecto = ClienteApi();
      expect(
        clientePorDefecto.tiempoEspera,
        ConfiguracionApi.duracionMaximaSolicitud,
      );

      final clienteTresSegundos = ClienteApi(
        tiempoEspera: const Duration(seconds: 3),
      );
      expect(clienteTresSegundos.tiempoEspera, const Duration(seconds: 3));
    },
  );

  test('carga el mapa administrativo como imagen autenticada', () async {
    late http.Request solicitudRecibida;
    final cliente = ClienteApi(
      urlBase: 'https://api.example.invalid/api',
      clienteHttp: MockClient((solicitud) async {
        solicitudRecibida = solicitud;
        return http.Response.bytes(
          [137, 80, 78, 71],
          200,
          headers: {'content-type': 'image/png'},
        );
      }),
    );

    final imagen = await cliente.obtenerMapaEstatico(
      'token-administrador',
      latitud: -18.0060535,
      longitud: -70.2266368,
      zoom: 18,
    );

    expect(imagen, [137, 80, 78, 71]);
    expect(
      solicitudRecibida.url.path,
      '/api/administracion/mapas/google/estatico',
    );
    expect(solicitudRecibida.url.queryParameters['zoom'], '18');
    expect(
      solicitudRecibida.headers['authorization'],
      'Bearer token-administrador',
    );
    expect(solicitudRecibida.headers['accept'], 'image/png');
  });
}
