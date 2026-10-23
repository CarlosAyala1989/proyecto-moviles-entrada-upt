import { grupoConexiones } from '../../../config/database.js';

const seleccion = `SELECT n.id, n.usuario_id, n.registro_acceso_id, n.tipo, n.evento,
  n.titulo, n.mensaje, n.causa_general, n.canal_soporte, n.estado, n.creada_en, n.leida_en,
  r.registrado_en, p.id AS punto_id, p.codigo AS punto_codigo, p.nombre AS punto_nombre
  FROM notificaciones_usuario n
  JOIN registros_acceso r ON r.id = n.registro_acceso_id
  JOIN puntos_acceso p ON p.id = r.punto_acceso_id`;

function normalizar(fila) {
  return {
    id: fila.id,
    usuario_id: fila.usuario_id,
    registro_acceso_id: fila.registro_acceso_id,
    tipo: fila.tipo,
    evento: fila.evento,
    titulo: fila.titulo,
    mensaje: fila.mensaje,
    causa_general: fila.causa_general,
    canal_soporte: fila.canal_soporte,
    estado: fila.estado,
    creada_en: fila.creada_en.toISOString(),
    leida_en: fila.leida_en?.toISOString() ?? null,
    registrado_en: fila.registrado_en.toISOString(),
    punto_acceso: { id: fila.punto_id, codigo: fila.punto_codigo, nombre: fila.punto_nombre },
  };
}

export class RepositorioNotificacionesMariaDb {
  async consultar({ usuarioId, pagina, limite, tipo, estado, desde, hasta }) {
    const condiciones = ['n.usuario_id = ?'];
    const parametros = [usuarioId];
    for (const [columna, valor, operador] of [
      ['tipo', tipo, '='], ['estado', estado, '='],
      ['creada_en', desde, '>='], ['creada_en', hasta, '<='],
    ]) {
      if (valor !== undefined) {
        condiciones.push(`n.${columna} ${operador} ?`);
        parametros.push(valor);
      }
    }
    const clausula = `WHERE ${condiciones.join(' AND ')}`;
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const [conteo] = await conexion.query(
        `SELECT COUNT(*) AS total FROM notificaciones_usuario n ${clausula}`, parametros,
      );
      const filas = await conexion.query(
        `${seleccion} ${clausula} ORDER BY n.creada_en DESC, n.id DESC LIMIT ? OFFSET ?`,
        [...parametros, limite, (pagina - 1) * limite],
      );
      await conexion.commit();
      return {
        registros: filas.map(normalizar),
        paginacion: { pagina, limite, total: conteo.total, total_paginas: Math.ceil(conteo.total / limite) },
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  async consultarResumen(usuarioId) {
    const [resumen] = await grupoConexiones.query(
      `SELECT COUNT(*) AS total_no_leidas,
        COUNT(CASE WHEN tipo = 'DENEGACION_ACCESO' THEN 1 END) AS denegaciones_no_leidas,
        COUNT(CASE WHEN tipo = 'INTENTO_SOSPECHOSO' THEN 1 END) AS alertas_no_leidas
       FROM notificaciones_usuario WHERE usuario_id = ? AND estado = 'NO_LEIDA'`,
      [usuarioId],
    );
    return resumen;
  }

  async obtener(usuarioId, id) {
    const [fila] = await grupoConexiones.query(
      `${seleccion} WHERE n.usuario_id = ? AND n.id = ?`, [usuarioId, id],
    );
    return fila ? normalizar(fila) : null;
  }

  async marcarLeida(usuarioId, id) {
    await grupoConexiones.query(
      `UPDATE notificaciones_usuario SET estado = 'LEIDA',
        leida_en = COALESCE(leida_en, CURRENT_TIMESTAMP(3)) WHERE usuario_id = ? AND id = ?`,
      [usuarioId, id],
    );
    return this.obtener(usuarioId, id);
  }
}
