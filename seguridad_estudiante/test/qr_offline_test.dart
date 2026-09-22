import 'dart:convert';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_estudiante/controladores/controlador_identidad_qr.dart';

import 'ayudas/dobles_hito_10.dart';

class AlmacenOfflineFalso extends AlmacenQrOffline {
  VinculacionQrOffline? vinculacion;

  @override
  Future<String> identificadorDispositivo() async => 'A' * 43;

  @override
  Future<VinculacionQrOffline?> recuperar(int usuarioId) async =>
      vinculacion?.usuarioId == usuarioId ? vinculacion : null;

  @override
  Future<void> guardar(VinculacionQrOffline nueva) async {
    vinculacion = nueva;
  }

  @override
  Future<void> limpiar() async {
    vinculacion = null;
  }
}

class PreparacionOfflineFalsa implements ContratoPreparacionOffline {
  bool sinConexion = false;
  int solicitudes = 0;

  @override
  Future<Map<String, dynamic>> prepararQrOffline(
    String tokenAcceso,
    String identificadorDispositivo,
    String plataforma,
  ) async {
    solicitudes += 1;
    if (sinConexion) {
      throw const ExcepcionApi(
        codigo: 'ERROR_CONEXION',
        mensaje: 'Sin conexión.',
      );
    }
    return {
      'dispositivo_id': 123,
      'secreto': base64Url.encode(List<int>.filled(32, 1)).replaceAll('=', ''),
      'hora_servidor': DateTime.now().toUtc().toIso8601String(),
      'periodo_segundos': 15,
    };
  }
}

class ClienteSinRenovacion extends ClientePortadorFalso {
  ClienteSinRenovacion()
    : super(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(DateTime.now().toUtc()),
      );

  @override
  Future<SesionUsuario> renovarSesion(String tokenRenovacion) =>
      throw const ExcepcionApi(
        codigo: 'ERROR_CONEXION',
        mensaje: 'Sin conexión.',
      );
}

