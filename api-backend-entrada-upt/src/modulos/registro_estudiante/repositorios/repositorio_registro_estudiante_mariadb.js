import { grupoConexiones } from '../../../config/database.js';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';

function errorConflicto() {
  return new ErrorHttp({
    codigo: 'IDENTIDAD_INSTITUCIONAL_EN_CONFLICTO',
    mensaje: 'Los identificadores institucionales ya pertenecen a otra cuenta.',
    estadoHttp: 409,
  });
}

export class RepositorioRegistroEstudianteMariaDb {
  async registrarIdentidadVerificada({
    codigo,
    correoInstitucional,
    nombres,
    apellidos,
    nombreGoogle,
    nombreIntranet,
    googleSub,
    fotoUrl,
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
