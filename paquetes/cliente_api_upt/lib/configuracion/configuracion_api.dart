abstract final class ConfiguracionApi {
  static const urlBase = String.fromEnvironment(
    'URL_API_UPT',
    defaultValue: 'http://10.0.2.2:3000/api',
  );

  static const duracionMaximaSolicitud = Duration(seconds: 15);
}
