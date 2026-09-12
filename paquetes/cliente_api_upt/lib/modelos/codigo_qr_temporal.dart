class CodigoQrTemporal {
  const CodigoQrTemporal({
    required this.codigoQr,
    required this.estado,
    required this.emitidaEn,
    required this.expiraEn,
    required this.duracionSegundos,
    required this.unSoloUso,
    required this.puntoAccesoCodigo,
    required this.puntoAccesoNombre,
  });

  factory CodigoQrTemporal.desdeJson(Map<String, dynamic> json) {
    final ubicacion = Map<String, dynamic>.from(json['ubicacion'] as Map);
    final punto = Map<String, dynamic>.from(ubicacion['punto_acceso'] as Map);
    return CodigoQrTemporal(
      codigoQr: json['codigo_qr'] as String,
      estado: json['estado'] as String,
      emitidaEn: DateTime.parse(json['emitida_en'] as String),
      expiraEn: DateTime.parse(json['expira_en'] as String),
      duracionSegundos: json['duracion_segundos'] as int,
      unSoloUso: json['un_solo_uso'] as bool,
      puntoAccesoCodigo: punto['codigo'] as String,
      puntoAccesoNombre: punto['nombre'] as String,
    );
  }

  final String codigoQr;
  final String estado;
  final DateTime emitidaEn;
  final DateTime expiraEn;
  final int duracionSegundos;
  final bool unSoloUso;
  final String puntoAccesoCodigo;
  final String puntoAccesoNombre;
}
