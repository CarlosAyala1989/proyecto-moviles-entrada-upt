import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Modelos del contrato HTTP', () {
    test('interpreta una sesión y conserva sus roles', () {
      final sesion = SesionUsuario.desdeJson({
        'token_acceso': 'token-acceso-ficticio',
        'token_renovacion': 'token-renovacion-ficticio',
        'token_acceso_expira_en': '2026-09-11T15:15:00.000Z',
        'token_renovacion_expira_en': '2026-09-18T15:00:00.000Z',
        'usuario': {
          'id': 1,
          'codigo_institucional': 'PRUEBA-001',
          'correo_institucional': 'prueba@example.invalid',
          'nombres': 'Usuario',
          'apellidos': 'De Prueba',
          'roles': ['ESTUDIANTE'],
        },
      });

      expect(sesion.usuario.nombreCompleto, 'Usuario De Prueba');
      expect(sesion.usuario.roles, ['ESTUDIANTE']);
      expect(sesion.renovacionVencida(DateTime.utc(2026, 9, 11)), isFalse);
    });

    test('interpreta una identidad sin perfil académico', () {
      final identidad = IdentidadDigital.desdeJson({
        'id': 1,
        'codigo_institucional': 'PRUEBA-001',
        'correo_institucional': 'prueba@example.invalid',
        'nombre_completo': 'Usuario De Prueba',
        'foto_url': null,
        'roles': ['TRABAJADOR'],
        'verificacion': {'estado': 'VERIFICADA'},
        'acceso': {
          'estado_usuario': 'ACTIVO',
          'estado_autorizacion': 'AUTORIZADO',
        },
        'preparacion_codigo_qr': {'puede_solicitar': true},
        'perfil_academico': null,
      });

      expect(identidad.puedeSolicitarCodigoQr, isTrue);
      expect(identidad.perfilAcademico, isNull);
    });

    test('diferencia una validación autorizada de una denegada', () {
      final resultado = ResultadoValidacionIngreso.desdeJson({
        'resultado': 'DENEGADO',
        'motivo': 'TOKEN_INVALIDO',
        'mensaje': 'El código QR no es válido.',
        'registrado_en': '2026-09-11T15:00:00.000Z',
        'punto_acceso': {'codigo': 'PRUEBA-LOCAL', 'nombre': 'Punto de prueba'},
      });

      expect(resultado.autorizado, isFalse);
      expect(resultado.identidad, isNull);
    });
  });
}
