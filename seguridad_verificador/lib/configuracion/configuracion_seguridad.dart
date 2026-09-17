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
      return 'Este equipo no tiene una puerta asignada correctamente.';
    }
    if (exigirPuntoInstitucional && normalizado == 'PRUEBA-LOCAL') {
      return 'Antes de usar esta versión, asigna este equipo a una puerta de la universidad.';
    }
    return null;
  }
}
