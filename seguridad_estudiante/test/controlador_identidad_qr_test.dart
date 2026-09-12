import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_estudiante/controladores/controlador_identidad_qr.dart';
import 'package:seguridad_estudiante/servicios/proveedor_ubicacion.dart';

import 'ayudas/dobles_hito_10.dart';

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
    expect(escenario.controlador.segundosRestantes, 45);

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
}
