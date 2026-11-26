import { grupoConexiones } from '../../config/database.js';
import { ErrorHttp } from '../../middleware/manejo_errores.js';
import { calcularHashIdentificador } from '../../seguridad/tokens.js';
import { conservarRestriccionAlEliminar } from '../../seguridad/restricciones_identidad_eliminada.js';

const error = (codigo, mensaje, estadoHttp = 409) => new ErrorHttp({ codigo, mensaje, estadoHttp });

export class RepositorioEliminacionCuenta {
  constructor(pool = grupoConexiones) { this.pool = pool; }

  async crear(datos) {
    await this.limpiarExpiradas();
    const [cantidad] = await this.pool.query('SELECT COUNT(*) AS total FROM solicitudes_eliminacion_cuenta');
    if (cantidad.total >= 500) throw error('ELIMINACION_SATURADA', 'Hay demasiadas verificaciones. Inténtalo más tarde.', 429);
    await this.pool.query(
      `INSERT INTO solicitudes_eliminacion_cuenta
       (id, estado_oauth_hash, nonce_hash, verificador_pkce, navegador_hash, expira_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [datos.id, datos.estadoHash, datos.nonceHash, datos.pkce, datos.navegadorHash, datos.expiraEn],
    );
  }

  async reclamarRetorno(estadoHash) {
    const conexion = await this.pool.getConnection();
    try {
      await conexion.beginTransaction();
      const [fila] = await conexion.query(
        `SELECT * FROM solicitudes_eliminacion_cuenta WHERE estado_oauth_hash = ?
         AND estado = 'PENDIENTE' AND expira_en > CURRENT_TIMESTAMP(3) FOR UPDATE`, [estadoHash],
      );
      if (fila) await conexion.query(
        `UPDATE solicitudes_eliminacion_cuenta SET estado = 'PROCESANDO',
         estado_oauth_hash = NULL, verificador_pkce = NULL, nonce_hash = NULL WHERE id = ?`, [fila.id],
      );
      await conexion.commit();
      return fila ?? null;
    } catch (fallo) {
      await conexion.rollback();
      throw fallo;
    } finally { conexion.release(); }
  }

  async preparar(id, googleSub) {
    // Solo una identidad YA vinculada: nunca crear ni iniciar sesión al eliminar.
    const [usuario] = await this.pool.query(
      'SELECT id FROM usuarios WHERE google_sub = ?', [googleSub],
    );
    if (!usuario) throw error('CUENTA_NO_ENCONTRADA', 'No hay una cuenta de estudiante vinculada a esta identidad.', 404);
    await this.exigirCuentaEstudiante(this.pool, usuario.id);
    const resultado = await this.pool.query(
      `UPDATE solicitudes_eliminacion_cuenta SET estado = 'LISTA', usuario_id = ?
       WHERE id = ? AND estado = 'PROCESANDO' AND expira_en > CURRENT_TIMESTAMP(3)`, [usuario.id, id],
    );
    if (!resultado.affectedRows) throw error('SOLICITUD_EXPIRADA', 'La verificación ha vencido. Inicia otra vez.', 410);
  }

  async marcarError(id, codigo) {
    await this.pool.query(
      `UPDATE solicitudes_eliminacion_cuenta SET estado = 'ERROR', error_codigo = ?,
       usuario_id = NULL, estado_oauth_hash = NULL, nonce_hash = NULL, verificador_pkce = NULL
       WHERE id = ? AND estado = 'PROCESANDO'`, [codigo, id],
    );
  }

  async exigirCuentaEstudiante(conexion, usuarioId) {
    const roles = await conexion.query(
      `SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = ?`, [usuarioId],
    );
    if (!roles.some((rol) => rol.nombre === 'ESTUDIANTE') || roles.some((rol) => rol.nombre !== 'ESTUDIANTE')) {
      throw error('CUENTA_INSTITUCIONAL_COMPARTIDA', 'Esta identidad tiene funciones institucionales adicionales y no corresponde a una cuenta exclusiva de estudiante.', 403);
    }
  }

  async consultar(id, navegadorHash) {
    const [fila] = await this.pool.query(
      `SELECT s.estado, s.error_codigo, s.completada_en, u.nombres, u.apellidos, u.correo_institucional
       FROM solicitudes_eliminacion_cuenta s LEFT JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.id = ? AND s.navegador_hash = ? AND s.expira_en > CURRENT_TIMESTAMP(3)`, [id, navegadorHash],
    );
    if (!fila) throw error('SOLICITUD_EXPIRADA', 'La verificación no es válida o venció. Inicia otra vez.', 410);
    return {
      estado: fila.estado,
      ...(fila.estado === 'LISTA' ? { cuenta: { nombre: [fila.nombres, fila.apellidos].filter(Boolean).join(' '), correo: fila.correo_institucional } } : {}),
      ...(fila.estado === 'ERROR' ? { codigo: fila.error_codigo } : {}),
      ...(fila.estado === 'COMPLETADA' ? { completada_en: fila.completada_en } : {}),
    };
  }

  async confirmar(id, navegadorHash) {
    const conexion = await this.pool.getConnection();
    try {
      await conexion.beginTransaction();
      const [solicitud] = await conexion.query(
        `SELECT * FROM solicitudes_eliminacion_cuenta WHERE id = ? AND navegador_hash = ?
         AND expira_en > CURRENT_TIMESTAMP(3) FOR UPDATE`, [id, navegadorHash],
      );
      if (!solicitud) throw error('SOLICITUD_EXPIRADA', 'La verificación no es válida o venció. Inicia otra vez.', 410);
      if (solicitud.estado === 'COMPLETADA') {
        await conexion.commit();
        return { estado: 'COMPLETADA', completada_en: solicitud.completada_en };
      }
      if (solicitud.estado !== 'LISTA' || !solicitud.usuario_id) throw error('VERIFICACION_REQUERIDA', 'Primero verifica tu cuenta institucional.', 403);
      const [usuario] = await conexion.query('SELECT * FROM usuarios WHERE id = ? FOR UPDATE', [solicitud.usuario_id]);
      if (!usuario) throw error('CUENTA_NO_ENCONTRADA', 'La cuenta ya no está disponible.', 404);
      await this.exigirCuentaEstudiante(conexion, usuario.id);
      await conservarRestriccionAlEliminar(conexion, usuario);
      await conexion.query(
        `UPDATE solicitudes_eliminacion_cuenta SET estado = 'ERROR', error_codigo = 'CUENTA_ELIMINADA',
         usuario_id = NULL WHERE usuario_id = ? AND id <> ?`, [usuario.id, id],
      );
      await this.borrarDatos(conexion, usuario);
      await conexion.query(
        `UPDATE solicitudes_eliminacion_cuenta SET estado = 'COMPLETADA', usuario_id = NULL,
         completada_en = CURRENT_TIMESTAMP(3) WHERE id = ?`, [id],
      );
      await conexion.commit();
      // Solo un comprobante breve, sin identidad ni registro de la cuenta borrada.
      return { estado: 'COMPLETADA' };
    } catch (fallo) {
      await conexion.rollback();
      throw fallo;
    } finally { conexion.release(); }
  }

  async borrarDatos(conexion, usuario) {
    const id = usuario.id;
    // Retirar también copias de datos asociadas a auditorías realizadas por otros operadores.
    await conexion.query(
      `DELETE a FROM registros_auditoria a
       LEFT JOIN credenciales_acceso c ON a.entidad = 'CREDENCIAL_ACCESO' AND a.entidad_id = CAST(c.id AS CHAR)
       LEFT JOIN dispositivos d ON a.entidad = 'DISPOSITIVO' AND a.entidad_id = CAST(d.id AS CHAR)
       LEFT JOIN registros_acceso r ON a.entidad IN ('REGISTRO_ACCESO', 'ACCESO') AND a.entidad_id = CAST(r.id AS CHAR)
       LEFT JOIN incidencias_seguridad i ON a.entidad = 'INCIDENCIA' AND a.entidad_id = CAST(i.id AS CHAR)
       LEFT JOIN registros_acceso ri ON ri.id = i.registro_acceso_id
       WHERE a.usuario_actor_id = ? OR (a.entidad = 'USUARIO' AND a.entidad_id = ?)
          OR c.usuario_id = ? OR d.usuario_id = ? OR r.usuario_id = ? OR ri.usuario_id = ?`,
      [id, String(id), id, id, id, id],
    );
    await conexion.query(
      `DELETE i FROM incidencias_seguridad i JOIN registros_acceso r ON r.id = i.registro_acceso_id
       LEFT JOIN credenciales_acceso c ON c.id = r.credencial_id WHERE r.usuario_id = ? OR c.usuario_id = ?`, [id, id],
    );
    await conexion.query('DELETE FROM notificaciones_usuario WHERE usuario_id = ?', [id]);
    await conexion.query(
      `DELETE r FROM registros_acceso r LEFT JOIN credenciales_acceso c ON c.id = r.credencial_id
       WHERE r.usuario_id = ? OR c.usuario_id = ?`, [id, id],
    );
    await conexion.query('DELETE FROM bloqueos_identidad WHERE usuario_id = ?', [id]);
    await conexion.query('DELETE FROM credenciales_acceso WHERE usuario_id = ?', [id]);
    await conexion.query('DELETE FROM sesiones WHERE usuario_id = ?', [id]);
    await conexion.query('DELETE u FROM usos_codigos_offline u JOIN dispositivos d ON d.id = u.dispositivo_id WHERE d.usuario_id = ?', [id]);
    await conexion.query('DELETE FROM dispositivos WHERE usuario_id = ?', [id]);
    const hashes = [usuario.codigo_institucional, usuario.correo_institucional, `google:${id}`].map(calcularHashIdentificador);
    await conexion.query('DELETE FROM intentos_inicio_sesion WHERE usuario_id = ? OR identificador_hash IN (?, ?, ?)', [id, ...hashes]);
    await conexion.query('DELETE FROM perfiles_academicos WHERE usuario_id = ?', [id]);
    await conexion.query('UPDATE usuarios_roles SET asignado_por = NULL WHERE asignado_por = ?', [id]);
    await conexion.query('UPDATE configuraciones_sistema SET actualizado_por = NULL WHERE actualizado_por = ?', [id]);
    await conexion.query('DELETE FROM usuarios_roles WHERE usuario_id = ?', [id]);
    await conexion.query('DELETE FROM usuarios WHERE id = ?', [id]);
  }

  async limpiarExpiradas() {
    await this.pool.query('DELETE FROM solicitudes_eliminacion_cuenta WHERE expira_en <= CURRENT_TIMESTAMP(3)');
  }

  async cancelar(id, navegadorHash) {
    await this.pool.query('DELETE FROM solicitudes_eliminacion_cuenta WHERE id = ? AND navegador_hash = ?', [id, navegadorHash]);
    return { estado: 'CANCELADA' };
  }
}
