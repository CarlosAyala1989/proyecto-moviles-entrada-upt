class CaptchaIntranet {
  const CaptchaIntranet({
    required this.transaccionId,
    required this.imagenBase64,
    required this.tipoImagen,
    required this.expiraEn,
  });

  final String transaccionId;
  final String imagenBase64;
  final String tipoImagen;
  final DateTime expiraEn;

  factory CaptchaIntranet.desdeJson(Map<String, dynamic> json) {
    return CaptchaIntranet(
      transaccionId: json['transaccion_id'] as String,
      imagenBase64: json['imagen_base64'] as String,
      tipoImagen: json['tipo_imagen'] as String,
      expiraEn: DateTime.parse(json['expira_en'] as String),
    );
  }
}
