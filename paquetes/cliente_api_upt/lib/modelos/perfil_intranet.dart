class PerfilIntranet {
  const PerfilIntranet({
    required this.codigo,
    required this.nombreApellidos,
    required this.verificacionId,
    required this.verificacionExpiraEn,
  });

  final String codigo;
  final String nombreApellidos;
  final String verificacionId;
  final DateTime verificacionExpiraEn;

  factory PerfilIntranet.desdeJson(Map<String, dynamic> json) {
    return PerfilIntranet(
      codigo: json['codigo'] as String,
      nombreApellidos: json['nombre_apellidos'] as String,
      verificacionId: json['verificacion_intranet_id'] as String,
      verificacionExpiraEn: DateTime.parse(
        json['verificacion_expira_en'] as String,
      ),
    );
  }
}
