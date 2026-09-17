import 'sesion_usuario.dart';

class EstadoGoogleOauth {
  const EstadoGoogleOauth({
    required this.estado,
    this.sesion,
    this.codigoError,
    this.mensajeError,
  });

  factory EstadoGoogleOauth.desdeJson(Map<String, dynamic> json) {
    final sesionJson = json['sesion'];
    final errorJson = json['error'];
    final error = errorJson is Map
        ? Map<String, dynamic>.from(errorJson)
        : const <String, dynamic>{};
    return EstadoGoogleOauth(
      estado: json['estado'] as String,
      sesion: sesionJson is Map
          ? SesionUsuario.desdeJson(Map<String, dynamic>.from(sesionJson))
          : null,
      codigoError: error['codigo'] as String?,
      mensajeError: error['mensaje'] as String?,
    );
  }

  final String estado;
  final SesionUsuario? sesion;
  final String? codigoError;
  final String? mensajeError;

  bool get estaPendiente => estado == 'PENDIENTE' || estado == 'PROCESANDO';
  bool get estaCompleta => estado == 'COMPLETA' && sesion != null;
  bool get tieneError => estado == 'ERROR';
}
