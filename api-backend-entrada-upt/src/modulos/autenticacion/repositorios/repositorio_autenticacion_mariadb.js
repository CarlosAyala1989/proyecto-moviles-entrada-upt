import { grupoConexiones } from '../../../config/database.js';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';

async function consultarRoles(conexion, usuarioId) {
  const filas = await conexion.query(
    `SELECT roles.nombre
     FROM usuarios_roles
     JOIN roles ON roles.id = usuarios_roles.rol_id
     WHERE usuarios_roles.usuario_id = ? AND roles.activo = TRUE
     ORDER BY roles.nombre`,
    [usuarioId],
  );
  return filas.map(({ nombre }) => nombre);
}

function usuarioPublico(usuario, roles) {
  return {
    id: usuario.usuario_id ?? usuario.id,
    codigo_institucional: usuario.codigo_institucional,
    correo_institucional: usuario.correo_institucional,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    roles,
  };
}

async function registrarIntento(conexion, {
  usuarioId,
  identificadorHash,
  exitoso,
  motivo,
  direccionIp,
  agenteUsuario,
}) {
  await conexion.query(
    `INSERT INTO intentos_inicio_sesion (
      usuario_id,
      identificador_hash,
      exitoso,
      motivo,
      direccion_ip,
      agente_usuario
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      usuarioId ?? null,
      identificadorHash,
      exitoso,
      motivo,
      direccionIp ?? null,
      agenteUsuario ?? null,
    ],
  );
}

function errorTokenAcceso() {
  return new ErrorHttp({
    codigo: 'TOKEN_ACCESO_INVALIDO',
    mensaje: 'El token de acceso no es válido o ha vencido.',
    estadoHttp: 401,
  });
}

function errorTokenRenovacion() {
  return new ErrorHttp({
    codigo: 'TOKEN_RENOVACION_INVALIDO',
    mensaje: 'El token de renovación no es válido o ha vencido.',
    estadoHttp: 401,
  });
}

function errorUsuarioNoHabilitado() {
  return new ErrorHttp({
    codigo: 'USUARIO_NO_HABILITADO',
    mensaje: 'El usuario no está habilitado para utilizar el sistema.',
    estadoHttp: 403,
  });
}

export class RepositorioAutenticacionMariaDb {
  async buscarUsuarioPorIdentificador(identificador) {
    const [usuario] = await grupoConexiones.query(
      `SELECT
        id,
        codigo_institucional,
        correo_institucional,
        contrasena_hash,
        nombres,
        apellidos,
        estado,
        estado_autorizacion,
        intentos_fallidos_inicio_sesion,
        bloqueado_hasta,
        bloqueado_hasta > CURRENT_TIMESTAMP(3) AS bloqueo_vigente
       FROM usuarios
       WHERE codigo_institucional = UPPER(?) OR correo_institucional = LOWER(?)
       LIMIT 1`,
      [identificador, identificador],
    );
    return usuario ?? null;
  }

  async registrarFalloInicioSesion({
    usuario,
    identificadorHash,
    direccionIp,
    agenteUsuario,
    maxIntentos,
    duracionBloqueoMinutos,
  }) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();

      if (!usuario) {
        await registrarIntento(conexion, {
          identificadorHash,
          exitoso: false,
          motivo: 'CREDENCIALES_INVALIDAS',
          direccionIp,
          agenteUsuario,
        });
        await conexion.commit();
        return;
      }

      const [filaBloqueada] = await conexion.query(
        `SELECT
           intentos_fallidos_inicio_sesion,
           bloqueado_hasta IS NOT NULL
             AND bloqueado_hasta <= CURRENT_TIMESTAMP(3) AS bloqueo_vencido
         FROM usuarios WHERE id = ? FOR UPDATE`,
        [usuario.id],
      );
      const intentosPrevios = filaBloqueada.bloqueo_vencido
        ? 0
        : filaBloqueada.intentos_fallidos_inicio_sesion;
      const intentos = intentosPrevios + 1;
      const aplicarBloqueo = intentos >= maxIntentos;

      await conexion.query(
        `UPDATE usuarios
         SET intentos_fallidos_inicio_sesion = ?,
             bloqueado_hasta = IF(
               ?,
               TIMESTAMPADD(MINUTE, ?, CURRENT_TIMESTAMP(3)),
               NULL
             )
         WHERE id = ?`,
        [intentos, aplicarBloqueo, duracionBloqueoMinutos, usuario.id],
      );
      await registrarIntento(conexion, {
        usuarioId: usuario.id,
        identificadorHash,
        exitoso: false,
        motivo: aplicarBloqueo
          ? 'BLOQUEO_TEMPORAL_APLICADO'
          : 'CREDENCIALES_INVALIDAS',
        direccionIp,
        agenteUsuario,
      });
      await conexion.commit();
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  async registrarIntentoRechazado({
    usuario,
    identificadorHash,
    motivo,
    direccionIp,
    agenteUsuario,
  }) {
    await registrarIntento(grupoConexiones, {
      usuarioId: usuario?.id,
      identificadorHash,
      exitoso: false,
      motivo,
      direccionIp,
      agenteUsuario,
    });
  }

  async crearSesion({
    usuario,
    identificadorHash,
    tokenAccesoHash,
    tokenRenovacionHash,
    duracionTokenAccesoMinutos,
    duracionTokenRenovacionDias,
    direccionIp,
    agenteUsuario,
    motivoInicio = 'INICIO_SESION_CORRECTO',
  }) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      // Bloquear primero al usuario evita interbloqueos si inicia sesión en paralelo.
      await conexion.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [
        usuario.id,
      ]);
      const resultado = await conexion.query(
        `INSERT INTO sesiones (
          usuario_id,
          token_acceso_hash,
          token_renovacion_hash,
          direccion_ip,
          agente_usuario,
          expira_en,
          token_renovacion_expira_en
        ) VALUES (
          ?, ?, ?, ?, ?,
          TIMESTAMPADD(MINUTE, ?, CURRENT_TIMESTAMP(3)),
          TIMESTAMPADD(DAY, ?, CURRENT_TIMESTAMP(3))
        )`,
        [
          usuario.id,
          tokenAccesoHash,
          tokenRenovacionHash,
          direccionIp ?? null,
          agenteUsuario ?? null,
          duracionTokenAccesoMinutos,
          duracionTokenRenovacionDias,
        ],
      );
      await conexion.query(
        `UPDATE usuarios
         SET intentos_fallidos_inicio_sesion = 0,
             bloqueado_hasta = NULL,
             ultimo_acceso_en = CURRENT_TIMESTAMP(3)
         WHERE id = ?`,
        [usuario.id],
      );
      await registrarIntento(conexion, {
        usuarioId: usuario.id,
        identificadorHash,
        exitoso: true,
        motivo: motivoInicio,
        direccionIp,
        agenteUsuario,
      });
      await conexion.query(
        `INSERT INTO registros_auditoria
          (usuario_actor_id, accion, entidad, entidad_id, direccion_ip)
         VALUES (?, 'SESION_INICIADA', 'SESION', ?, ?)`,
        [usuario.id, String(resultado.insertId), direccionIp ?? null],
      );
      const roles = await consultarRoles(conexion, usuario.id);
      const [sesion] = await conexion.query(
        `SELECT expira_en, token_renovacion_expira_en
         FROM sesiones WHERE id = ?`,
        [resultado.insertId],
      );
      await conexion.commit();
      return {
        sesionId: resultado.insertId,
        usuario: usuarioPublico(usuario, roles),
        accesoExpiraEn: sesion.expira_en,
        renovacionExpiraEn: sesion.token_renovacion_expira_en,
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  async obtenerSesionPorTokenAcceso(tokenAccesoHash) {
    const [fila] = await grupoConexiones.query(
      `SELECT
        sesiones.id AS sesion_id,
        sesiones.estado AS sesion_estado,
        sesiones.expira_en,
        sesiones.expira_en > CURRENT_TIMESTAMP(3) AS acceso_vigente,
        usuarios.id AS usuario_id,
        usuarios.codigo_institucional,
        usuarios.correo_institucional,
        usuarios.nombres,
        usuarios.apellidos,
        usuarios.estado AS usuario_estado,
        usuarios.estado_autorizacion
       FROM sesiones
       JOIN usuarios ON usuarios.id = sesiones.usuario_id
       WHERE sesiones.token_acceso_hash = ?
       LIMIT 1`,
      [tokenAccesoHash],
    );

    if (!fila || fila.sesion_estado !== 'ACTIVA' || !fila.acceso_vigente) {
      throw errorTokenAcceso();
    }
    if (fila.usuario_estado !== 'ACTIVO' || fila.estado_autorizacion !== 'AUTORIZADO') {
      throw errorUsuarioNoHabilitado();
    }

    const roles = await consultarRoles(grupoConexiones, fila.usuario_id);
    return {
      sesionId: fila.sesion_id,
      usuario: usuarioPublico(fila, roles),
    };
  }

  async renovarSesion({
    tokenRenovacionHashActual,
    tokenAccesoHashNuevo,
    tokenRenovacionHashNuevo,
    duracionTokenAccesoMinutos,
    duracionTokenRenovacionDias,
  }) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const [fila] = await conexion.query(
        `SELECT
          sesiones.id AS sesion_id,
          sesiones.estado AS sesion_estado,
          sesiones.token_renovacion_expira_en,
          sesiones.token_renovacion_expira_en > CURRENT_TIMESTAMP(3)
            AS renovacion_vigente,
          usuarios.id AS usuario_id,
          usuarios.codigo_institucional,
          usuarios.correo_institucional,
          usuarios.nombres,
          usuarios.apellidos,
          usuarios.estado AS usuario_estado,
          usuarios.estado_autorizacion
         FROM sesiones
         JOIN usuarios ON usuarios.id = sesiones.usuario_id
         WHERE sesiones.token_renovacion_hash = ?
         LIMIT 1
         FOR UPDATE`,
        [tokenRenovacionHashActual],
      );

      if (!fila || fila.sesion_estado !== 'ACTIVA') {
        await conexion.rollback();
        throw errorTokenRenovacion();
      }
      if (!fila.renovacion_vigente) {
        await conexion.query(
          "UPDATE sesiones SET estado = 'EXPIRADA' WHERE id = ?",
          [fila.sesion_id],
        );
        await conexion.commit();
        throw errorTokenRenovacion();
      }
      if (fila.usuario_estado !== 'ACTIVO' || fila.estado_autorizacion !== 'AUTORIZADO') {
        await conexion.query(
          `UPDATE sesiones
           SET estado = 'REVOCADA', revocada_en = CURRENT_TIMESTAMP(3),
               motivo_revocacion = 'USUARIO_NO_HABILITADO'
           WHERE id = ?`,
          [fila.sesion_id],
        );
        await conexion.commit();
        throw errorUsuarioNoHabilitado();
      }

      await conexion.query(
        `UPDATE sesiones
         SET token_acceso_hash = ?,
             token_renovacion_hash = ?,
             expira_en = TIMESTAMPADD(MINUTE, ?, CURRENT_TIMESTAMP(3)),
             token_renovacion_expira_en = TIMESTAMPADD(DAY, ?, CURRENT_TIMESTAMP(3))
         WHERE id = ?`,
        [
          tokenAccesoHashNuevo,
          tokenRenovacionHashNuevo,
          duracionTokenAccesoMinutos,
          duracionTokenRenovacionDias,
          fila.sesion_id,
        ],
      );
      await conexion.query(
        `INSERT INTO registros_auditoria
          (usuario_actor_id, accion, entidad, entidad_id)
         VALUES (?, 'SESION_RENOVADA', 'SESION', ?)`,
        [fila.usuario_id, String(fila.sesion_id)],
      );
      const roles = await consultarRoles(conexion, fila.usuario_id);
      const [sesion] = await conexion.query(
        `SELECT expira_en, token_renovacion_expira_en
         FROM sesiones WHERE id = ?`,
        [fila.sesion_id],
      );
      await conexion.commit();
      return {
        sesionId: fila.sesion_id,
        usuario: usuarioPublico(fila, roles),
        accesoExpiraEn: sesion.expira_en,
        renovacionExpiraEn: sesion.token_renovacion_expira_en,
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  async revocarSesion(sesionId, usuarioId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await conexion.query(
        `UPDATE sesiones
         SET estado = 'REVOCADA',
             revocada_en = CURRENT_TIMESTAMP(3),
             motivo_revocacion = 'CIERRE_SESION_USUARIO'
         WHERE id = ? AND usuario_id = ? AND estado = 'ACTIVA'`,
        [sesionId, usuarioId],
      );
      if (resultado.affectedRows === 0) {
        await conexion.commit();
        return;
      }
      await conexion.query(
        `UPDATE credenciales_acceso
         SET estado = 'REVOCADA',
             revocada_en = CURRENT_TIMESTAMP(3),
             motivo_revocacion = 'SESION_CERRADA'
         WHERE sesion_id = ? AND estado = 'PENDIENTE'`,
        [sesionId],
      );
      await conexion.query(
        `INSERT INTO registros_auditoria
          (usuario_actor_id, accion, entidad, entidad_id)
         VALUES (?, 'SESION_CERRADA', 'SESION', ?)`,
        [usuarioId, String(sesionId)],
      );
      await conexion.commit();
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }
}
