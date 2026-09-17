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

void main() {
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
