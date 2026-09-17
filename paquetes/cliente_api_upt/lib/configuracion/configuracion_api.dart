abstract final class ConfiguracionApi {
  static const urlBase = String.fromEnvironment(
    'URL_API_UPT',
    // Flutter Linux y la API Node se ejecutan en el mismo equipo durante el
    // desarrollo local. Android debe sobrescribir este valor con 10.0.2.2.
    defaultValue: 'http://127.0.0.1:3000/api',
  );

  static const duracionMaximaSolicitud = Duration(seconds: 15);
  static const duracionMaximaCaptchaIntranet = Duration(seconds: 45);
  static const duracionMaximaVerificacionIntranet = Duration(seconds: 120);

  static String? validarUrlBase({
    String valor = urlBase,
    required bool exigirHttps,
  }) {
    if (valor.trim() != valor || valor.isEmpty) {
      return 'No encontramos la dirección necesaria para conectarnos.';
    }
    final uri = Uri.tryParse(valor);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      return 'La dirección de conexión está incompleta.';
    }
    final esquema = uri.scheme.toLowerCase();
    if (esquema != 'http' && esquema != 'https') {
      return 'La dirección de conexión usa un formato que no podemos abrir.';
    }
    if (exigirHttps && esquema != 'https') {
      return 'Esta versión necesita una conexión protegida para funcionar.';
    }
    if (uri.userInfo.isNotEmpty || uri.hasQuery || uri.hasFragment) {
      return 'La dirección de conexión contiene información que no está permitida.';
    }
    final ruta = uri.path.replaceFirst(RegExp(r'/+$'), '');
    if (ruta != '/api' && !ruta.endsWith('/api')) {
      return 'La dirección de conexión no corresponde al servicio de la aplicación.';
    }
    return null;
  }
}
