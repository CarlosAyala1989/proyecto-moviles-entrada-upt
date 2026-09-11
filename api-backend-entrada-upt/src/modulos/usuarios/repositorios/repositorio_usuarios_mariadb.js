import { grupoConexiones } from '../../../config/database.js';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';

const columnasPublicas = `
  id,
  codigo_institucional,
  correo_institucional,
  nombres,
  apellidos,
  nombre_institucional,
  nombre_intranet,
  foto_url,
  estado,
  estado_autorizacion,
  identidad_verificada,
  identidad_verificada_en,
  ultimo_acceso_en,
  creado_en,
  actualizado_en
`;

function normalizarUsuario(fila, roles = []) {
  return {
    ...fila,
    identidad_verificada: Boolean(fila.identidad_verificada),
    roles,
  };
}

function traducirErrorBaseDatos(error) {
  if (error instanceof ErrorHttp) return error;

  if (error.errno === 1062) {
    return new ErrorHttp({
      codigo: 'IDENTIFICADOR_INSTITUCIONAL_DUPLICADO',
      mensaje: 'El código o correo institucional ya se encuentra registrado.',
      estadoHttp: 409,
    });
  }

  if (error.errno === 4025 || error.errno === 1452) {
    return new ErrorHttp({
      codigo: 'RELACION_O_ESTADO_INVALIDO',
      mensaje: 'El estado o la relación solicitada no es válida.',
      estadoHttp: 400,
    });
  }

  return error;
}

async function obtenerRolesPorUsuarios(conexion, idsUsuarios) {
  const rolesPorUsuario = new Map(idsUsuarios.map((id) => [id, []]));
  if (idsUsuarios.length === 0) return rolesPorUsuario;

  const marcadores = idsUsuarios.map(() => '?').join(', ');
  const filas = await conexion.query(
    `SELECT usuarios_roles.usuario_id, roles.nombre
     FROM usuarios_roles
     JOIN roles ON roles.id = usuarios_roles.rol_id
     WHERE usuarios_roles.usuario_id IN (${marcadores})
     ORDER BY roles.nombre`,
    idsUsuarios,
  );

  for (const fila of filas) {
    rolesPorUsuario.get(fila.usuario_id)?.push(fila.nombre);
  }
  return rolesPorUsuario;
}

async function obtenerUsuarioConConexion(conexion, id) {
  const [fila] = await conexion.query(
    `SELECT ${columnasPublicas} FROM usuarios WHERE id = ?`,
    [id],
  );
  if (!fila) return null;

  const roles = await obtenerRolesPorUsuarios(conexion, [id]);
  return normalizarUsuario(fila, roles.get(id));
}

async function obtenerIdsRoles(conexion, nombres) {
  const marcadores = nombres.map(() => '?').join(', ');
  const filas = await conexion.query(
    `SELECT id, nombre FROM roles WHERE activo = TRUE AND nombre IN (${marcadores})`,
    nombres,
  );

  if (filas.length !== nombres.length) {
    throw new ErrorHttp({
      codigo: 'ROL_INVALIDO',
      mensaje: 'Uno o más roles no existen o están inactivos.',
      estadoHttp: 400,
    });
  }
  return filas;
}

async function registrarAuditoria(
  conexion,
  accion,
  usuarioId,
  usuarioActorId,
  detalle = {},
) {
  await conexion.query(
    `INSERT INTO registros_auditoria
      (usuario_actor_id, accion, entidad, entidad_id, detalle)
     VALUES (?, ?, 'USUARIO', ?, ?)`,
    [usuarioActorId, accion, String(usuarioId), JSON.stringify(detalle)],
  );
}

