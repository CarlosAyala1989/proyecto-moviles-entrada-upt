import 'dart:async';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_estudiante/controladores/controlador_identidad_qr.dart';
import 'package:seguridad_estudiante/servicios/proveedor_ubicacion.dart';

import 'ayudas/dobles_hito_10.dart';

class ClienteIdentidadPendiente extends ClientePortadorFalso {
  ClienteIdentidadPendiente()
    : super(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(DateTime.now().toUtc()),
      );

  final respuesta = Completer<IdentidadDigital>();
  final consultaIniciada = Completer<void>();

  @override
  Future<IdentidadDigital> consultarIdentidadDigital(String tokenAcceso) {
    consultaIniciada.complete();
    return respuesta.future;
  }
}

class ClienteQrPendiente extends ClientePortadorFalso {
  ClienteQrPendiente()
    : super(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(DateTime.now().toUtc()),
      );

  final respuesta = Completer<CodigoQrTemporal>();
  final generacionIniciada = Completer<void>();

  @override
  Future<CodigoQrTemporal> generarCodigoQr(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  ) {
    generacionIniciada.complete();
    return respuesta.future;
  }
}

class ClienteQrRotatorio extends ClientePortadorFalso {
  ClienteQrRotatorio({required this.ahora})
    : super(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(ahora()),
      );

  final DateTime Function() ahora;

  @override
  Future<CodigoQrTemporal> generarCodigoQr(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  ) async {
    generacionesQr += 1;
    ubicacionRecibida = ubicacion;
    return crearCodigoQr(ahora());
  }
}

