import 'dart:async';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_verificador/controladores/controlador_validacion_ingresos.dart';
import 'package:seguridad_verificador/servicios/proveedor_ubicacion.dart';

import 'ayudas/dobles_hito_11.dart';

class ClienteHistorialPendiente extends ClienteSeguridadFalso {
  ClienteHistorialPendiente()
    : super(resultadoValidacion: crearResultadoAutorizado());

  final respuesta = Completer<List<RegistroIngresoReciente>>();
  final consultaIniciada = Completer<void>();

  @override
  Future<List<RegistroIngresoReciente>> consultarIngresosRecientes(
    String tokenAcceso, {
    int limite = 20,
  }) {
    consultaIniciada.complete();
    return respuesta.future;
  }
}

class ClienteValidacionPendiente extends ClienteSeguridadFalso {
  ClienteValidacionPendiente()
    : super(resultadoValidacion: crearResultadoAutorizado());

  final respuesta = Completer<ResultadoValidacionIngreso>();
  final validacionIniciada = Completer<void>();

  @override
  Future<ResultadoValidacionIngreso> validarIngreso({
    required String tokenAcceso,
    required String codigoQr,
    required String puntoAccesoCodigo,
    required UbicacionReportada ubicacion,
  }) {
    validacionIniciada.complete();
    return respuesta.future;
  }
}

