class PerfilAcademico {
  const PerfilAcademico({
    required this.escuela,
    required this.facultad,
    required this.estadoAcademico,
    required this.periodoAcademico,
  });

  factory PerfilAcademico.desdeJson(Map<String, dynamic> json) {
    return PerfilAcademico(
      escuela: json['escuela'] as String?,
      facultad: json['facultad'] as String?,
      estadoAcademico: json['estado_academico'] as String,
      periodoAcademico: json['periodo_academico'] as String?,
    );
  }

  final String? escuela;
  final String? facultad;
  final String estadoAcademico;
  final String? periodoAcademico;
}

class IdentidadDigital {
  const IdentidadDigital({
    required this.id,
    required this.codigoInstitucional,
    required this.correoInstitucional,
    required this.nombreCompleto,
    required this.fotoUrl,
    required this.roles,
    required this.estadoVerificacion,
    required this.estadoUsuario,
    required this.estadoAutorizacion,
    required this.puedeSolicitarCodigoQr,
    required this.perfilAcademico,
  });

  factory IdentidadDigital.desdeJson(Map<String, dynamic> json) {
    final perfil = json['perfil_academico'];
    final verificacion = Map<String, dynamic>.from(json['verificacion'] as Map);
    final acceso = Map<String, dynamic>.from(json['acceso'] as Map);
    final preparacion = Map<String, dynamic>.from(
      json['preparacion_codigo_qr'] as Map,
    );
    return IdentidadDigital(
      id: json['id'] as int,
      codigoInstitucional: json['codigo_institucional'] as String,
      correoInstitucional: json['correo_institucional'] as String,
      nombreCompleto: json['nombre_completo'] as String,
      fotoUrl: json['foto_url'] as String?,
      roles: List<String>.from(json['roles'] as List<dynamic>),
      estadoVerificacion: verificacion['estado'] as String,
      estadoUsuario: acceso['estado_usuario'] as String,
      estadoAutorizacion: acceso['estado_autorizacion'] as String,
      puedeSolicitarCodigoQr: preparacion['puede_solicitar'] as bool,
      perfilAcademico: perfil == null
          ? null
          : PerfilAcademico.desdeJson(Map<String, dynamic>.from(perfil as Map)),
    );
  }

  final int id;
  final String codigoInstitucional;
  final String correoInstitucional;
  final String nombreCompleto;
  final String? fotoUrl;
  final List<String> roles;
  final String estadoVerificacion;
  final String estadoUsuario;
  final String estadoAutorizacion;
  final bool puedeSolicitarCodigoQr;
  final PerfilAcademico? perfilAcademico;
}