void main() {
  final ahora = DateTime.utc(2026, 9, 12, 15);

  Future<
    ({
      ClientePortadorFalso cliente,
      ControladorSesion sesion,
      ControladorIdentidadQr controlador,
      ProveedorUbicacionFalso ubicacion,
    })
  >
  preparar({
    ExcepcionUbicacion? errorUbicacion,
    bool puedeSolicitar = true,
  }) async {
    final cliente = ClientePortadorFalso(
      identidad: crearIdentidadPortador(puedeSolicitar: puedeSolicitar),
      codigoQr: crearCodigoQr(ahora),
    );
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'ESTUDIANTE', 'DOCENTE', 'TRABAJADOR'},
    );
    await sesion.iniciarSesion('PRUEBA-EST-001', 'contrasena-de-prueba');
    final ubicacion = ProveedorUbicacionFalso(
      ubicacion: crearUbicacion(),
      error: errorUbicacion,
    );
    final controlador = ControladorIdentidadQr(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ubicacion,
      ahora: () => ahora,
    );
    return (
      cliente: cliente,
      sesion: sesion,
      controlador: controlador,
      ubicacion: ubicacion,
    );
  }

  test('consulta la identidad del usuario autenticado', () async {
    final escenario = await preparar();
    addTearDown(escenario.controlador.dispose);
    addTearDown(escenario.sesion.dispose);

    final resultado = await escenario.controlador.cargarIdentidad();

    expect(resultado, isTrue);
    expect(escenario.controlador.identidad.fase, FaseCarga.completada);
    expect(
      escenario.controlador.identidad.datos!.nombreCompleto,
      'María Elena Pérez Quispe',
    );
    expect(escenario.cliente.consultasIdentidad, 1);
  });

  test('genera y anula una credencial con ubicación reciente', () async {
    final escenario = await preparar();
    addTearDown(escenario.controlador.dispose);
    addTearDown(escenario.sesion.dispose);

    final generado = await escenario.controlador.generarCodigoQr();

    expect(generado, isTrue);
    expect(escenario.ubicacion.solicitudes, 1);
    expect(escenario.cliente.generacionesQr, 1);
    expect(escenario.cliente.ubicacionRecibida!.precisionMetros, 12);
    expect(escenario.controlador.codigoQrVigente, isTrue);
    expect(escenario.controlador.segundosRestantes, 15);

    final revocado = await escenario.controlador.revocarCodigoQr();

    expect(revocado, isTrue);
    expect(escenario.cliente.revocacionesQr, 1);
    expect(escenario.controlador.codigoQr.fase, FaseCarga.inicial);
  });

  test('explica cuando el permiso de ubicación está bloqueado', () async {
    final escenario = await preparar(
      errorUbicacion: const ExcepcionUbicacion(
        'El permiso de ubicación está bloqueado.',
      ),
    );
    addTearDown(escenario.controlador.dispose);
    addTearDown(escenario.sesion.dispose);

    final generado = await escenario.controlador.generarCodigoQr();

    expect(generado, isFalse);
    expect(escenario.cliente.generacionesQr, 0);
    expect(escenario.controlador.codigoQr.fase, FaseCarga.error);
    expect(
      escenario.controlador.codigoQr.mensaje,
      'El permiso de ubicación está bloqueado.',
    );
  });

  test('no solicita ubicación si la identidad no está habilitada', () async {
    final escenario = await preparar(puedeSolicitar: false);
    addTearDown(escenario.controlador.dispose);
    addTearDown(escenario.sesion.dispose);

    final generado = await escenario.controlador.generarCodigoQr();

    expect(generado, isFalse);
    expect(escenario.ubicacion.solicitudes, 0);
    expect(escenario.cliente.generacionesQr, 0);
    expect(escenario.controlador.codigoQr.fase, FaseCarga.error);
  });

  test(
    'descarta una identidad recibida después de cambiar la sesión',
    () async {
      final cliente = ClienteIdentidadPendiente();
      final sesion = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: AlmacenSesionFalso(),
        rolesPermitidos: const {'ESTUDIANTE'},
      );
      await sesion.iniciarSesion('PRUEBA-EST-001', 'clave-de-prueba');
      final controlador = ControladorIdentidadQr(
        clienteApi: cliente,
        controladorSesion: sesion,
        proveedorUbicacion: ProveedorUbicacionFalso(
          ubicacion: crearUbicacion(),
        ),
      );
      addTearDown(controlador.dispose);
      addTearDown(sesion.dispose);

      final consulta = controlador.cargarIdentidad();
      await cliente.consultaIniciada.future;
      await sesion.cerrarSesion();
      await sesion.iniciarSesion('PRUEBA-EST-001', 'clave-de-prueba');
      cliente.respuesta.complete(crearIdentidadPortador());

      expect(await consulta, isFalse);
      expect(controlador.identidad.datos, isNull);
    },
  );

  test('descarta un QR recibido después de cambiar la sesión', () async {
    final cliente = ClienteQrPendiente();
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'ESTUDIANTE'},
    );
    await sesion.iniciarSesion('PRUEBA-EST-001', 'clave-de-prueba');
    final controlador = ControladorIdentidadQr(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
      ahora: () => ahora,
    );
    addTearDown(controlador.dispose);
    addTearDown(sesion.dispose);

    final generacion = controlador.generarCodigoQr();
    await cliente.generacionIniciada.future;
    await sesion.cerrarSesion();
    await sesion.iniciarSesion('PRUEBA-EST-001', 'clave-de-prueba');
    cliente.respuesta.complete(crearCodigoQr(ahora));

    expect(await generacion, isFalse);
    expect(controlador.codigoQr.datos, isNull);
    expect(controlador.segundosRestantes, 0);
  });

  testWidgets('renueva automáticamente el QR al completar los 15 segundos', (
    probador,
  ) async {
    var instante = ahora;
    final cliente = ClienteQrRotatorio(ahora: () => instante);
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'ESTUDIANTE'},
    );
    await sesion.iniciarSesion('PRUEBA-EST-001', 'clave-de-prueba');
    final controlador = ControladorIdentidadQr(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
      ahora: () => instante,
    );
    addTearDown(controlador.dispose);
    addTearDown(sesion.dispose);

    expect(await controlador.iniciarRotacionAutomatica(), isTrue);
    expect(cliente.generacionesQr, 1);

    instante = instante.add(const Duration(seconds: 15));
    await probador.pump(const Duration(seconds: 1));
    await probador.pump();
    await probador.pump();

    expect(cliente.generacionesQr, 2);
    expect(controlador.codigoQrVigente, isTrue);
    expect(controlador.segundosRestantes, 15);
    expect(controlador.rotacionAutomatica, isTrue);
    controlador.detenerRotacionAutomatica();
  });
}
