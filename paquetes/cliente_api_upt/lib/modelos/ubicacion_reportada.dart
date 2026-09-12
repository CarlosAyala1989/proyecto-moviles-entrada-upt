class UbicacionReportada {
  const UbicacionReportada({
    required this.latitud,
    required this.longitud,
    required this.precisionMetros,
    required this.obtenidaEn,
  });

  final double latitud;
  final double longitud;
  final double precisionMetros;
  final DateTime obtenidaEn;

  Map<String, dynamic> aJson() => {
    'latitud': latitud,
    'longitud': longitud,
    'precision_metros': precisionMetros,
    'obtenida_en': obtenidaEn.toUtc().toIso8601String(),
  };
}
