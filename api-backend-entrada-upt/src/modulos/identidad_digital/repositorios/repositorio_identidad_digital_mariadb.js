import { grupoConexiones } from '../../../config/database.js';

async function consultarRoles(usuarioId) {
  const filas = await grupoConexiones.query(
    `SELECT roles.nombre
     FROM usuarios_roles
     JOIN roles ON roles.id = usuarios_roles.rol_id
     WHERE usuarios_roles.usuario_id = ? AND roles.activo = TRUE
     ORDER BY roles.nombre`,
    [usuarioId],
  );
  return filas.map(({ nombre }) => nombre);
}

export class RepositorioIdentidadDigitalMariaDb {
  async consultarPorUsuarioId(usuarioId) {
    const [fila] = await grupoConexiones.query(
      `SELECT
        usuarios.id,
        usuarios.codigo_institucional,
        usuarios.correo_institucional,
        usuarios.nombres,
        usuarios.apellidos,
        COALESCE(
          NULLIF(usuarios.nombre_institucional, ''),
          CONCAT_WS(' ', usuarios.nombres, usuarios.apellidos)
        ) AS nombre_completo,
        usuarios.foto_url,
        usuarios.estado,
        usuarios.estado_autorizacion,
        usuarios.identidad_verificada,
        usuarios.identidad_verificada_en,
        usuarios.actualizado_en,
        perfiles_academicos.id AS perfil_academico_id,
        perfiles_academicos.escuela,
        perfiles_academicos.facultad,
        perfiles_academicos.estado_academico,
        perfiles_academicos.periodo_academico
       FROM usuarios
       LEFT JOIN perfiles_academicos
         ON perfiles_academicos.usuario_id = usuarios.id
       WHERE usuarios.id = ?
       LIMIT 1`,
      [usuarioId],
    );

    if (!fila) return null;

    return {
      id: fila.id,
      codigo_institucional: fila.codigo_institucional,
      correo_institucional: fila.correo_institucional,
      nombres: fila.nombres,
      apellidos: fila.apellidos,
      nombre_completo: fila.nombre_completo,
      foto_url: fila.foto_url,
      estado: fila.estado,
      estado_autorizacion: fila.estado_autorizacion,
      identidad_verificada: Boolean(fila.identidad_verificada),
      identidad_verificada_en: fila.identidad_verificada_en,
      actualizado_en: fila.actualizado_en,
      roles: await consultarRoles(usuarioId),
      perfil_academico: fila.perfil_academico_id
        ? {
          escuela: fila.escuela,
          facultad: fila.facultad,
          estado_academico: fila.estado_academico,
          periodo_academico: fila.periodo_academico,
        }
        : null,
    };
  }
}