void main() {
  Future<
    ({
      ClienteSeguridadFalso cliente,
      ControladorSesion sesion,
      ControladorValidacionIngresos controlador,
      ProveedorUbicacionFalso ubicacion,
    })
  >
  preparar({
    ResultadoValidacionIngreso? resultado,
    ExcepcionUbicacion? errorUbicacion,
    String puntoAcceso = 'prueba-local',
  }) async {
    final cliente = ClienteSeguridadFalso(
      resultadoValidacion: resultado ?? crearResultadoAutorizado(),
      registros: crearHistorial(),
    );
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'SEGURIDAD'},
    );
    await sesion.iniciarSesion('PRUEBA-SEG-001', 'contrasena-de-prueba');
    final ubicacion = ProveedorUbicacionFalso(
      ubicacion: crearUbicacion(),
      error: errorUbicacion,
    );
    final controlador = ControladorValidacionIngresos(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ubicacion,
      puntoAccesoCodigo: puntoAcceso,
    );
    return (
      cliente: cliente,
      sesion: sesion,
      controlador: controlador,
      ubicacion: ubicacion,
    );
  }

  test('envía código, punto normalizado y ubicación al backend', () async {
    final escenario = await preparar();
    addTearDown(escenario.controlador.dispose);
    addTearDown(escenario.sesion.dispose);

    final procesado = await escenario.controlador.validarCodigoQr(
      'upt_qr_v1.credencial-opaca',
    );

    expect(procesado, isTrue);
    expect(escenario.cliente.validaciones, 1);
    expect(escenario.cliente.codigoQrRecibido, 'upt_qr_v1.credencial-opaca');
    expect(escenario.cliente.puntoAccesoRecibido, 'PRUEBA-LOCAL');
    expect(escenario.cliente.ubicacionRecibida!.precisionMetros, 10);
    expect(escenario.controlador.validacion.datos!.autorizado, isTrue);
  });

  test('trata una denegación como decisión procesada', () async {
    final escenario = await preparar(resultado: crearResultadoDenegado());
    addTearDown(escenario.controlador.dispose);
    addTearDown(escenario.sesion.dispose);

    final procesado = await escenario.controlador.validarCodigoQr('codigo');

    expect(procesado, isTrue);
    expect(escenario.controlador.validacion.fase, FaseCarga.completada);
    expect(escenario.controlador.validacion.datos!.autorizado, isFalse);
    expect(escenario.controlador.validacion.datos!.identidad, isNull);
  });

  test('falla de forma segura si una autorización no trae identidad', () async {
    final incompleto = crearResultadoAutorizado();
    final escenario = await preparar(
      resultado: ResultadoValidacionIngreso(
        resultado: incompleto.resultado,
        motivo: incompleto.motivo,
        mensaje: incompleto.mensaje,
        registradoEn: incompleto.registradoEn,
        puntoAccesoCodigo: incompleto.puntoAccesoCodigo,
        puntoAccesoNombre: incompleto.puntoAccesoNombre,
        identidad: null,
      ),
    );
    addTearDown(escenario.controlador.dispose);
    addTearDown(escenario.sesion.dispose);

    final procesado = await escenario.controlador.validarCodigoQr('codigo');

    expect(procesado, isFalse);
    expect(escenario.controlador.validacion.fase, FaseCarga.error);
    expect(
      escenario.controlador.validacion.mensaje,
      contains('No permitas el ingreso'),
    );
  });

  test('no llama al backend cuando falla la ubicación', () async {
    final escenario = await preparar(
      errorUbicacion: const ExcepcionUbicacion(
        'El permiso de ubicación está bloqueado.',
      ),
    );
    addTearDown(escenario.controlador.dispose);
    addTearDown(escenario.sesion.dispose);

    final procesado = await escenario.controlador.validarCodigoQr('codigo');

    expect(procesado, isFalse);
    expect(escenario.cliente.validaciones, 0);
    expect(escenario.controlador.validacion.fase, FaseCarga.error);
    expect(
      escenario.controlador.validacion.mensaje,
      'El permiso de ubicación está bloqueado.',
    );
  });

  test(
    'rechaza una configuración de punto inválida antes de usar GPS',
    () async {
      final escenario = await preparar(puntoAcceso: '');
      addTearDown(escenario.controlador.dispose);
      addTearDown(escenario.sesion.dispose);

      final procesado = await escenario.controlador.validarCodigoQr('codigo');

      expect(procesado, isFalse);
      expect(escenario.ubicacion.solicitudes, 0);
      expect(escenario.cliente.validaciones, 0);
    },
  );

  test('consulta hasta 50 registros del propio operador', () async {
    final escenario = await preparar();
    addTearDown(escenario.controlador.dispose);
    addTearDown(escenario.sesion.dispose);

    final cargado = await escenario.controlador.cargarHistorial();

    expect(cargado, isTrue);
    expect(escenario.cliente.consultasHistorial, 1);
    expect(escenario.controlador.historial.datos, hasLength(2));
  });

  test('descarta el historial recibido después de cerrar sesión', () async {
    final cliente = ClienteHistorialPendiente();
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'SEGURIDAD'},
    );
    await sesion.iniciarSesion('PRUEBA-SEG-001', 'clave-de-prueba');
    final controlador = ControladorValidacionIngresos(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
      puntoAccesoCodigo: 'PRUEBA-LOCAL',
    );
    addTearDown(controlador.dispose);
    addTearDown(sesion.dispose);

    final consulta = controlador.cargarHistorial();
    await cliente.consultaIniciada.future;
    await sesion.cerrarSesion();
    cliente.respuesta.complete(crearHistorial());

    expect(await consulta, isFalse);
    expect(controlador.historial.datos, isNull);
  });

  test('descarta una validación recibida después de cambiar sesión', () async {
    final cliente = ClienteValidacionPendiente();
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'SEGURIDAD'},
    );
    await sesion.iniciarSesion('PRUEBA-SEG-001', 'clave-de-prueba');
    final controlador = ControladorValidacionIngresos(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ProveedorUbicacionFalso(ubicacion: crearUbicacion()),
      puntoAccesoCodigo: 'PRUEBA-LOCAL',
    );
    addTearDown(controlador.dispose);
    addTearDown(sesion.dispose);

    final validacion = controlador.validarCodigoQr('codigo-pendiente');
    await cliente.validacionIniciada.future;
    await sesion.cerrarSesion();
    await sesion.iniciarSesion('PRUEBA-SEG-001', 'clave-de-prueba');
    cliente.respuesta.complete(crearResultadoAutorizado());

    expect(await validacion, isFalse);
    expect(controlador.validacion.datos, isNull);
  });
}
