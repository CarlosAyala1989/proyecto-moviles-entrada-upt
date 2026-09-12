import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_verificador/controladores/controlador_validacion_ingresos.dart';
import 'package:seguridad_verificador/pantallas/pantalla_escaner.dart';
import 'package:seguridad_verificador/pantallas/pantalla_historial.dart';

import 'ayudas/dobles_hito_11.dart';

void main() {
  Future<
    ({ControladorSesion sesion, ControladorValidacionIngresos controlador})
  >
  preparar(ResultadoValidacionIngreso resultado) async {
    final cliente = ClienteSeguridadFalso(
      resultadoValidacion: resultado,
      registros: crearHistorial(),
    );
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'SEGURIDAD'},
    );
    await sesion.iniciarSesion('PRUEBA-SEG-001', 'contrasena-de-prueba');
    final controlador = ControladorValidacionIngresos(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
      puntoAccesoCodigo: 'PRUEBA-LOCAL',
    );
    return (sesion: sesion, controlador: controlador);
  }

  Widget escanerFalso(ValueChanged<String> alDetectar) => Center(
    child: FilledButton(
      onPressed: () => alDetectar('upt_qr_v1.credencial-opaca'),
      child: const Text('Simular lectura'),
    ),
  );

  testWidgets('muestra identidad sólo cuando el ingreso es autorizado', (
    probador,
  ) async {
    final escenario = await preparar(crearResultadoAutorizado());

    await probador.pumpWidget(
      MaterialApp(
        home: PantallaEscaner(
          controlador: escenario.controlador,
          constructorEscaner: escanerFalso,
        ),
      ),
    );
    await probador.tap(find.text('Simular lectura'));
    await probador.pumpAndSettle();

    expect(find.text('INGRESO AUTORIZADO'), findsOneWidget);
    expect(find.text('María Elena Pérez Quispe'), findsOneWidget);
    expect(find.text('PRUEBA-EST-001'), findsOneWidget);

    await probador.pumpWidget(const SizedBox());
    escenario.controlador.dispose();
    escenario.sesion.dispose();
  });

  testWidgets('una denegación no presenta datos de identidad', (
    probador,
  ) async {
    final escenario = await preparar(crearResultadoDenegado());

    await probador.pumpWidget(
      MaterialApp(
        home: PantallaEscaner(
          controlador: escenario.controlador,
          constructorEscaner: escanerFalso,
        ),
      ),
    );
    await probador.tap(find.text('Simular lectura'));
    await probador.pumpAndSettle();

    expect(find.text('INGRESO DENEGADO'), findsOneWidget);
    expect(find.text('Credencial ya utilizada'), findsOneWidget);
    expect(find.text('María Elena Pérez Quispe'), findsNothing);

    await probador.pumpWidget(const SizedBox());
    escenario.controlador.dispose();
    escenario.sesion.dispose();
  });

  testWidgets('presenta el historial reciente del operador', (probador) async {
    final escenario = await preparar(crearResultadoAutorizado());

    await probador.pumpWidget(
      MaterialApp(home: PantallaHistorial(controlador: escenario.controlador)),
    );
    await probador.pumpAndSettle();

    expect(
      find.text('Últimos 2 intentos procesados por tu cuenta'),
      findsOneWidget,
    );
    expect(find.text('AUTORIZADO'), findsOneWidget);
    expect(find.text('DENEGADO'), findsOneWidget);
    expect(find.text('María Elena Pérez Quispe'), findsOneWidget);

    await probador.pumpWidget(const SizedBox());
    escenario.controlador.dispose();
    escenario.sesion.dispose();
  });
}
