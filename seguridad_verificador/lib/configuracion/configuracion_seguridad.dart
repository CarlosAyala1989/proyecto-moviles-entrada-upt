abstract final class ConfiguracionSeguridad {
  static const puntoAccesoCodigo = String.fromEnvironment(
    'PUNTO_ACCESO_CODIGO',
    defaultValue: 'PRUEBA-LOCAL',
  );

  static String? validarPuntoAcceso({
    String valor = puntoAccesoCodigo,
    required bool exigirPuntoInstitucional,
  }) {
    final normalizado = valor.trim().toUpperCase();
    if (!RegExp(r'^[A-Z0-9][A-Z0-9_-]{0,49}$').hasMatch(normalizado)) {
      return 'PUNTO_ACCESO_CODIGO no contiene un código válido.';
    }
    if (exigirPuntoInstitucional && normalizado == 'PRUEBA-LOCAL') {
      return 'Las compilaciones de producción requieren un punto de acceso institucional.';
    }
    return null;
  }
}
