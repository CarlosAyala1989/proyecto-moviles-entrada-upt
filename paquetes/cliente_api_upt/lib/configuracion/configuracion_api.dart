abstract final class ConfiguracionApi {
  static const urlBase = String.fromEnvironment(
    'URL_API_UPT',
    defaultValue: 'http://10.0.2.2:3000/api',
  );

  static const duracionMaximaSolicitud = Duration(seconds: 15);

  static String? validarUrlBase({
    String valor = urlBase,
    required bool exigirHttps,
  }) {
    if (valor.trim() != valor || valor.isEmpty) {
      return 'URL_API_UPT no contiene una dirección válida.';
    }
    final uri = Uri.tryParse(valor);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      return 'URL_API_UPT debe ser una dirección absoluta.';
    }
    final esquema = uri.scheme.toLowerCase();
    if (esquema != 'http' && esquema != 'https') {
      return 'URL_API_UPT sólo admite los protocolos HTTP y HTTPS.';
    }
    if (exigirHttps && esquema != 'https') {
      return 'Las compilaciones de producción requieren HTTPS en URL_API_UPT.';
    }
    if (uri.userInfo.isNotEmpty || uri.hasQuery || uri.hasFragment) {
      return 'URL_API_UPT no debe incluir credenciales, consulta ni fragmento.';
    }
    final ruta = uri.path.replaceFirst(RegExp(r'/+$'), '');
    if (ruta != '/api' && !ruta.endsWith('/api')) {
      return 'URL_API_UPT debe terminar en /api.';
    }
    return null;
  }
}
