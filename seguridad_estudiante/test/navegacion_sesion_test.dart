import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_estudiante/aplicacion/aplicacion_estudiante.dart';
import 'package:seguridad_estudiante/controladores/controlador_identidad_qr.dart';
import 'package:seguridad_estudiante/controladores/controlador_verificacion_intranet.dart';
import 'package:seguridad_estudiante/pantallas/pantalla_codigo_qr.dart';
import 'package:seguridad_estudiante/pantallas/pantalla_inicio_sesion.dart';
import 'package:seguridad_estudiante/servicios/abridor_oauth.dart';

import 'ayudas/dobles_hito_10.dart';

class AlmacenPortadorQueFalla extends AlmacenSesionFalso {
  @override
  Future<void> limpiar() => throw StateError('almacenamiento no disponible');
}

class ClientePortadorConCierreFallido extends ClientePortadorFalso {
  ClientePortadorConCierreFallido()
    : super(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(DateTime.now().toUtc()),
      );

  @override
  Future<void> cerrarSesion(String tokenAcceso) => throw const ExcepcionApi(
    codigo: 'ERROR_CONEXION',
    mensaje: 'Sin conexión.',
  );
}

class AbridorOauthFalso implements AbridorOauth {
  @override
  Future<bool> abrir(Uri url) async => true;
}

class ClienteConsultaIntranetFalso extends ClientePortadorFalso {
  ClienteConsultaIntranetFalso()
    : super(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(DateTime.now().toUtc()),
        sesion: crearSesionPortador(codigo: '1111222233'),
      );

  int captchas = 0;
  int consultas = 0;

  @override
  Future<CaptchaIntranet> obtenerCaptchaIntranet() async => CaptchaIntranet(
    transaccionId: 'captcha-${++captchas}',
    imagenBase64:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
    tipoImagen: 'image/png',
    expiraEn: DateTime.now().add(const Duration(minutes: 5)),
  );

  @override
  Future<DatosEstudianteIntranet> consultarDatosEstudianteIntranet({
    required String transaccionId,
    required String codigo,
    required String contrasena,
    required String captcha,
  }) async {
    expect(codigo, '1111222233');
    expect(contrasena, '123456');
    expect(captcha, '3868');
    expect(transaccionId, 'captcha-${++consultas}');
    if (consultas == 1) {
      throw const ExcepcionApi(
        codigo: 'CAPTCHA_EXPIRADO',
        mensaje: 'CAPTCHA vencido.',
      );
    }
    return DatosEstudianteIntranet.desdeJson({
      'estado': 'parcial',
      'fecha_extraccion': '2026-11-13T17:00:00Z',
      'notas_actuales': {
        'estado': 'leida',
        'cursos_con_notas': [
          {
            'curso': 'Matemática de prueba',
            'unidades': [
              {
                'unidad': 'Unidad I',
                'evaluaciones': [
                  {'Criterio': 'Examen', 'Nota': '17'},
                ],
              },
            ],
          },
        ],
      },
      'economia_inicio': {
        'estado': 'leida',
        'total': '200.50',
        'tablas': [
          {
            'cabeceras': ['Descripción', 'Monto', 'Vence'],
            'filas': [
              ['Cuarta cuota', '200.50', '30/11/2026'],
              ['Total S/.', '200.50', ''],
            ],
          },
        ],
      },
      'pasarela': {'estado': 'requiere_autenticacion'},
    });
  }
}

