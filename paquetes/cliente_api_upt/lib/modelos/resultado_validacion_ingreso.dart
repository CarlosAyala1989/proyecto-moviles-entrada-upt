class IdentidadIngreso {
  const IdentidadIngreso({
    required this.fotoUrl,
    required this.nombreCompleto,
    required this.codigoInstitucional,
    required this.tiposUsuario,
    required this.escuela,
    required this.estadoAcademico,
  });

  factory IdentidadIngreso.desdeJson(Map<String, dynamic> json) {
    return IdentidadIngreso(
      fotoUrl: json['foto_url'] as String?,
      nombreCompleto: json['nombre_completo'] as String,
      codigoInstitucional: json['codigo_institucional'] as String,
      tiposUsuario: List<String>.from(json['tipo_usuario'] as List<dynamic>),
      escuela: json['escuela'] as String?,
      estadoAcademico: json['estado_academico'] as String?,
    );
  }

  final String? fotoUrl;
  final String nombreCompleto;
  final String codigoInstitucional;
  final List<String> tiposUsuario;
  final String? escuela;
  final String? estadoAcademico;
}

class ResultadoValidacionIngreso {
  const ResultadoValidacionIngreso({
    required this.resultado,
    required this.motivo,
    required this.mensaje,
    required this.registradoEn,
    required this.puntoAccesoCodigo,
    required this.puntoAccesoNombre,
    required this.identidad,
  });

  factory ResultadoValidacionIngreso.desdeJson(Map<String, dynamic> json) {
    final punto = Map<String, dynamic>.from(json['punto_acceso'] as Map);
    final identidad = json['identidad'];
    return ResultadoValidacionIngreso(
      resultado: json['resultado'] as String,
      motivo: json['motivo'] as String,
      mensaje: json['mensaje'] as String,
      registradoEn: DateTime.parse(json['registrado_en'] as String),
      puntoAccesoCodigo: punto['codigo'] as String,
      puntoAccesoNombre: punto['nombre'] as String,
      identidad: identidad == null
          ? null
          : IdentidadIngreso.desdeJson(
              Map<String, dynamic>.from(identidad as Map),
            ),
    );
  }

  final String resultado;
  final String motivo;
  final String mensaje;
  final DateTime registradoEn;
  final String puntoAccesoCodigo;
  final String puntoAccesoNombre;
  final IdentidadIngreso? identidad;

  bool get autorizado => resultado == 'AUTORIZADO';
}
