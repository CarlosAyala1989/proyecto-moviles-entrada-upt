import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_estudiante/controladores/controlador_verificacion_intranet.dart';
import 'package:seguridad_estudiante/pantallas/pantalla_verificacion_intranet.dart';
import 'package:seguridad_estudiante/servicios/abridor_oauth.dart';

import 'ayudas/dobles_hito_10.dart';

class ClienteIntranetFalso extends ClientePortadorFalso {
  ClienteIntranetFalso(this.escuela)
    : super(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(DateTime.now().toUtc()),
      );

  final String? escuela;
  int iniciosGoogle = 0;

  @override
  Future<CaptchaIntranet> obtenerCaptchaIntranet() async => CaptchaIntranet(
    transaccionId: 'captcha-prueba',
    imagenBase64:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
    tipoImagen: 'image/png',
    expiraEn: DateTime.now().add(const Duration(minutes: 5)),
  );

  @override
  Future<PerfilIntranet> verificarIntranet({
    required String transaccionId,
    required String codigo,
    required String contrasena,
    required String captcha,
  }) async => PerfilIntranet(
    codigo: codigo,
    nombreApellidos: 'AYALA RAMOS, CARLOS DANIEL',
    escuelaProfesional: escuela,
    verificacionId: 'perfil-prueba',
    verificacionExpiraEn: DateTime.now().add(const Duration(minutes: 10)),
  );

  @override
  Future<InicioGoogleOauth> iniciarGoogle(String verificacionIntranetId) {
    iniciosGoogle += 1;
    return super.iniciarGoogle(verificacionIntranetId);
  }
}

class AbridorIntranetFalso implements AbridorOauth {
  int aperturas = 0;

  @override
  Future<bool> abrir(Uri url) async {
    aperturas += 1;
    return false;
  }
}

void main() {
  for (final escuela in ['Ingeniería de Sistemas', null]) {
    testWidgets(
      'muestra los datos antes de Google con escuela ${escuela ?? 'no disponible'}',
      (tester) async {
        final cliente = ClienteIntranetFalso(escuela);
        final sesion = ControladorSesion(
          clienteApi: cliente,
          almacenSesion: AlmacenSesionFalso(),
          rolesPermitidos: const {'ESTUDIANTE'},
        );
        final abridor = AbridorIntranetFalso();
        final controlador = ControladorVerificacionIntranet(
          clienteApi: cliente,
          controladorSesion: sesion,
          abridorOauth: abridor,
        );
        addTearDown(controlador.dispose);
        addTearDown(sesion.dispose);

        await tester.pumpWidget(
          MaterialApp(
            home: PantallaVerificacionIntranet(controlador: controlador),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Continuar con Google institucional'), findsNothing);
        final campos = find.byType(TextFormField);
        await tester.enterText(campos.at(0), '2022074266');
        await tester.enterText(campos.at(1), '123456');
        await tester.enterText(campos.at(2), '3868');
        final verificar = find.byWidgetPredicate(
          (widget) => widget is FilledButton,
        );
        await tester.ensureVisible(verificar);
        await tester.tap(verificar);
        await tester.pumpAndSettle();

        expect(find.text('Nombre completo'), findsOneWidget);
        expect(find.text('AYALA RAMOS, CARLOS DANIEL'), findsOneWidget);
        expect(find.text('Código institucional'), findsOneWidget);
        expect(find.text('2022074266'), findsOneWidget);
        expect(find.text('Escuela profesional'), findsOneWidget);
        expect(
          find.text(escuela ?? 'No disponible en la intranet'),
          findsOneWidget,
        );
        expect(find.byType(TextFormField), findsNothing);
        final continuar = find.ancestor(
          of: find.text('Continuar con Google institucional'),
          matching: find.byWidgetPredicate((widget) => widget is FilledButton),
        );
        expect(tester.widget<FilledButton>(continuar).onPressed, isNotNull);
        expect(cliente.iniciosGoogle, 0);
        expect(abridor.aperturas, 0);
        expect(sesion.estaAutenticada, isFalse);

        final volver = find.text('Volver a verificar intranet');
        await tester.ensureVisible(volver);
        await tester.tap(volver);
        await tester.pumpAndSettle();
        expect(find.byType(TextFormField), findsNWidgets(3));
        expect(find.text('Intranet verificada'), findsNothing);
        expect(cliente.iniciosGoogle, 0);
      },
    );
  }
}
