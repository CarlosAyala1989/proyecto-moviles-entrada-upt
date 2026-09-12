import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../modelos/sesion_usuario.dart';
import 'almacen_sesion.dart';

class AlmacenSesionSegura implements AlmacenSesion {
  AlmacenSesionSegura({FlutterSecureStorage? almacenamiento})
      : _almacenamiento = almacenamiento ?? FlutterSecureStorage();

  static const _claveSesion = 'upt_sesion_autenticada';
  final FlutterSecureStorage _almacenamiento;

  @override
  Future<void> guardar(SesionUsuario sesion) {
    return _almacenamiento.write(
      key: _claveSesion,
      value: jsonEncode(sesion.aJson()),
    );
  }

  @override
  Future<SesionUsuario?> recuperar() async {
    final contenido = await _almacenamiento.read(key: _claveSesion);
    if (contenido == null) return null;
    try {
      return SesionUsuario.desdeJson(
        Map<String, dynamic>.from(jsonDecode(contenido) as Map),
      );
    } on FormatException {
      await limpiar();
      return null;
    } on TypeError {
      await limpiar();
      return null;
    }
  }

  @override
  Future<void> limpiar() => _almacenamiento.delete(key: _claveSesion);
}
