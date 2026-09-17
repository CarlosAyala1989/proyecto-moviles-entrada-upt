import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('convierte un error interno en una indicación clara', () {
    const error = ExcepcionApi(
      codigo: 'TOKEN_ACCESO_INVALIDO',
      mensaje: 'Se requiere un token de acceso Bearer.',
      estadoHttp: 401,
    );

    expect(
      error.mensajeParaUsuario,
      'Tu sesión terminó. Vuelve a ingresar para continuar.',
    );
    expect(error.mensajeParaUsuario, isNot(contains('token')));
    expect(error.mensajeParaUsuario, isNot(contains('Bearer')));
  });

  test('explica al verificador qué hacer con un código vencido', () {
    expect(
      mensajeDecisionIngresoParaUsuario('CREDENCIAL_EXPIRADA'),
      contains('muestre el nuevo código'),
    );
  });

  test('no muestra un código desconocido como texto al usuario', () {
    final mensaje = mensajeErrorParaUsuario('ERROR_INTERNO_DESCONOCIDO');

    expect(mensaje, isNot(contains('ERROR_INTERNO_DESCONOCIDO')));
    expect(mensaje, contains('Inténtalo nuevamente'));
  });
}
