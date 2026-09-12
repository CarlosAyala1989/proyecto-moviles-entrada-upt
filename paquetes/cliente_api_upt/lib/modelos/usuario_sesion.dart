class UsuarioSesion {
  const UsuarioSesion({
    required this.id,
    required this.codigoInstitucional,
    required this.correoInstitucional,
    required this.nombres,
    required this.apellidos,
    required this.roles,
  });

  factory UsuarioSesion.desdeJson(Map<String, dynamic> json) {
    return UsuarioSesion(
      id: json['id'] as int,
      codigoInstitucional: json['codigo_institucional'] as String,
      correoInstitucional: json['correo_institucional'] as String,
      nombres: json['nombres'] as String,
      apellidos: json['apellidos'] as String,
      roles: List<String>.from(json['roles'] as List<dynamic>),
    );
  }

  final int id;
  final String codigoInstitucional;
  final String correoInstitucional;
  final String nombres;
  final String apellidos;
  final List<String> roles;

  String get nombreCompleto => '$nombres $apellidos'.trim();

  Map<String, dynamic> aJson() => {
    'id': id,
    'codigo_institucional': codigoInstitucional,
    'correo_institucional': correoInstitucional,
    'nombres': nombres,
    'apellidos': apellidos,
    'roles': roles,
  };
}
