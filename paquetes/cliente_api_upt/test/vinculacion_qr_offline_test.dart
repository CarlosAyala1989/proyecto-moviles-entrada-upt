import 'dart:convert';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('firma el mismo paso de tiempo que la API y cambia cada 15 segundos', () {
    final vinculacion = VinculacionQrOffline(
      usuarioId: 7,
      dispositivoId: 123,
      secreto: base64Url.encode(List<int>.filled(32, 1)).replaceAll('=', ''),
      desfaseRelojMs: 0,
      periodoSegundos: 15,
    );
    final instante = DateTime.fromMillisecondsSinceEpoch(119341442 * 15000);
    final generado = vinculacion.generar(instante);
    expect(generado.otp, '510600');
    expect(
      generado.codigo,
      'upt_offline_v2.123.119341442.510600.Iw4NAut3QRiHJ0gAD-EeLHe2m6EYzEql0vZ32X2uLZc',
    );
    expect(generado.expiraEn.difference(instante).inSeconds, 15);
    expect(
      vinculacion.generar(instante.add(const Duration(seconds: 15))).codigo,
      isNot(generado.codigo),
    );
  });
}