void main() {
  testWidgets(
    'consulta notas y cuotas desde el perfil con un CAPTCHA nuevo al reintentar',
    (probador) async {
      probador.view.physicalSize = const Size(390, 844);
      probador.view.devicePixelRatio = 1;
      addTearDown(probador.view.resetPhysicalSize);
      addTearDown(probador.view.resetDevicePixelRatio);

      final cliente = ClienteConsultaIntranetFalso();
      final sesion = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: AlmacenSesionFalso(),
        rolesPermitidos: const {'ESTUDIANTE'},
      );
      await sesion.iniciarSesion('1111222233', 'clave-de-prueba');
      final identidadQr = ControladorIdentidadQr(
        clienteApi: cliente,
        controladorSesion: sesion,
        proveedorUbicacion: ProveedorUbicacionFalso(
          ubicacion: crearUbicacion(),
        ),
      );
      final verificacion = ControladorVerificacionIntranet(
        clienteApi: cliente,
        controladorSesion: sesion,
        abridorOauth: AbridorOauthFalso(),
      );
      await probador.pumpWidget(
        AplicacionEstudiante(
          controladorSesion: sesion,
          controladorIdentidadQr: identidadQr,
          controladorVerificacionIntranet: verificacion,
          clienteConsultaIntranet: cliente,
        ),
      );
      await probador.tap(find.text('Consultar identidad digital'));
      await probador.pumpAndSettle();
      expect(cliente.captchas, 0);
      final opcion = find.text('Datos académicos y pagos');
      await probador.ensureVisible(opcion);
      await probador.tap(opcion);
      await probador.pumpAndSettle();
      expect(find.text('1111222233'), findsOneWidget);
      expect(cliente.consultas, 0);

      Future<void> consultar() async {
        final campos = find.byType(TextFormField);
        await probador.enterText(campos.at(0), '123456');
        await probador.enterText(campos.at(1), '3868');
        final boton = find.text('Consultar datos');
        await probador.ensureVisible(boton);
        await probador.tap(boton);
        await probador.pumpAndSettle();
      }

      await consultar();
      expect(cliente.captchas, 2);
      expect(find.textContaining('ya venció'), findsOneWidget);
      expect(
        probador
            .widget<EditableText>(find.byType(EditableText).first)
            .controller
            .text,
        isEmpty,
      );
      await consultar();
      expect(cliente.consultas, 2);
      expect(sesion.estaAutenticada, isTrue);
      expect(find.text('Continuar con Google institucional'), findsNothing);
      expect(
        find.text('Algunas secciones no están disponibles'),
        findsOneWidget,
      );
      await probador.tap(find.text('Notas actuales'));
      await probador.pumpAndSettle();
      await probador.tap(find.text('Matemática de prueba'));
      await probador.pumpAndSettle();
      expect(find.text('Nota · 17'), findsOneWidget);
      await probador.pageBack();
      await probador.pumpAndSettle();
      final cuotas = find.text('Cuotas y vencimientos');
      await probador.scrollUntilVisible(cuotas, 180);
      await probador.tap(cuotas);
      await probador.pumpAndSettle();
      expect(find.text('Total pendiente · S/ 200.50'), findsOneWidget);
      expect(find.text('Cuarta cuota'), findsOneWidget);
      expect(find.text('Vence · 30/11/2026').hitTestable(), findsOneWidget);
      expect(probador.takeException(), isNull);
      await sesion.cerrarSesion();
      await probador.pumpAndSettle();
      expect(find.byType(PantallaInicioSesion), findsOneWidget);
      expect(find.text('Cuarta cuota'), findsNothing);
      await probador.pumpWidget(const SizedBox());
      identidadQr.dispose();
      verificacion.dispose();
      sesion.dispose();
    },
  );

  testWidgets('ofrece un único acceso institucional sin credenciales locales', (
    probador,
  ) async {
    final cliente = ClientePortadorFalso(
      identidad: crearIdentidadPortador(),
      codigoQr: crearCodigoQr(DateTime.now().toUtc()),
    );
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'ESTUDIANTE'},
    );
    await sesion.restaurar();
    final identidadQr = ControladorIdentidadQr(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
    );
    final verificacionIntranet = ControladorVerificacionIntranet(
      clienteApi: cliente,
      controladorSesion: sesion,
      abridorOauth: AbridorOauthFalso(),
    );

    await probador.pumpWidget(
      AplicacionEstudiante(
        controladorSesion: sesion,
        controladorIdentidadQr: identidadQr,
        controladorVerificacionIntranet: verificacionIntranet,
        clienteConsultaIntranet: cliente,
      ),
    );
    expect(find.byType(PantallaInicioSesion), findsOneWidget);
    expect(find.byType(TextFormField), findsNothing);
    expect(find.text('Ingresar o registrarme'), findsOneWidget);
    expect(find.textContaining('contraseña local'), findsOneWidget);
    expect(probador.takeException(), isNull);

    await probador.pumpWidget(const SizedBox());
    identidadQr.dispose();
    verificacionIntranet.dispose();
    sesion.dispose();
  });

  testWidgets('retira las rutas protegidas al terminar la sesión', (
    probador,
  ) async {
    final cliente = ClientePortadorFalso(
      identidad: crearIdentidadPortador(),
      codigoQr: crearCodigoQr(DateTime.now().toUtc()),
    );
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'ESTUDIANTE'},
    );
    await sesion.iniciarSesion('PRUEBA-EST-001', 'clave-de-prueba');
    final identidadQr = ControladorIdentidadQr(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
    );
    final verificacionIntranet = ControladorVerificacionIntranet(
      clienteApi: cliente,
      controladorSesion: sesion,
      abridorOauth: AbridorOauthFalso(),
    );

    await probador.pumpWidget(
      AplicacionEstudiante(
        controladorSesion: sesion,
        controladorIdentidadQr: identidadQr,
        controladorVerificacionIntranet: verificacionIntranet,
        clienteConsultaIntranet: cliente,
      ),
    );
    await probador.tap(find.text('Solicitar código QR'));
    await probador.pumpAndSettle();
    expect(find.byType(PantallaCodigoQr), findsOneWidget);

    await sesion.cerrarSesion();
    await probador.pumpAndSettle();

    expect(find.byType(PantallaInicioSesion), findsOneWidget);
    expect(find.byType(PantallaCodigoQr), findsNothing);
    expect(find.byType(TextFormField), findsNothing);
    expect(find.text('Ingresar o registrarme'), findsOneWidget);

    await probador.pumpWidget(const SizedBox());
    identidadQr.dispose();
    verificacionIntranet.dispose();
    sesion.dispose();
  });

  testWidgets('muestra cuando no puede cerrar la sesión de forma segura', (
    probador,
  ) async {
    final cliente = ClientePortadorConCierreFallido();
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenPortadorQueFalla(),
      rolesPermitidos: const {'ESTUDIANTE'},
    );
    await sesion.iniciarSesion('PRUEBA-EST-001', 'clave-de-prueba');
    final identidadQr = ControladorIdentidadQr(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
    );
    final verificacionIntranet = ControladorVerificacionIntranet(
      clienteApi: cliente,
      controladorSesion: sesion,
      abridorOauth: AbridorOauthFalso(),
    );

    await probador.pumpWidget(
      AplicacionEstudiante(
        controladorSesion: sesion,
        controladorIdentidadQr: identidadQr,
        controladorVerificacionIntranet: verificacionIntranet,
        clienteConsultaIntranet: cliente,
      ),
    );
    await probador.tap(find.byTooltip('Cerrar sesión'));
    await probador.pumpAndSettle();

    expect(find.textContaining('cerrar tu cuenta'), findsOneWidget);
    expect(sesion.estaAutenticada, isTrue);

    await probador.pumpWidget(const SizedBox());
    identidadQr.dispose();
    verificacionIntranet.dispose();
    sesion.dispose();
  });
}
