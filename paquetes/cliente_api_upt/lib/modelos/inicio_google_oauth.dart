class InicioGoogleOauth {
  const InicioGoogleOauth({
    required this.transaccionId,
    required this.urlAutorizacion,
    required this.expiraEn,
  });

  factory InicioGoogleOauth.desdeJson(Map<String, dynamic> json) {
    return InicioGoogleOauth(
      transaccionId: json['transaccion_id'] as String,
      urlAutorizacion: Uri.parse(json['url_autorizacion'] as String),
      expiraEn: DateTime.parse(json['expira_en'] as String),
    );
  }

  final String transaccionId;
  final Uri urlAutorizacion;
  final DateTime expiraEn;
}
