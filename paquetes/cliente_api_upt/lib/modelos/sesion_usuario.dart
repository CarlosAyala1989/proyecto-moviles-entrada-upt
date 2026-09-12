import 'usuario_sesion.dart';

class SesionUsuario {
  const SesionUsuario({
    required this.tokenAcceso,
    required this.tokenRenovacion,
    required this.tokenAccesoExpiraEn,
    required this.tokenRenovacionExpiraEn,
    required this.usuario,
  });

  factory SesionUsuario.desdeJson(Map<String, dynamic> json) {
    return SesionUsuario(
      tokenAcceso: json['token_acceso'] as String,
      tokenRenovacion: json['token_renovacion'] as String,
      tokenAccesoExpiraEn: DateTime.parse(json['token_acceso_expira_en'] as String),
      tokenRenovacionExpiraEn: DateTime.parse(
        json['token_renovacion_expira_en'] as String,
      ),
      usuario: UsuarioSesion.desdeJson(
        Map<String, dynamic>.from(json['usuario'] as Map),
      ),
    );
  }

  final String tokenAcceso;
  final String tokenRenovacion;
  final DateTime tokenAccesoExpiraEn;
  final DateTime tokenRenovacionExpiraEn;
  final UsuarioSesion usuario;

  bool accesoRequiereRenovacion(DateTime ahora) => !ahora.isBefore(
    tokenAccesoExpiraEn.subtract(const Duration(seconds: 30)),
  );

  bool renovacionVencida(DateTime ahora) => !ahora.isBefore(
    tokenRenovacionExpiraEn,
  );

  SesionUsuario conUsuario(UsuarioSesion usuarioActualizado) => SesionUsuario(
    tokenAcceso: tokenAcceso,
    tokenRenovacion: tokenRenovacion,
    tokenAccesoExpiraEn: tokenAccesoExpiraEn,
    tokenRenovacionExpiraEn: tokenRenovacionExpiraEn,
    usuario: usuarioActualizado,
  );

  Map<String, dynamic> aJson() => {
    'token_acceso': tokenAcceso,
    'token_renovacion': tokenRenovacion,
    'token_acceso_expira_en': tokenAccesoExpiraEn.toIso8601String(),
    'token_renovacion_expira_en': tokenRenovacionExpiraEn.toIso8601String(),
    'usuario': usuario.aJson(),
  };
}
