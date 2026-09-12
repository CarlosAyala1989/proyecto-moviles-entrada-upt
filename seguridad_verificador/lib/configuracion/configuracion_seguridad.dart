abstract final class ConfiguracionSeguridad {
  static const puntoAccesoCodigo = String.fromEnvironment(
    'PUNTO_ACCESO_CODIGO',
    defaultValue: 'PRUEBA-LOCAL',
  );
}
