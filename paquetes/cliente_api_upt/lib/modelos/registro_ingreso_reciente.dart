class RegistroIngresoReciente {
  const RegistroIngresoReciente({
    required this.id,
    required this.resultado,
    required this.motivo,
    required this.registradoEn,
    required this.puntoAccesoCodigo,
    required this.puntoAccesoNombre,
    required this.codigoInstitucional,
    required this.nombreCompleto,
  });

  factory RegistroIngresoReciente.desdeJson(Map<String, dynamic> json) {
    final punto = Map<String, dynamic>.from(json['punto_acceso'] as Map);
    final usuario = json['usuario'];
    final usuarioJson = usuario == null
        ? null
        : Map<String, dynamic>.from(usuario as Map);
    return RegistroIngresoReciente(
      id: json['id'] as int,
      resultado: json['resultado'] as String,
      motivo: json['motivo'] as String,
      registradoEn: DateTime.parse(json['registrado_en'] as String),
      puntoAccesoCodigo: punto['codigo'] as String,
      puntoAccesoNombre: punto['nombre'] as String,
      codigoInstitucional: usuarioJson?['codigo_institucional'] as String?,
      nombreCompleto: usuarioJson?['nombre_completo'] as String?,
    );
  }

  final int id;
  final String resultado;
  final String motivo;
  final DateTime registradoEn;
  final String puntoAccesoCodigo;
  final String puntoAccesoNombre;
  final String? codigoInstitucional;
  final String? nombreCompleto;
}
