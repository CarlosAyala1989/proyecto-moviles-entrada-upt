import { grupoConexiones } from '../../config/database.js';

export const RETENCION_DIAS = 30;

/// La tarea no borra identidades activas ni registros ajenos a estudiantes.
export async function depurarDatosEstudiantes(pool = grupoConexiones) {
  const conexion = await pool.getConnection();
  let bloqueo = false;
  try {
    const [base] = await conexion.query('SELECT DATABASE() AS nombre');
    const nombreBloqueo = `upt:privacidad:${base.nombre}`.slice(0, 64);
    const [resultado] = await conexion.query('SELECT GET_LOCK(?, 0) AS obtenido', [nombreBloqueo]);
    if (Number(resultado.obtenido) !== 1) return;
    bloqueo = nombreBloqueo;
    await conexion.beginTransaction();
    const estudiante = `SELECT ur.usuario_id FROM usuarios_roles ur JOIN roles rol ON rol.id = ur.rol_id WHERE rol.nombre = 'ESTUDIANTE'`;
    const estudianteTexto = `SELECT CAST(ur.usuario_id AS CHAR) FROM usuarios_roles ur JOIN roles rol ON rol.id = ur.rol_id WHERE rol.nombre = 'ESTUDIANTE'`;
    // Auditoría de accesos/incidencias se retira antes de borrar sus relaciones.
    await conexion.query(
      `DELETE a FROM registros_auditoria a
       LEFT JOIN incidencias_seguridad i ON a.entidad = 'INCIDENCIA' AND a.entidad_id = CAST(i.id AS CHAR)
       LEFT JOIN registros_acceso r ON r.id = i.registro_acceso_id
       WHERE a.registrado_en < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))
       AND (a.usuario_actor_id IN (${estudiante}) OR (a.entidad = 'USUARIO' AND a.entidad_id IN (${estudianteTexto}))
            OR r.usuario_id IN (${estudiante}))`,
    );
    await conexion.query(
      `DELETE i FROM incidencias_seguridad i JOIN registros_acceso r ON r.id = i.registro_acceso_id
       WHERE r.usuario_id IN (${estudiante}) AND r.registrado_en < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))`,
    );
    await conexion.query(`DELETE FROM registros_acceso WHERE usuario_id IN (${estudiante}) AND registrado_en < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))`);
    await conexion.query(`DELETE FROM notificaciones_usuario WHERE usuario_id IN (${estudiante}) AND creada_en < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))`);
    await conexion.query(
      `UPDATE registros_acceso r JOIN credenciales_acceso c ON c.id = r.credencial_id
       SET r.credencial_id = NULL WHERE c.usuario_id IN (${estudiante}) AND c.emitida_en < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))`,
    );
    await conexion.query(`DELETE FROM credenciales_acceso WHERE usuario_id IN (${estudiante}) AND emitida_en < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))`);
    await conexion.query(
      `DELETE o FROM usos_codigos_offline o JOIN dispositivos d ON d.id = o.dispositivo_id
       WHERE d.usuario_id IN (${estudiante}) AND o.usado_en < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))`,
    );
    await conexion.query(
      `DELETE FROM intentos_inicio_sesion WHERE registrado_en < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))
       AND (usuario_id IN (${estudiante}) OR usuario_id IS NULL)`,
    );
    await conexion.query(
      `UPDATE sesiones SET direccion_ip = NULL, agente_usuario = NULL WHERE usuario_id IN (${estudiante})
       AND creada_en < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))`,
    );
    await conexion.query(
      `DELETE FROM sesiones WHERE usuario_id IN (${estudiante})
       AND COALESCE(token_renovacion_expira_en, expira_en) < TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3))
       AND NOT EXISTS (SELECT 1 FROM credenciales_acceso c WHERE c.sesion_id = sesiones.id)`,
    );
    await conexion.query('DELETE FROM solicitudes_eliminacion_cuenta WHERE expira_en <= CURRENT_TIMESTAMP(3)');
    await conexion.query('DELETE FROM restricciones_identidad_eliminada WHERE expira_en <= CURRENT_TIMESTAMP(3)');
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    if (bloqueo) await conexion.query('SELECT RELEASE_LOCK(?)', [bloqueo]).catch(() => {});
    conexion.release();
  }
}

export function iniciarDepuracionPrivacidad() {
  const ejecutar = () => depurarDatosEstudiantes().catch(() => console.error('No se pudo completar la depuración de privacidad; se reintentará.'));
  void ejecutar();
  const temporizador = setInterval(ejecutar, 15 * 60 * 1000);
  temporizador.unref();
  return () => clearInterval(temporizador);
}
