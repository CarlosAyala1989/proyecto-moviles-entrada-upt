import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_verificador/aplicacion/aplicacion_seguridad.dart';
import 'package:seguridad_verificador/controladores/controlador_validacion_ingresos.dart';
import 'package:seguridad_verificador/pantallas/pantalla_historial.dart';
import 'package:seguridad_verificador/pantallas/pantalla_inicio_seguridad.dart';
import 'package:seguridad_verificador/pantallas/pantalla_inicio_sesion_seguridad.dart';

import 'ayudas/dobles_hito_11.dart';

class AlmacenSeguridadQueFalla extends AlmacenSesionFalso {
  @override
  Future<void> limpiar() => throw StateError('almacenamiento no disponible');
}

class ClienteSeguridadConCierreFallido extends ClienteSeguridadFalso {
  ClienteSeguridadConCierreFallido()
    : super(resultadoValidacion: crearResultadoAutorizado());

  @override
  Future<void> cerrarSesion(String tokenAcceso) => throw const ExcepcionApi(
    codigo: 'ERROR_CONEXION',
    mensaje: 'Sin conexión.',
  );
}

void main() {
  testWidgets('no usa los campos de acceso después de desmontar la pantalla', (
    probador,
  ) async {
    final cliente = ClienteSeguridadFalso(
      resultadoValidacion: crearResultadoAutorizado(),
      registros: crearHistorial(),
    );
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'SEGURIDAD'},
    );
    await sesion.restaurar();
    final validacion = ControladorValidacionIngresos(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
      puntoAccesoCodigo: 'PRUEBA-LOCAL',
    );

    await probador.pumpWidget(
      AplicacionSeguridad(
        controladorSesion: sesion,
        controladorValidacion: validacion,
      ),
    );
    await probador.enterText(
      find.byType(TextFormField).at(0),
      'PRUEBA-SEG-001',
    );
    await probador.enterText(
      find.byType(TextFormField).at(1),
      'clave-de-prueba',
    );
    await probador.tap(find.text('Iniciar sesión'));
    await probador.pumpAndSettle();

    expect(find.byType(PantallaInicioSeguridad), findsOneWidget);
    expect(probador.takeException(), isNull);

    await probador.pumpWidget(const SizedBox());
    validacion.dispose();
    sesion.dispose();
  });

  testWidgets('retira las rutas protegidas al terminar la sesión', (
    probador,
  ) async {
    final cliente = ClienteSeguridadFalso(
      resultadoValidacion: crearResultadoAutorizado(),
      registros: crearHistorial(),
    );
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'SEGURIDAD'},
    );
    await sesion.iniciarSesion('PRUEBA-SEG-001', 'clave-de-prueba');
    final validacion = ControladorValidacionIngresos(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
      puntoAccesoCodigo: 'PRUEBA-LOCAL',
    );

    await probador.pumpWidget(
      AplicacionSeguridad(
        controladorSesion: sesion,
        controladorValidacion: validacion,
      ),
    );
    await probador.tap(find.text('Historial reciente'));
    await probador.pumpAndSettle();
    expect(find.byType(PantallaHistorial), findsOneWidget);

    await sesion.cerrarSesion();
    await probador.pumpAndSettle();

    expect(find.byType(PantallaInicioSesionSeguridad), findsOneWidget);
    expect(find.byType(PantallaHistorial), findsNothing);

    await probador.pumpWidget(const SizedBox());
    validacion.dispose();
    sesion.dispose();
  });

  testWidgets('muestra cuando no puede cerrar la sesión de forma segura', (
    probador,
  ) async {
    final cliente = ClienteSeguridadConCierreFallido();
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSeguridadQueFalla(),
      rolesPermitidos: const {'SEGURIDAD'},
    );
    await sesion.iniciarSesion('PRUEBA-SEG-001', 'clave-de-prueba');
    final validacion = ControladorValidacionIngresos(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
      puntoAccesoCodigo: 'PRUEBA-LOCAL',
    );

    await probador.pumpWidget(
      AplicacionSeguridad(
        controladorSesion: sesion,
        controladorValidacion: validacion,
      ),
    );
    await probador.tap(find.byTooltip('Cerrar sesión'));
    await probador.pumpAndSettle();

    expect(find.textContaining('cerrar tu cuenta'), findsOneWidget);
    expect(sesion.estaAutenticada, isTrue);

    await probador.pumpWidget(const SizedBox());
    validacion.dispose();
    sesion.dispose();
  });
}
