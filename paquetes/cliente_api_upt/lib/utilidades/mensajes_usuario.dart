import '../servicios/excepcion_api.dart';

/// Convierte los códigos internos en indicaciones claras para las personas.
///
/// Los códigos se conservan en [ExcepcionApi.codigo] para pruebas y soporte,
/// pero nunca hace falta mostrarlos en pantalla.
String mensajeErrorParaUsuario(String codigo) {
  const mensajes = <String, String>{
    'ERROR_CONEXION':
        'No pudimos comunicarnos con el servicio. Revisa tu conexión e inténtalo nuevamente.',
    'TIEMPO_ESPERA_AGOTADO':
        'Esto está tardando más de lo esperado. Espera un momento e inténtalo nuevamente.',
    'RESPUESTA_INVALIDA':
        'Recibimos una respuesta inesperada. Inténtalo nuevamente en unos minutos.',
    'ERROR_INTERNO':
        'Algo salió mal mientras realizábamos la comprobación. Inténtalo nuevamente.',
    'ERROR_API': 'No pudimos completar esta acción. Inténtalo nuevamente.',
    'RUTA_NO_ENCONTRADA':
        'Esta función no está disponible en este momento. Actualiza la aplicación o pide ayuda.',
    'DATOS_INVALIDOS':
        'Revisa la información ingresada e inténtalo nuevamente.',
    'JSON_INVALIDO':
        'No pudimos procesar la información enviada. Inténtalo nuevamente.',
    'TIPO_CONTENIDO_NO_ADMITIDO':
        'No pudimos procesar la información enviada. Inténtalo nuevamente.',
    'AUTENTICACION_REQUERIDA':
        'Tu sesión terminó. Vuelve a ingresar para continuar.',
    'TOKEN_ACCESO_INVALIDO':
        'Tu sesión terminó. Vuelve a ingresar para continuar.',
    'TOKEN_RENOVACION_INVALIDO':
        'Tu sesión terminó. Vuelve a ingresar para continuar.',
    'SESION_VENCIDA': 'Tu sesión terminó. Vuelve a ingresar para continuar.',
    'SESION_CAMBIADA':
        'La cuenta abierta cambió. Vuelve a intentarlo desde la pantalla principal.',
    'CREDENCIALES_INVALIDAS':
        'El código, correo o contraseña no son correctos.',
    'INICIO_SESION_BLOQUEADO':
        'Hubo varios intentos incorrectos. Espera unos minutos antes de volver a intentarlo.',
    'ROL_NO_AUTORIZADO': 'Esta cuenta no tiene permiso para usar esta opción.',
    'ROL_APLICACION_NO_AUTORIZADO':
        'Esta cuenta no está habilitada para usar esta aplicación.',
    'PERSONAL_SEGURIDAD_NO_HABILITADO':
        'Tu cuenta no está habilitada para comprobar ingresos.',
    'USUARIO_NO_HABILITADO':
        'Esta cuenta no está habilitada en este momento. Pide ayuda a la universidad.',
    'IDENTIDAD_DIGITAL_NO_ENCONTRADA':
        'No encontramos tus datos institucionales. Pide ayuda a la universidad.',
    'IDENTIDAD_NO_VERIFICADA':
        'Primero debemos confirmar tu identidad institucional.',
    'ROL_NO_HABILITADO_PARA_CODIGO_QR':
        'Tu cuenta no está habilitada para generar un código de ingreso.',
    'SESION_NO_VALIDA_PARA_CODIGO_QR':
        'Vuelve a ingresar en la aplicación antes de generar otro código.',
    'CONFIGURACION_CODIGO_QR_INVALIDA':
        'La generación del código no está disponible en este momento. Inténtalo más tarde.',
    'UBICACION_DESACTUALIZADA':
        'Necesitamos una ubicación más reciente. Activa la ubicación e inténtalo nuevamente.',
    'MOMENTO_UBICACION_INVALIDO':
        'La fecha y hora del dispositivo no son correctas. Ajústalas e inténtalo nuevamente.',
    'PRECISION_UBICACION_INSUFICIENTE':
        'No logramos ubicarte con suficiente precisión. Acércate a la puerta e inténtalo nuevamente.',
    'UBICACION_FUERA_DE_ZONA':
        'Debes estar cerca de una puerta habilitada para mostrar tu código de ingreso.',
    'PUNTO_ACCESO_NO_DISPONIBLE':
        'No encontramos una puerta habilitada cerca de ti. Pide ayuda al personal de seguridad.',
    'PUNTO_ACCESO_NO_ENCONTRADO':
        'Este equipo no tiene una puerta válida asignada. Pide ayuda al responsable del sistema.',
    'CAPTCHA_EXPIRADO':
        'La imagen ya venció. Carga una nueva e ingresa el número que aparece.',
    'VERIFICACION_INTRANET_EXPIRADA':
        'La comprobación de la intranet venció. Vuelve a comenzar.',
    'CREDENCIALES_INTRANET_INVALIDAS':
        'El código, la contraseña o el número de la imagen no son correctos.',
    'CODIGO_INTRANET_INVALIDO': 'Ingresa un código institucional válido.',
    'CONTRASENA_INTRANET_INVALIDA':
        'Ingresa tu contraseña numérica de la intranet.',
    'INTRANET_NO_DISPONIBLE':
        'La intranet UPT no responde en este momento. Inténtalo más tarde.',
    'INTRANET_SATURADA':
        'Hay muchas comprobaciones en curso. Espera un momento e inténtalo nuevamente.',
    'INTRANET_RESPUESTA_INVALIDA':
        'La intranet no pudo confirmar tus datos. Inténtalo nuevamente.',
    'NAVEGACION_INTRANET_INVALIDA':
        'La intranet no completó el ingreso. Vuelve a intentarlo.',
    'PERFIL_INTRANET_NO_ENCONTRADO':
        'Ingresaste correctamente, pero no encontramos tus datos de estudiante. Pide ayuda a la universidad.',
    'CODIGO_INTRANET_NO_COINCIDE':
        'El código obtenido no coincide con el que ingresaste. Pide ayuda a la universidad.',
    'GOOGLE_OAUTH_NO_CONFIGURADO':
        'El acceso con Google institucional aún no está disponible. Pide ayuda al responsable del sistema.',
    'GOOGLE_OAUTH_CANCELADO':
        'Cancelaste el acceso con Google. Puedes intentarlo nuevamente.',
    'GOOGLE_OAUTH_EXPIRADO':
        'Se acabó el tiempo para ingresar con Google. Vuelve a comenzar.',
    'GOOGLE_OAUTH_NO_COMPLETADO':
        'No se completó el acceso con Google. Inténtalo nuevamente.',
    'GOOGLE_OAUTH_RESPUESTA_INVALIDA':
        'Google no pudo confirmar tu cuenta. Inténtalo nuevamente.',
    'GOOGLE_OAUTH_SATURADO':
        'Hay muchas comprobaciones en curso. Espera un momento e inténtalo nuevamente.',
    'GOOGLE_CORREO_NO_AUTORIZADO':
        'Debes usar la cuenta de Google que te entregó la UPT.',
    'GOOGLE_DOMINIO_NO_AUTORIZADO':
        'Debes usar una cuenta que termine en @virtual.upt.pe.',
    'GOOGLE_CORREO_NO_VERIFICADO':
        'Google todavía no ha confirmado ese correo. Revisa tu cuenta e inténtalo nuevamente.',
    'GOOGLE_PERFIL_INCOMPLETO':
        'Tu cuenta de Google no tiene todos los datos necesarios. Pide ayuda a la universidad.',
    'GOOGLE_ID_TOKEN_AUSENTE':
        'Google no pudo confirmar tu cuenta. Inténtalo nuevamente.',
    'GOOGLE_ID_TOKEN_INVALIDO':
        'Google no pudo confirmar tu cuenta. Inténtalo nuevamente.',
    'CORREO_INSTITUCIONAL_INVALIDO':
        'Debes usar la cuenta de Google que te entregó la UPT.',
    'CODIGOS_NO_COINCIDEN':
        'La intranet y Google pertenecen a códigos diferentes. Usa las dos cuentas de la misma persona.',
    'NOMBRES_NO_COINCIDEN':
        'La intranet y Google muestran nombres diferentes. Usa las dos cuentas de la misma persona.',
    'IDENTIDAD_INSTITUCIONAL_EN_CONFLICTO':
        'Estos datos ya están asociados a otra cuenta. Pide ayuda a la universidad.',
  };
  return mensajes[codigo] ??
      'No pudimos completar esta acción. Inténtalo nuevamente o pide ayuda si el problema continúa.';
}

