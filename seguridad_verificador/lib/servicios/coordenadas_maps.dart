({double latitud, double longitud})? leerCoordenadasMaps(String entrada) {
  final texto = entrada.trim();
  final uri = Uri.tryParse(texto);
  String? par;
  if (uri != null && (uri.scheme == 'https' || uri.scheme == 'http')) {
    if (uri.host != 'google.com' && !uri.host.endsWith('.google.com')) {
      return null;
    }
    final pin = RegExp(
      r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)',
    ).firstMatch(texto);
    par = pin == null
        ? (uri.queryParameters['query'] ?? uri.queryParameters['q'])
        : '${pin[1]},${pin[2]}';
    // @latitud,longitud es el centro de la cámara, no necesariamente el pin.
  } else {
    par = texto;
  }
  if (par == null) return null;
  final numeros = RegExp(
    r'^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$',
  ).firstMatch(par);
  if (numeros == null) return null;
  final latitud = double.parse(numeros[1]!);
  final longitud = double.parse(numeros[2]!);
  if (latitud.abs() > 90 || longitud.abs() > 180) return null;
  return (latitud: latitud, longitud: longitud);
}
