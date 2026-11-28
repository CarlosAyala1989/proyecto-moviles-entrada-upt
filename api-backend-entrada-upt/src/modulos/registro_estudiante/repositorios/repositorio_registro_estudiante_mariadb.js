import { grupoConexiones } from '../../../config/database.js';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';
import { exigirRegistroSinRestriccion } from '../../../seguridad/restricciones_identidad_eliminada.js';

function errorConflicto() {
  return new ErrorHttp({
    codigo: 'IDENTIDAD_INSTITUCIONAL_EN_CONFLICTO',
    mensaje: 'Los identificadores institucionales ya pertenecen a otra cuenta.',
    estadoHttp: 409,
  });
}

export class RepositorioRegistroEstudianteMariaDb {
  async registrarIdentidadIntranet({ codigo, nombres, apellidos, nombreIntranet, escuelaProfesional }) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const [existente] = await conexion.query('SELECT * FROM usuarios WHERE codigo_institucional = ? FOR UPDATE', [codigo]);
      let usuarioId = existente?.id;
      if (existente) {
        const roles = await conexion.query('SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = ?', [usuarioId]);
        if (roles.some(({ nombre }) => nombre !== 'ESTUDIANTE')) throw errorConflicto();
        await conexion.query(
          `UPDATE usuarios SET nombres = ?, apellidos = ?, nombre_institucional = ?, nombre_intranet = ?,
           identidad_verificada = TRUE, identidad_verificada_en = CURRENT_TIMESTAMP(3),
           estado = IF(estado = 'PENDIENTE', 'ACTIVO', estado),
           estado_autorizacion = IF(estado_autorizacion = 'PENDIENTE', 'AUTORIZADO', estado_autorizacion)
           WHERE id = ?`, [nombres, apellidos, `${nombres} ${apellidos}`, nombreIntranet, usuarioId],
        );
      } else {
        await exigirRegistroSinRestriccion(conexion, codigo);
        const insertado = await conexion.query(
          `INSERT INTO usuarios (codigo_institucional, correo_institucional, nombres, apellidos, nombre_institucional,
           nombre_intranet, estado, estado_autorizacion, identidad_verificada, identidad_verificada_en)
           VALUES (?, NULL, ?, ?, ?, ?, 'ACTIVO', 'AUTORIZADO', TRUE, CURRENT_TIMESTAMP(3))`,
          [codigo, nombres, apellidos, `${nombres} ${apellidos}`, nombreIntranet],
        );
        usuarioId = insertado.insertId;
      }
      if (escuelaProfesional) await conexion.query(
        'INSERT INTO perfiles_academicos (usuario_id, escuela) VALUES (?, ?) ON DUPLICATE KEY UPDATE escuela = VALUES(escuela)', [usuarioId, escuelaProfesional],
      );
      await conexion.query("INSERT IGNORE INTO usuarios_roles (usuario_id, rol_id) SELECT ?, id FROM roles WHERE nombre = 'ESTUDIANTE' AND activo = TRUE", [usuarioId]);
      await conexion.query("INSERT INTO registros_auditoria (usuario_actor_id, accion, entidad, entidad_id) VALUES (?, 'IDENTIDAD_INTRANET_VERIFICADA', 'USUARIO', ?)", [usuarioId, String(usuarioId)]);
      const [usuario] = await conexion.query('SELECT id, codigo_institucional, correo_institucional, nombres, apellidos, estado, estado_autorizacion FROM usuarios WHERE id = ?', [usuarioId]);
      await conexion.commit();
      return usuario;
    } catch (error) {
      await conexion.rollback();
      if (error?.errno === 1062) throw errorConflicto();
      throw error;
    } finally { conexion.release(); }
  }

  async registrarIdentidadVerificada({
    codigo,
    correoInstitucional,
    nombres,
    apellidos,
    nombreGoogle,
    nombreIntranet,
    googleSub,
    fotoUrl,
    escuelaProfesional,
  }) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const coincidencias = await conexion.query(
        `SELECT
           id, codigo_institucional, correo_institucional, google_sub,
           estado, estado_autorizacion
         FROM usuarios
         WHERE codigo_institucional = ?
            OR correo_institucional = ?
            OR google_sub = ?
         FOR UPDATE`,
        [codigo, correoInstitucional, googleSub],
      );
      const ids = new Set(coincidencias.map(({ id }) => id));
      if (ids.size > 1) throw errorConflicto();

      let usuarioId;
      const existente = coincidencias[0];
      if (existente) {
        if (
          existente.codigo_institucional !== codigo
          || (existente.google_sub && existente.google_sub !== googleSub)
        ) {
          throw errorConflicto();
        }
        usuarioId = existente.id;
        await conexion.query(
          `UPDATE usuarios
           SET correo_institucional = ?,
               google_sub = ?,
               nombres = ?,
               apellidos = ?,
               nombre_institucional = ?,
               nombre_intranet = ?,
               foto_url = ?,
               identidad_verificada = TRUE,
               identidad_verificada_en = CURRENT_TIMESTAMP(3),
               estado = IF(estado = 'PENDIENTE', 'ACTIVO', estado),
               estado_autorizacion = IF(
                 estado_autorizacion = 'PENDIENTE',
                 'AUTORIZADO',
                 estado_autorizacion
               )
           WHERE id = ?`,
          [
            correoInstitucional,
            googleSub,
            nombres,
            apellidos,
            nombreGoogle,
            nombreIntranet,
            fotoUrl,
            usuarioId,
          ],
        );
      } else {
        await exigirRegistroSinRestriccion(conexion, codigo);
        const resultado = await conexion.query(
          `INSERT INTO usuarios (
             codigo_institucional,
             correo_institucional,
             google_sub,
             nombres,
             apellidos,
             nombre_institucional,
             nombre_intranet,
             foto_url,
             estado,
             estado_autorizacion,
             identidad_verificada,
             identidad_verificada_en
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', 'AUTORIZADO', TRUE,
             CURRENT_TIMESTAMP(3))`,
          [
            codigo,
            correoInstitucional,
            googleSub,
            nombres,
            apellidos,
            nombreGoogle,
            nombreIntranet,
            fotoUrl,
          ],
        );
        usuarioId = resultado.insertId;
      }

      if (escuelaProfesional) {
        await conexion.query(
          `INSERT INTO perfiles_academicos (usuario_id, escuela)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE escuela = VALUES(escuela)`,
          [usuarioId, escuelaProfesional],
        );
      }

      await conexion.query(
        `INSERT IGNORE INTO usuarios_roles (usuario_id, rol_id)
         SELECT ?, id FROM roles WHERE nombre = 'ESTUDIANTE' AND activo = TRUE`,
        [usuarioId],
      );
      await conexion.query(
        `INSERT INTO registros_auditoria
          (usuario_actor_id, accion, entidad, entidad_id, detalle)
         VALUES (?, 'IDENTIDAD_DUAL_VERIFICADA', 'USUARIO', ?, ?)`,
        [
          usuarioId,
          String(usuarioId),
          JSON.stringify({
            proveedor: 'GOOGLE_WORKSPACE',
            correo_institucional: correoInstitucional,
          }),
        ],
      );
      const [usuario] = await conexion.query(
        `SELECT
           id, codigo_institucional, correo_institucional, nombres, apellidos,
           estado, estado_autorizacion
         FROM usuarios WHERE id = ?`,
        [usuarioId],
      );
      await conexion.commit();
      return usuario;
    } catch (error) {
      await conexion.rollback();
      if (error?.errno === 1062) throw errorConflicto();
      throw error;
    } finally {
      conexion.release();
    }
  }
}
