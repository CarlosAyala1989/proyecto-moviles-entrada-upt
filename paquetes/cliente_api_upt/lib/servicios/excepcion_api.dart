class ExcepcionApi implements Exception {
  const ExcepcionApi({
    required this.codigo,
    required this.mensaje,
    this.estadoHttp,
  });

  final String codigo;
  final String mensaje;
  final int? estadoHttp;

  @override
  String toString() => mensaje;
}