void main() {
  test(
    'prepara un QR y lo sigue generando sin red ni GPS del estudiante',
    () async {
      final cliente = ClientePortadorFalso(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(DateTime.now().toUtc()),
      );
      final almacen = AlmacenOfflineFalso();
      final preparacion = PreparacionOfflineFalsa();
      final ubicacion = ProveedorUbicacionFalso(ubicacion: crearUbicacion());
      final sesion = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: AlmacenSesionFalso(),
        almacenQrOffline: almacen,
        rolesPermitidos: const {'ESTUDIANTE'},
      );
      await sesion.iniciarSesion('estudiante', 'clave');
      final controlador = ControladorIdentidadQr(
        clienteApi: cliente,
        controladorSesion: sesion,
        proveedorUbicacion: ubicacion,
        clienteOffline: preparacion,
        almacenQrOffline: almacen,
      );
      expect(await controlador.iniciarRotacionAutomatica(), isTrue);
      expect(
        controlador.codigoQr.datos!.codigoQr,
        startsWith('upt_offline_v2.'),
      );
      expect(controlador.codigoQr.datos!.otp, matches(RegExp(r'^\d{6}$')));
      expect(almacen.vinculacion, isNotNull);
      controlador.detenerRotacionAutomatica();
      preparacion.sinConexion = true;
      expect(await controlador.iniciarRotacionAutomatica(), isTrue);
      expect(controlador.codigoQrVigente, isTrue);
      expect(ubicacion.solicitudes, 0);
      expect(cliente.generacionesQr, 0);
      controlador.dispose();
      sesion.dispose();
    },
  );

  test(
    'restaura solo al estudiante vinculado cuando la sesión venció',
    () async {
      final cliente = ClientePortadorFalso(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(DateTime.now().toUtc()),
      );
      final anterior = cliente.sesion;
      final sesionVencida = SesionUsuario(
        tokenAcceso: anterior.tokenAcceso,
        tokenRenovacion: anterior.tokenRenovacion,
        tokenAccesoExpiraEn: DateTime.now().subtract(const Duration(days: 2)),
        tokenRenovacionExpiraEn: DateTime.now().subtract(
          const Duration(days: 1),
        ),
        usuario: anterior.usuario,
      );
      final almacenSesion = AlmacenSesionFalso()..sesion = sesionVencida;
      final almacenQr = AlmacenOfflineFalso()
        ..vinculacion = VinculacionQrOffline(
          usuarioId: anterior.usuario.id,
          dispositivoId: 123,
          secreto: base64Url
              .encode(List<int>.filled(32, 1))
              .replaceAll('=', ''),
          desfaseRelojMs: 0,
          periodoSegundos: 15,
        );
      final controlador = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: almacenSesion,
        almacenQrOffline: almacenQr,
        rolesPermitidos: const {'ESTUDIANTE'},
      );
      await controlador.restaurar();
      expect(controlador.estaAutenticada, isTrue);
      await expectLater(
        controlador.obtenerTokenAcceso(),
        throwsA(isA<ExcepcionApi>()),
      );
      expect(controlador.estaAutenticada, isTrue);
      controlador.dispose();
    },
  );

  test('una renovación fallida por red conserva la sesión offline', () async {
    final cliente = ClienteSinRenovacion();
    final anterior = cliente.sesion;
    final sesionSinAcceso = SesionUsuario(
      tokenAcceso: anterior.tokenAcceso,
      tokenRenovacion: anterior.tokenRenovacion,
      tokenAccesoExpiraEn: DateTime.now().subtract(const Duration(minutes: 1)),
      tokenRenovacionExpiraEn: DateTime.now().add(const Duration(days: 1)),
      usuario: anterior.usuario,
    );
    final almacenSesion = AlmacenSesionFalso()..sesion = sesionSinAcceso;
    final almacenQr = AlmacenOfflineFalso()
      ..vinculacion = VinculacionQrOffline(
        usuarioId: anterior.usuario.id,
        dispositivoId: 123,
        secreto: base64Url.encode(List<int>.filled(32, 1)).replaceAll('=', ''),
        desfaseRelojMs: 0,
        periodoSegundos: 15,
      );
    final controlador = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: almacenSesion,
      almacenQrOffline: almacenQr,
      rolesPermitidos: const {'ESTUDIANTE'},
    );
    await controlador.restaurar();
    expect(controlador.estaAutenticada, isTrue);
    await expectLater(
      controlador.obtenerTokenAcceso(),
      throwsA(isA<ExcepcionApi>()),
    );
    expect(controlador.estaAutenticada, isTrue);
    controlador.dispose();
  });

  test(
    'vincula por primera vez aunque deba renovar el token de acceso',
    () async {
      final cliente = ClientePortadorFalso(
        identidad: crearIdentidadPortador(),
        codigoQr: crearCodigoQr(DateTime.now().toUtc()),
      );
      final actual = cliente.sesion;
      final accesoVencido = SesionUsuario(
        tokenAcceso: actual.tokenAcceso,
        tokenRenovacion: actual.tokenRenovacion,
        tokenAccesoExpiraEn: DateTime.now().subtract(
          const Duration(minutes: 1),
        ),
        tokenRenovacionExpiraEn: DateTime.now().add(const Duration(days: 1)),
        usuario: actual.usuario,
      );
      final almacen = AlmacenOfflineFalso();
      final sesion = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: AlmacenSesionFalso(),
        almacenQrOffline: almacen,
        rolesPermitidos: const {'ESTUDIANTE'},
      );
      await sesion.adoptarSesionVerificada(accesoVencido);
      final controlador = ControladorIdentidadQr(
        clienteApi: cliente,
        controladorSesion: sesion,
        proveedorUbicacion: ProveedorUbicacionFalso(
          ubicacion: crearUbicacion(),
        ),
        clienteOffline: PreparacionOfflineFalsa(),
        almacenQrOffline: almacen,
      );
      expect(await controlador.iniciarRotacionAutomatica(), isTrue);
      expect(almacen.vinculacion, isNotNull);
      controlador.dispose();
      sesion.dispose();
    },
  );
}
