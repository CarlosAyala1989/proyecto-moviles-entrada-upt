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
    test(
      'decodifica las listas de administración y conserva la contraseña al editar un guardia',
      () async {
        final solicitudes = <http.Request>[];
        final cliente = ClienteApi(
          urlBase: 'https://acceso.example.invalid/api',
          clienteHttp: MockClient((solicitud) async {
            solicitudes.add(solicitud);
            if (solicitud.method != 'GET') return respuestaJson({'id': 2});
            return respuestaJson([
              {'id': 2, 'nombre': 'Puerta principal'},
            ]);
          }),
        );
        expect((await cliente.consultarPuertas('token-admin')).single['id'], 2);
        expect(
          (await cliente.consultarGuardias('token-admin')).single['id'],
          2,
        );
        await cliente.guardarGuardia('token-admin', {
          'usuario': 'GUARDIA-01',
          'nombres': 'Juan',
          'apellidos': 'Pérez',
          'activo': true,
          'punto_acceso_id': 2,
        }, id: 3);
        expect(solicitudes.first.url.path, '/api/administracion/puntos-acceso');
        expect(solicitudes.first.url.queryParameters['limite'], '100');
        expect(solicitudes[1].url.path, '/api/administracion/guardias');
        expect(solicitudes.last.method, 'PUT');
        expect(solicitudes.last.url.path, '/api/administracion/guardias/3');
        expect(
          jsonDecode(solicitudes.last.body),
          isNot(contains('contrasena')),
        );
        expect(
          solicitudes.every(
            (s) => s.headers['authorization'] == 'Bearer token-admin',
          ),
          isTrue,
        );
      },
    );
    test(
      'obtiene CAPTCHA y envía la verificación exclusivamente al backend',
      () async {
        final solicitudes = <http.Request>[];
        final cliente = ClienteApi(
          urlBase: 'https://acceso.example.invalid/api',
          clienteHttp: MockClient((solicitud) async {
            solicitudes.add(solicitud);
            if (solicitud.method == 'GET') {
              return respuestaJson({
                'transaccion_id': '0664b410-145e-4ef3-8d98-1055d8d57ee9',
                'imagen_base64': 'AQID',
                'tipo_imagen': 'image/png',
                'expira_en': '2026-09-14T12:05:00.000Z',
              });
            }
            return respuestaJson({
              'codigo': '2022074266',
              'nombre_apellidos': 'AYALA RAMOS, CARLOS DANIEL',
              'verificacion_intranet_id':
                  '8bcdbcea-0682-4c77-a828-21855d6bcdfa',
              'verificacion_expira_en': '2026-09-14T12:10:00.000Z',
            });
          }),
        );

        final captcha = await cliente.obtenerCaptchaIntranet();
        final perfil = await cliente.verificarIntranet(
          transaccionId: captcha.transaccionId,
          codigo: '2022074266',
          contrasena: '123456',
          captcha: '3868',
        );

        expect(
          solicitudes.first.url.path,
          '/api/registro-estudiante/intranet/captcha',
        );
        expect(
          solicitudes.last.url.path,
          '/api/registro-estudiante/intranet/verificar',
        );
        final cuerpo = Map<String, dynamic>.from(
          jsonDecode(solicitudes.last.body) as Map,
        );
        expect(cuerpo['contrasena'], '123456');
        expect(cuerpo['captcha'], '3868');
        expect(perfil.nombreApellidos, 'AYALA RAMOS, CARLOS DANIEL');
      },
    );

    test('inicia Google OAuth y consulta la sesión final', () async {
      final solicitudes = <http.Request>[];
      final cliente = ClienteApi(
        urlBase: 'https://acceso.example.invalid/api',
        clienteHttp: MockClient((solicitud) async {
          solicitudes.add(solicitud);
          if (solicitud.method == 'POST') {
            return respuestaJson({
              'transaccion_id': 'b46b2f2d-89e2-437b-aa27-10cb3b8f493c',
              'url_autorizacion':
                  'https://accounts.google.com/o/oauth2/v2/auth',
              'expira_en': '2026-09-14T12:10:00.000Z',
            });
          }
          return respuestaJson({
            'estado': 'COMPLETA',
            'sesion': {
              'token_acceso': 'upt_acceso_prueba',
              'token_renovacion': 'upt_renovacion_prueba',
              'token_acceso_expira_en': '2026-09-14T12:15:00.000Z',
              'token_renovacion_expira_en': '2026-09-21T12:00:00.000Z',
              'usuario': {
                'id': 10,
                'codigo_institucional': '2022074266',
                'correo_institucional': 'ca2022074266@virtual.upt.pe',
                'nombres': 'CARLOS DANIEL',
                'apellidos': 'AYALA RAMOS',
                'roles': ['ESTUDIANTE'],
              },
            },
          });
        }),
      );

      final inicio = await cliente.iniciarGoogle(
        '8bcdbcea-0682-4c77-a828-21855d6bcdfa',
      );
      final estado = await cliente.consultarEstadoGoogle(inicio.transaccionId);

      expect(solicitudes.first.method, 'POST');
      expect(
        solicitudes.first.url.path,
        '/api/registro-estudiante/google/iniciar',
      );
      expect(solicitudes.last.url.path, contains('/google/estado/'));
      expect(inicio.urlAutorizacion.host, 'accounts.google.com');
      expect(estado.estaCompleta, isTrue);
      expect(estado.sesion!.usuario.codigoInstitucional, '2022074266');
    });

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
