import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../modelos/vinculacion_qr_offline.dart';

class AlmacenQrOffline {
  AlmacenQrOffline({FlutterSecureStorage? almacenamiento})
    : _almacenamiento = almacenamiento ?? const FlutterSecureStorage();

  static const _claveDispositivo = 'upt_identificador_dispositivo_qr';
  static const _claveVinculacion = 'upt_vinculacion_qr_offline';
  final FlutterSecureStorage _almacenamiento;

  Future<String> identificadorDispositivo() async {
    final actual = await _almacenamiento.read(key: _claveDispositivo);
    if (actual != null) return actual;
    final aleatorio = Random.secure();
    final bytes = List<int>.generate(32, (_) => aleatorio.nextInt(256));
    final nuevo = base64Url.encode(bytes).replaceAll('=', '');
    await _almacenamiento.write(key: _claveDispositivo, value: nuevo);
    return nuevo;
  }

  Future<VinculacionQrOffline?> recuperar(int usuarioId) async {
    final contenido = await _almacenamiento.read(key: _claveVinculacion);
    if (contenido == null) return null;
    try {
      final vinculacion = VinculacionQrOffline.desdeJson(
        Map<String, dynamic>.from(jsonDecode(contenido) as Map),
      );
      return vinculacion.usuarioId == usuarioId ? vinculacion : null;
    } catch (_) {
      await limpiar();
      return null;
    }
  }

  Future<void> guardar(VinculacionQrOffline vinculacion) => _almacenamiento
      .write(key: _claveVinculacion, value: jsonEncode(vinculacion.aJson()));

  Future<void> limpiar() async {
    await _almacenamiento.delete(key: _claveVinculacion);
    await _almacenamiento.delete(key: _claveDispositivo);
  }
}