String mensajeDecisionIngresoParaUsuario(String motivo) {
  const mensajes = <String, String>{
    'ACCESO_AUTORIZADO':
        'La identidad y la ubicación fueron confirmadas. Puedes permitir el ingreso.',
    'TOKEN_INVALIDO':
        'No reconocemos este código. Pide a la persona que muestre uno nuevo.',
    'INTEGRIDAD_CREDENCIAL_INVALIDA':
        'El código está incompleto o fue modificado. No permitas el ingreso.',
    'CREDENCIAL_EXPIRADA':
        'Este código ya venció. Pide a la persona que muestre el nuevo código de su pantalla.',
    'CREDENCIAL_REVOCADA':
        'La persona anuló este código. Pídele que genere uno nuevo.',
    'CREDENCIAL_YA_UTILIZADA':
        'Este código ya fue usado. No lo aceptes nuevamente.',
    'USUARIO_NO_HABILITADO':
        'Esta persona no tiene permiso de ingreso en este momento.',
    'IDENTIDAD_NO_VERIFICADA':
        'No pudimos confirmar la identidad de esta persona. No permitas el ingreso.',
    'ROL_PORTADOR_NO_HABILITADO':
        'Esta cuenta no está habilitada para ingresar con la aplicación.',
    'SESION_USUARIO_INVALIDA':
        'La persona debe volver a ingresar en su aplicación y mostrar un código nuevo.',
    'PUNTO_ACCESO_INACTIVO':
        'Esta puerta no está habilitada para comprobar ingresos.',
    'PUNTO_ACCESO_NO_COINCIDE':
        'Este código fue generado para otra puerta. No permitas el ingreso aquí.',
    'UBICACION_ESCANEO_FUERA_DE_ZONA':
        'Este equipo no se encuentra dentro de la zona asignada a la puerta.',
  };
  return mensajes[motivo] ??
      'No pudimos confirmar el ingreso. No permitas el acceso y vuelve a intentarlo.';
}

extension MensajeUsuarioExcepcionApi on ExcepcionApi {
  String get mensajeParaUsuario => mensajeErrorParaUsuario(codigo);
}