export class RepositorioUsuariosMariaDb {
  async crear(datos, usuarioActorId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await conexion.query(
        `INSERT INTO usuarios (
          codigo_institucional,
          correo_institucional,
          contrasena_hash,
          nombres,
          apellidos,
          nombre_institucional,
          nombre_intranet,
          foto_url,
          estado,
          estado_autorizacion,
          identidad_verificada,
          identidad_verificada_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          datos.codigo_institucional,
          datos.correo_institucional,
          datos.contrasena_hash ?? null,
          datos.nombres,
          datos.apellidos,
          datos.nombre_institucional ?? null,
          datos.nombre_intranet ?? null,
          datos.foto_url ?? null,
          datos.estado,
          datos.estado_autorizacion,
          datos.identidad_verificada,
          datos.identidad_verificada ? new Date() : null,
        ],
      );

      const roles = await obtenerIdsRoles(conexion, datos.roles);
      for (const rol of roles) {
        await conexion.query(
          `INSERT INTO usuarios_roles (usuario_id, rol_id, asignado_por)
           VALUES (?, ?, ?)`,
          [resultado.insertId, rol.id, usuarioActorId],
        );
      }

      await registrarAuditoria(
        conexion,
        'USUARIO_CREADO',
        resultado.insertId,
        usuarioActorId,
        { roles: datos.roles, credencial_local: Boolean(datos.contrasena_hash) },
      );
      await conexion.commit();
      return await obtenerUsuarioConConexion(conexion, resultado.insertId);
    } catch (error) {
      await conexion.rollback();
      throw traducirErrorBaseDatos(error);
    } finally {
      conexion.release();
    }
  }

  async consultar({ pagina, limite, buscar, estado }) {
    const conexion = await grupoConexiones.getConnection();
    try {
      const condiciones = [];
      const parametros = [];

      if (buscar) {
        condiciones.push(`(
          codigo_institucional LIKE ?
          OR correo_institucional LIKE ?
          OR nombres LIKE ?
          OR apellidos LIKE ?
        )`);
        const patron = `%${buscar}%`;
        parametros.push(patron, patron, patron, patron);
      }
      if (estado) {
        condiciones.push('estado = ?');
        parametros.push(estado);
      }

      const clausulaWhere = condiciones.length > 0
        ? `WHERE ${condiciones.join(' AND ')}`
        : '';
      const desplazamiento = (pagina - 1) * limite;
      const [conteo] = await conexion.query(
        `SELECT COUNT(*) AS total FROM usuarios ${clausulaWhere}`,
        parametros,
      );
      const filas = await conexion.query(
        `SELECT ${columnasPublicas}
         FROM usuarios
         ${clausulaWhere}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
        [...parametros, limite, desplazamiento],
      );
      const roles = await obtenerRolesPorUsuarios(
        conexion,
        filas.map(({ id }) => id),
      );

      return {
        usuarios: filas.map((fila) => normalizarUsuario(fila, roles.get(fila.id))),
        paginacion: {
          pagina,
          limite,
          total: conteo.total,
          total_paginas: Math.ceil(conteo.total / limite),
        },
      };
    } finally {
      conexion.release();
    }
  }

  async obtenerPorId(id) {
    const conexion = await grupoConexiones.getConnection();
    try {
      return await obtenerUsuarioConConexion(conexion, id);
    } finally {
      conexion.release();
    }
  }

  async actualizar(id, datos, usuarioActorId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const asignaciones = [];
      const valores = [];
      const camposPermitidos = [
        'codigo_institucional',
        'correo_institucional',
        'nombres',
        'apellidos',
        'nombre_institucional',
        'nombre_intranet',
        'foto_url',
      ];

      for (const campo of camposPermitidos) {
        if (Object.hasOwn(datos, campo)) {
          asignaciones.push(`${campo} = ?`);
          valores.push(datos[campo]);
        }
      }

      const resultado = await conexion.query(
        `UPDATE usuarios SET ${asignaciones.join(', ')} WHERE id = ?`,
        [...valores, id],
      );
      if (resultado.affectedRows === 0) {
        throw new ErrorHttp({
          codigo: 'USUARIO_NO_ENCONTRADO',
          mensaje: 'El usuario solicitado no existe.',
          estadoHttp: 404,
        });
      }

      await registrarAuditoria(
        conexion,
        'USUARIO_ACTUALIZADO',
        id,
        usuarioActorId,
        { campos: Object.keys(datos) },
      );
      await conexion.commit();
      return await obtenerUsuarioConConexion(conexion, id);
    } catch (error) {
      await conexion.rollback();
      throw traducirErrorBaseDatos(error);
    } finally {
      conexion.release();
    }
  }

  async actualizarEstado(id, datos, usuarioActorId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const asignaciones = [];
      const valores = [];

      for (const campo of ['estado', 'estado_autorizacion']) {
        if (Object.hasOwn(datos, campo)) {
          asignaciones.push(`${campo} = ?`);
          valores.push(datos[campo]);
        }
      }
      if (Object.hasOwn(datos, 'identidad_verificada')) {
        asignaciones.push('identidad_verificada = ?');
        valores.push(datos.identidad_verificada);
        asignaciones.push('identidad_verificada_en = ?');
        valores.push(datos.identidad_verificada ? new Date() : null);
      }

      const resultado = await conexion.query(
        `UPDATE usuarios SET ${asignaciones.join(', ')} WHERE id = ?`,
        [...valores, id],
      );
      if (resultado.affectedRows === 0) {
        throw new ErrorHttp({
          codigo: 'USUARIO_NO_ENCONTRADO',
          mensaje: 'El usuario solicitado no existe.',
          estadoHttp: 404,
        });
      }

      const debeRevocarSesiones = (
        Object.hasOwn(datos, 'estado') && datos.estado !== 'ACTIVO'
      ) || (
        Object.hasOwn(datos, 'estado_autorizacion')
        && datos.estado_autorizacion !== 'AUTORIZADO'
      );
      if (debeRevocarSesiones) {
        await conexion.query(
          `UPDATE sesiones
           SET estado = 'REVOCADA',
               revocada_en = CURRENT_TIMESTAMP(3),
               motivo_revocacion = 'USUARIO_DESHABILITADO'
           WHERE usuario_id = ? AND estado = 'ACTIVA'`,
          [id],
        );
      }

      await registrarAuditoria(
        conexion,
        'ESTADO_USUARIO_ACTUALIZADO',
        id,
        usuarioActorId,
        datos,
      );
      await conexion.commit();
      return await obtenerUsuarioConConexion(conexion, id);
    } catch (error) {
      await conexion.rollback();
      throw traducirErrorBaseDatos(error);
    } finally {
      conexion.release();
    }
  }

  async asignarRoles(id, nombresRoles, usuarioActorId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const usuario = await obtenerUsuarioConConexion(conexion, id);
      if (!usuario) {
        throw new ErrorHttp({
          codigo: 'USUARIO_NO_ENCONTRADO',
          mensaje: 'El usuario solicitado no existe.',
          estadoHttp: 404,
        });
      }

      const roles = await obtenerIdsRoles(conexion, nombresRoles);
      await conexion.query('DELETE FROM usuarios_roles WHERE usuario_id = ?', [id]);
      for (const rol of roles) {
        await conexion.query(
          `INSERT INTO usuarios_roles (usuario_id, rol_id, asignado_por)
           VALUES (?, ?, ?)`,
          [id, rol.id, usuarioActorId],
        );
      }

      await registrarAuditoria(
        conexion,
        'ROLES_USUARIO_ACTUALIZADOS',
        id,
        usuarioActorId,
        { roles: nombresRoles },
      );
      await conexion.commit();
      return await obtenerUsuarioConConexion(conexion, id);
    } catch (error) {
      await conexion.rollback();
      throw traducirErrorBaseDatos(error);
    } finally {
      conexion.release();
    }
  }

  async consultarRoles() {
    return grupoConexiones.query(
      'SELECT id, nombre, descripcion FROM roles WHERE activo = TRUE ORDER BY nombre',
    );
  }

  async cambiarContrasena(id, contrasenaHash, usuarioActorId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await conexion.query(
        `UPDATE usuarios
         SET contrasena_hash = ?,
             intentos_fallidos_inicio_sesion = 0,
             bloqueado_hasta = NULL
         WHERE id = ?`,
        [contrasenaHash, id],
      );
      if (resultado.affectedRows === 0) {
        throw new ErrorHttp({
          codigo: 'USUARIO_NO_ENCONTRADO',
          mensaje: 'El usuario solicitado no existe.',
          estadoHttp: 404,
        });
      }
      await conexion.query(
        `UPDATE sesiones
         SET estado = 'REVOCADA',
             revocada_en = CURRENT_TIMESTAMP(3),
             motivo_revocacion = 'CREDENCIAL_LOCAL_CAMBIADA'
         WHERE usuario_id = ? AND estado = 'ACTIVA'`,
        [id],
      );
      await registrarAuditoria(
        conexion,
        'CREDENCIAL_LOCAL_CAMBIADA',
        id,
        usuarioActorId,
      );
      await conexion.commit();
    } catch (error) {
      await conexion.rollback();
      throw traducirErrorBaseDatos(error);
    } finally {
      conexion.release();
    }
  }
}
