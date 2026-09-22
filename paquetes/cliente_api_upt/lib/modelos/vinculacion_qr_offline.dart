import 'dart:convert';
import 'package:crypto/crypto.dart';

class VinculacionQrOffline {
  const VinculacionQrOffline({
    required this.usuarioId,
    required this.dispositivoId,
    required this.secreto,
    required this.desfaseRelojMs,
    required this.periodoSegundos,
  });

  factory VinculacionQrOffline.desdeJson(Map<String, dynamic> json) =>
      VinculacionQrOffline(
        usuarioId: json['usuario_id'] as int,
        dispositivoId: json['dispositivo_id'] as int,
        secreto: json['secreto'] as String,
        desfaseRelojMs: json['desfase_reloj_ms'] as int,
        periodoSegundos: json['periodo_segundos'] as int,
      );

  final int usuarioId;
  final int dispositivoId;
  final String secreto;
  final int desfaseRelojMs;
  final int periodoSegundos;

  Map<String, dynamic> aJson() => {
    'usuario_id': usuarioId,
    'dispositivo_id': dispositivoId,
    'secreto': secreto,
    'desfase_reloj_ms': desfaseRelojMs,
    'periodo_segundos': periodoSegundos,
  };

  ({String codigo, String otp, DateTime expiraEn}) generar(DateTime ahora) {
    final tiempoAjustado = ahora.millisecondsSinceEpoch + desfaseRelojMs;
    final duracion = periodoSegundos * 1000;
    final paso = tiempoAjustado ~/ duracion;
    final mensaje = 'upt_offline_v2.$dispositivoId.$paso';
    final clave = base64Url.decode(base64Url.normalize(secreto));
    final resumen = Hmac(sha256, clave).convert(utf8.encode(mensaje)).bytes;
    final desplazamiento = resumen.last & 0x0f;
    final valor =
        ((resumen[desplazamiento] & 0x7f) << 24) |
        ((resumen[desplazamiento + 1] & 0xff) << 16) |
        ((resumen[desplazamiento + 2] & 0xff) << 8) |
        (resumen[desplazamiento + 3] & 0xff);
    final otp = (valor % 1000000).toString().padLeft(6, '0');
    final firma = base64Url.encode(resumen).replaceAll('=', '');
    return (
      codigo: '$mensaje.$otp.$firma',
      otp: otp,
      expiraEn: DateTime.fromMillisecondsSinceEpoch(
        (paso + 1) * duracion - desfaseRelojMs,
      ),
    );
  }
}
