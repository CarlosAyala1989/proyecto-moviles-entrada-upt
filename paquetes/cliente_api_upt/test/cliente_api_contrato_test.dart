import 'dart:convert';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

http.Response respuestaJson(Object datos) => http.Response(
  jsonEncode({'datos': datos}),
  200,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

void main() {
  group('Contrato HTTP móvil', () {
    test('consulta y decodifica la identidad autenticada', () async {
      late http.Request solicitudRecibida;
      final cliente = ClienteApi(
        urlBase: 'https://acceso.example.invalid/api',
        clienteHttp: MockClient((solicitud) async {
          solicitudRecibida = solicitud;
          return respuestaJson({
            'id': 10,
            'codigo_institucional': 'PRUEBA-EST-001',
            'correo_institucional': 'estudiante@example.invalid',
            'nombre_completo': 'Estudiante De Prueba',
            'foto_url': null,
            'roles': ['ESTUDIANTE'],
            'verificacion': {'estado': 'VERIFICADA'},
            'acceso': {
              'estado_usuario': 'ACTIVO',
              'estado_autorizacion': 'AUTORIZADO',
            },
            'preparacion_codigo_qr': {'puede_solicitar': true},
            'perfil_academico': null,
          });
        }),
      );

      final identidad = await cliente.consultarIdentidadDigital('token');

      expect(solicitudRecibida.method, 'GET');
      expect(solicitudRecibida.url.path, '/api/identidad-digital');
      expect(solicitudRecibida.headers['authorization'], 'Bearer token');
      expect(identidad.codigoInstitucional, 'PRUEBA-EST-001');
    });

    test('envía ubicación reciente al generar una credencial', () async {
      late Map<String, dynamic> cuerpoRecibido;
      final cliente = ClienteApi(
        urlBase: 'https://acceso.example.invalid/api',
        clienteHttp: MockClient((solicitud) async {
          cuerpoRecibido = Map<String, dynamic>.from(
            jsonDecode(solicitud.body) as Map,
          );
          return respuestaJson({
            'codigo_qr': 'upt_qr_v1.valor-opaco',
            'estado': 'PENDIENTE',
            'emitida_en': '2026-09-12T15:00:00.000Z',
            'expira_en': '2026-09-12T15:00:45.000Z',
            'duracion_segundos': 45,
            'un_solo_uso': true,
            'ubicacion': {
              'punto_acceso': {
                'codigo': 'PRUEBA-LOCAL',
                'nombre': 'Puerta principal',
              },
            },
          });
        }),
      );
      final ubicacion = UbicacionReportada(
        latitud: -18.013,
        longitud: -70.251,
        precisionMetros: 10,
        obtenidaEn: DateTime.parse('2026-09-12T10:00:00-05:00'),
      );

      final codigo = await cliente.generarCodigoQr('token', ubicacion);

      final ubicacionEnviada = Map<String, dynamic>.from(
        cuerpoRecibido['ubicacion'] as Map,
      );
      expect(ubicacionEnviada['latitud'], -18.013);
      expect(ubicacionEnviada['obtenida_en'], '2026-09-12T15:00:00.000Z');
      expect(codigo.puntoAccesoCodigo, 'PRUEBA-LOCAL');
    });

    test('envía punto y decodifica una autorización con identidad', () async {
      late http.Request solicitudRecibida;
      final cliente = ClienteApi(
        urlBase: 'https://acceso.example.invalid/api',
        clienteHttp: MockClient((solicitud) async {
          solicitudRecibida = solicitud;
          return respuestaJson({
            'resultado': 'AUTORIZADO',
            'motivo': 'ACCESO_AUTORIZADO',
            'mensaje': 'Ingreso autorizado.',
            'registrado_en': '2026-09-12T15:00:00.000Z',
            'punto_acceso': {
              'codigo': 'PUERTA-PRINCIPAL',
              'nombre': 'Puerta principal',
            },
            'identidad': {
              'foto_url': null,
              'nombre_completo': 'Estudiante De Prueba',
              'codigo_institucional': 'PRUEBA-EST-001',
              'tipo_usuario': ['ESTUDIANTE'],
              'escuela': 'Ingeniería de Sistemas',
              'estado_academico': 'REGULAR',
            },
          });
        }),
      );

      final resultado = await cliente.validarIngreso(
        tokenAcceso: 'token-seguridad',
        codigoQr: 'upt_qr_v1.valor-opaco',
        puntoAccesoCodigo: 'PUERTA-PRINCIPAL',
        ubicacion: UbicacionReportada(
          latitud: -18.013,
          longitud: -70.251,
          precisionMetros: 10,
          obtenidaEn: DateTime.utc(2026, 9, 12, 15),
        ),
      );

      final cuerpo = Map<String, dynamic>.from(
        jsonDecode(solicitudRecibida.body) as Map,
      );
      expect(solicitudRecibida.url.path, '/api/ingresos/validar');
      expect(cuerpo['punto_acceso_codigo'], 'PUERTA-PRINCIPAL');
      expect(resultado.autorizado, isTrue);
      expect(resultado.identidad!.codigoInstitucional, 'PRUEBA-EST-001');
    });

    test('consulta el historial con el límite solicitado', () async {
      late http.Request solicitudRecibida;
      final cliente = ClienteApi(
        urlBase: 'https://acceso.example.invalid/api',
        clienteHttp: MockClient((solicitud) async {
          solicitudRecibida = solicitud;
          return respuestaJson([
            {
              'id': 1,
              'resultado': 'DENEGADO',
              'motivo': 'TOKEN_INVALIDO',
              'registrado_en': '2026-09-12T15:00:00.000Z',
              'punto_acceso': {
                'codigo': 'PUERTA-PRINCIPAL',
                'nombre': 'Puerta principal',
              },
              'usuario': null,
            },
          ]);
        }),
      );

      final registros = await cliente.consultarIngresosRecientes(
        'token-seguridad',
        limite: 50,
      );

      expect(solicitudRecibida.url.path, '/api/ingresos/recientes');
      expect(solicitudRecibida.url.queryParameters['limite'], '50');
      expect(registros.single.resultado, 'DENEGADO');
      expect(registros.single.codigoInstitucional, isNull);
    });
  });
}
