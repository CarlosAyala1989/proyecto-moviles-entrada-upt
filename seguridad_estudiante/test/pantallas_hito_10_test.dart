import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:seguridad_estudiante/controladores/controlador_identidad_qr.dart';
import 'package:seguridad_estudiante/pantallas/pantalla_codigo_qr.dart';
import 'package:seguridad_estudiante/pantallas/pantalla_identidad_digital.dart';

import 'ayudas/dobles_hito_10.dart';

void main() {
  final ahora = DateTime.utc(2026, 9, 12, 15);

  Future<({ControladorSesion sesion, ControladorIdentidadQr controlador})>
  preparar() async {
    final cliente = ClientePortadorFalso(
      identidad: crearIdentidadPortador(),
      codigoQr: crearCodigoQr(ahora),
    );
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'ESTUDIANTE'},
    );
    await sesion.iniciarSesion('PRUEBA-EST-001', 'contrasena-de-prueba');
    final controlador = ControladorIdentidadQr(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
      ahora: () => ahora,
    );
    return (sesion: sesion, controlador: controlador);
  }

  testWidgets('presenta el perfil institucional completo', (probador) async {
    final escenario = await preparar();

    await probador.pumpWidget(
      MaterialApp(
        home: PantallaIdentidadDigital(controlador: escenario.controlador),
      ),
    );
    await probador.pumpAndSettle();

    expect(find.text('María Elena Pérez Quispe'), findsOneWidget);
    expect(find.text('PRUEBA-EST-001'), findsOneWidget);
    expect(find.text('Ingeniería de Sistemas'), findsOneWidget);
    expect(find.text('Identidad: VERIFICADA'), findsOneWidget);
    await probador.drag(find.byType(ListView), const Offset(0, -500));
    await probador.pumpAndSettle();
    expect(find.text('Solicitar código QR'), findsOneWidget);

    await probador.pumpWidget(const SizedBox());
    escenario.controlador.dispose();
    escenario.sesion.dispose();
  });

  testWidgets('representa la credencial y su cuenta regresiva', (
    probador,
  ) async {
    final escenario = await preparar();

    await probador.pumpWidget(
      MaterialApp(home: PantallaCodigoQr(controlador: escenario.controlador)),
    );
    await probador.pumpAndSettle();
    await probador.tap(find.text('Usar mi ubicación y generar'));
    await probador.pumpAndSettle();

    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.text('45 s'), findsOneWidget);
    expect(find.text('Puerta principal'), findsOneWidget);
    await probador.drag(find.byType(ListView), const Offset(0, -500));
    await probador.pumpAndSettle();
    expect(find.text('Anular código'), findsOneWidget);

    await probador.pumpWidget(const SizedBox());
    escenario.controlador.dispose();
    escenario.sesion.dispose();
  });
}
