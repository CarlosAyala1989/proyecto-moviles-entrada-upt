import { entorno } from '../../../config/env.js';

const causasGenerales = {
  CREDENCIAL_EXPIRADA: 'La credencial presentada ya venció.',
  CREDENCIAL_REVOCADA: 'La credencial presentada fue anulada.',
  CREDENCIAL_YA_UTILIZADA: 'La credencial presentada ya fue utilizada.',
  INTEGRIDAD_CREDENCIAL_INVALIDA: 'No se pudo verificar la integridad de la credencial.',
  USUARIO_NO_HABILITADO: 'La cuenta no está habilitada para ingresar.',
  IDENTIDAD_NO_VERIFICADA: 'La identidad requiere verificación.',
  ROL_PORTADOR_NO_HABILITADO: 'La cuenta no tiene permiso de ingreso con esta credencial.',
  SESION_USUARIO_INVALIDA: 'La sesión asociada a la credencial ya no es válida.',
  PUNTO_ACCESO_INACTIVO: 'El punto de acceso no está habilitado.',
  PUNTO_ACCESO_NO_COINCIDE: 'La credencial corresponde a otro punto de acceso.',
  UBICACION_ESCANEO_FUERA_DE_ZONA: 'La validación ocurrió fuera de la zona del punto de acceso.',
  DISPOSITIVO_NO_VINCULADO: 'El dispositivo de la credencial ya no está vinculado.',
  CODIGO_OFFLINE_NO_VIGENTE: 'El código del dispositivo no corresponde al momento de validación.',
};

const eventosSospechosos = new Set([
  'CREDENCIAL_YA_UTILIZADA',
  'INTEGRIDAD_CREDENCIAL_INVALIDA',
  'DISPOSITIVO_NO_VINCULADO',
]);

// Se ejecuta en la misma transacción que registra la decisión de acceso.
export async function registrarNotificacionesDenegacion(conexion, {
  usuarioId, registroAccesoId, motivo,
}) {
  if (!usuarioId) return;
  const causa = causasGenerales[motivo] ?? 'No se pudo autorizar el ingreso con la credencial presentada.';
  const notificaciones = [{
    tipo: 'DENEGACION_ACCESO',
    evento: 'ACCESO_DENEGADO',
    titulo: 'Ingreso denegado',
    mensaje: 'Se denegó un intento de ingreso con tu identidad. Consulta la causa y el canal de soporte.',
  }];
  if (eventosSospechosos.has(motivo)) {
    notificaciones.push({
      tipo: 'INTENTO_SOSPECHOSO',
      evento: motivo,
      titulo: 'Posible uso sospechoso de tu credencial',
      mensaje: 'Detectamos un intento de validación que requiere tu atención. Si no lo reconoces, contacta con el canal de soporte.',
    });
  }
  for (const notificacion of notificaciones) {
    await conexion.query(
      `INSERT INTO notificaciones_usuario
        (usuario_id, registro_acceso_id, tipo, evento, titulo, mensaje, causa_general, canal_soporte)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [usuarioId, registroAccesoId, notificacion.tipo, notificacion.evento,
        notificacion.titulo, notificacion.mensaje, causa, entorno.canalSoporteAcceso],
    );
  }
}
