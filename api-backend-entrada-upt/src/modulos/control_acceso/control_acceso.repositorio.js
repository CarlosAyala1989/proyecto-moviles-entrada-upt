import { grupoConexiones } from '../../config/database.js';
import { ErrorHttp } from '../../middleware/manejo_errores.js';
import { tieneBloqueoIdentidad } from './politicas_acceso.js';

function error(codigo, mensaje, estadoHttp = 409) {
  return new ErrorHttp({ codigo, mensaje, estadoHttp });
}

async function auditar(conexion, actor, accion, entidad, entidadId, detalle = {}) {
  await conexion.query(
    `INSERT INTO registros_auditoria (usuario_actor_id, accion, entidad, entidad_id, detalle)
     VALUES (?, ?, ?, ?, ?)`, [actor, accion, entidad, String(entidadId), JSON.stringify(detalle)],
  );
}

async function transaccion(actor, operacion) {
  const conexion = await grupoConexiones.getConnection();
  try {
    await conexion.beginTransaction();
    const [usuario] = await conexion.query('SELECT estado, estado_autorizacion FROM usuarios WHERE id = ? FOR UPDATE', [actor]);
    if (!usuario || usuario.estado !== 'ACTIVO' || usuario.estado_autorizacion !== 'AUTORIZADO') {
      throw error('USUARIO_NO_HABILITADO', 'La cuenta operadora ya no está habilitada.', 403);
    }
    const resultado = await operacion(conexion);
    await conexion.commit();
    return resultado;
  } catch (fallo) {
    await conexion.rollback();
    if (fallo.errno === 1452) throw error('RELACION_NO_ENCONTRADA', 'La referencia solicitada no existe.', 400);
    throw fallo;
  } finally {
    conexion.release();
  }
}

export async function buscarIdentidad(datos, actor) {
  return transaccion(actor, async (conexion) => {
    const [limite] = await conexion.query(
      `SELECT COUNT(*) AS total FROM registros_auditoria WHERE usuario_actor_id = ?
       AND accion = 'BUSQUEDA_MANUAL_IDENTIDAD' AND registrado_en > TIMESTAMPADD(MINUTE, -1, CURRENT_TIMESTAMP(3))`, [actor],
    );
    if (limite.total >= 20) throw error('LIMITE_BUSQUEDA_MANUAL', 'Espera un minuto antes de volver a buscar.', 429);
    const [fila] = await conexion.query(
      `SELECT id, codigo_institucional, CONCAT_WS(' ', nombres, apellidos) AS nombre_completo,
       foto_url, estado, estado_autorizacion, identidad_verificada FROM usuarios
       WHERE ${datos.codigo ? 'codigo_institucional = UPPER(?)' : 'correo_institucional = LOWER(?)'} LIMIT 1`,
      [datos.codigo ?? datos.correo],
    );
    await auditar(conexion, actor, 'BUSQUEDA_MANUAL_IDENTIDAD', 'USUARIO', fila?.id ?? 'SIN_COINCIDENCIA', {
      criterio: datos.codigo ? 'CODIGO' : 'CORREO', motivo: datos.motivo,
    });
    if (!fila) return null;
    return {
      id: fila.id, codigo_institucional: fila.codigo_institucional,
      nombre_completo: fila.nombre_completo, foto_url: fila.foto_url,
      estado: fila.estado, estado_autorizacion: fila.estado_autorizacion,
      identidad_verificada: Boolean(fila.identidad_verificada),
      bloqueo_vigente: await tieneBloqueoIdentidad(conexion, fila.id),
      permite_ingreso: false,
    };
  });
}

export async function iniciarTurno(actor, puntoId) {
  return transaccion(actor, async (conexion) => {
    const [abierto] = await conexion.query('SELECT id FROM turnos_seguridad WHERE usuario_seguridad_id = ? AND cerrado_en IS NULL', [actor]);
    if (abierto) throw error('TURNO_YA_ABIERTO', 'Cierra el turno anterior antes de iniciar otro.');
    const fila = await conexion.query('INSERT INTO turnos_seguridad (usuario_seguridad_id, punto_acceso_id) VALUES (?, ?)', [actor, puntoId]);
    await auditar(conexion, actor, 'TURNO_INICIADO', 'TURNO', fila.insertId);
    const [turno] = await conexion.query('SELECT * FROM turnos_seguridad WHERE id = ?', [fila.insertId]);
    return turno;
  });
}

export async function listarTurnos(actor, actual = false) {
  const filas = await grupoConexiones.query(
    `SELECT t.*, p.codigo AS punto_acceso_codigo FROM turnos_seguridad t
     JOIN puntos_acceso p ON p.id = t.punto_acceso_id
     WHERE usuario_seguridad_id = ? ${actual ? 'AND cerrado_en IS NULL' : ''}
     ORDER BY t.id DESC LIMIT 50`, [actor],
  );
  return actual ? filas[0] ?? null : filas;
}

export async function cerrarTurno(actor, turnoId) {
  return transaccion(actor, async (conexion) => {
    const [turno] = await conexion.query('SELECT * FROM turnos_seguridad WHERE id = ? AND usuario_seguridad_id = ? FOR UPDATE', [turnoId, actor]);
    if (!turno) throw error('TURNO_NO_ENCONTRADO', 'No se encontró un turno propio.', 404);
    if (!turno.cerrado_en) {
      await conexion.query('UPDATE turnos_seguridad SET cerrado_en = CURRENT_TIMESTAMP(3) WHERE id = ?', [turnoId]);
      await auditar(conexion, actor, 'TURNO_CERRADO', 'TURNO', turnoId);
    }
    const [resultado] = await conexion.query('SELECT * FROM turnos_seguridad WHERE id = ?', [turnoId]);
    return resultado;
  });
}

async function exigirValidacionPropia(conexion, actor, registroId) {
  const [registro] = await conexion.query('SELECT id FROM registros_acceso WHERE id = ? AND usuario_seguridad_id = ?', [registroId, actor]);
  if (!registro) throw error('VALIDACION_NO_ENCONTRADA', 'No se encontró una validación propia.', 404);
}

export async function crearIncidencia(actor, registroId, datos) {
  return transaccion(actor, async (conexion) => {
    await exigirValidacionPropia(conexion, actor, registroId);
    const [existente] = await conexion.query('SELECT * FROM incidencias_seguridad WHERE responsable_id = ? AND clave_idempotencia = ?', [actor, datos.clave_idempotencia]);
    if (existente) {
      if (existente.registro_acceso_id !== registroId || existente.tipo !== datos.tipo || existente.observacion !== datos.observacion) {
        throw error('IDEMPOTENCIA_EN_CONFLICTO', 'La clave ya corresponde a otra incidencia.');
      }
      return { incidencia: existente, creada: false };
    }
    const insercion = await conexion.query(
      `INSERT INTO incidencias_seguridad (registro_acceso_id, responsable_id, tipo, observacion, clave_idempotencia)
       VALUES (?, ?, ?, ?, ?)`, [registroId, actor, datos.tipo, datos.observacion, datos.clave_idempotencia],
    );
    await auditar(conexion, actor, 'INCIDENCIA_REGISTRADA', 'INCIDENCIA', insercion.insertId, { registro_acceso_id: registroId, tipo: datos.tipo });
    const [incidencia] = await conexion.query('SELECT * FROM incidencias_seguridad WHERE id = ?', [insercion.insertId]);
    return { incidencia, creada: true };
  });
}

export async function listarIncidencias(actor, registroId) {
  await exigirValidacionPropia(grupoConexiones, actor, registroId);
  return grupoConexiones.query('SELECT * FROM incidencias_seguridad WHERE registro_acceso_id = ? ORDER BY id DESC LIMIT 50', [registroId]);
}

export async function consultarIncidencias({ pagina, limite }) {
  const [conteo] = await grupoConexiones.query('SELECT COUNT(*) AS total FROM incidencias_seguridad');
  const filas = await grupoConexiones.query('SELECT * FROM incidencias_seguridad ORDER BY id DESC LIMIT ? OFFSET ?', [limite, (pagina - 1) * limite]);
  return { datos: filas, paginacion: { pagina, limite, total: conteo.total, total_paginas: Math.ceil(conteo.total / limite) } };
}

export async function listarBloqueos(usuarioId) {
  const filas = await grupoConexiones.query(
    `SELECT *, (rehabilitado_en IS NULL AND vigente_desde <= CURRENT_TIMESTAMP(3)
     AND (vigente_hasta IS NULL OR vigente_hasta > CURRENT_TIMESTAMP(3))) AS vigente
     FROM bloqueos_identidad WHERE usuario_id = ? ORDER BY id DESC LIMIT 50`, [usuarioId],
  );
  return filas.map((fila) => ({ ...fila, vigente: Boolean(fila.vigente) }));
}

export async function bloquearIdentidad(actor, usuarioId, datos) {
  if (actor === usuarioId) throw error('ADMINISTRADOR_NO_PUEDE_DESHABILITARSE', 'No puedes bloquear tu propia identidad.');
  return transaccion(actor, async (conexion) => {
    const [usuario] = await conexion.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId]);
    if (!usuario) throw error('USUARIO_NO_ENCONTRADO', 'La identidad no existe.', 404);
    if (await tieneBloqueoIdentidad(conexion, usuarioId)) throw error('IDENTIDAD_YA_BLOQUEADA', 'La identidad ya tiene un bloqueo vigente.');
    const insercion = await conexion.query(
      'INSERT INTO bloqueos_identidad (usuario_id, motivo, creado_por, vigente_hasta) VALUES (?, ?, ?, ?)',
      [usuarioId, datos.motivo, actor, datos.vigente_hasta ? new Date(datos.vigente_hasta) : null],
    );
    await conexion.query("UPDATE sesiones SET estado = 'REVOCADA', revocada_en = CURRENT_TIMESTAMP(3), motivo_revocacion = 'IDENTIDAD_BLOQUEADA' WHERE usuario_id = ? AND estado = 'ACTIVA'", [usuarioId]);
    await conexion.query("UPDATE credenciales_acceso SET estado = 'REVOCADA', revocada_en = CURRENT_TIMESTAMP(3), motivo_revocacion = 'IDENTIDAD_BLOQUEADA' WHERE usuario_id = ? AND estado = 'PENDIENTE'", [usuarioId]);
    await conexion.query("UPDATE dispositivos SET estado = 'REVOCADO', secreto_qr_cifrado = NULL WHERE usuario_id = ? AND secreto_qr_cifrado IS NOT NULL", [usuarioId]);
    await auditar(conexion, actor, 'IDENTIDAD_BLOQUEADA', 'USUARIO', usuarioId, { bloqueo_id: insercion.insertId, motivo: datos.motivo, vigente_hasta: datos.vigente_hasta });
    const [bloqueo] = await conexion.query('SELECT * FROM bloqueos_identidad WHERE id = ?', [insercion.insertId]);
    return bloqueo;
  });
}

export async function rehabilitarIdentidad(actor, usuarioId, bloqueoId, datos) {
  return transaccion(actor, async (conexion) => {
    await conexion.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId]);
    const [bloqueo] = await conexion.query('SELECT * FROM bloqueos_identidad WHERE id = ? AND usuario_id = ? FOR UPDATE', [bloqueoId, usuarioId]);
    if (!bloqueo) throw error('BLOQUEO_NO_ENCONTRADO', 'El bloqueo no existe para esa identidad.', 404);
    if (!bloqueo.rehabilitado_en) {
      await conexion.query('UPDATE bloqueos_identidad SET rehabilitado_en = CURRENT_TIMESTAMP(3), rehabilitado_por = ?, motivo_rehabilitacion = ? WHERE id = ?', [actor, datos.motivo, bloqueoId]);
      await auditar(conexion, actor, 'IDENTIDAD_REHABILITADA', 'USUARIO', usuarioId, { bloqueo_id: bloqueoId, motivo: datos.motivo });
    }
    const [resultado] = await conexion.query('SELECT * FROM bloqueos_identidad WHERE id = ?', [bloqueoId]);
    return resultado;
  });
}

const camposRegla = ['nombre', 'rol', 'estado_usuario', 'accion', 'punto_acceso_id', 'dias_semana', 'hora_inicio', 'hora_fin', 'vigente_desde', 'vigente_hasta', 'activo'];
function normalizarRegla(regla) {
  return { ...regla, activo: Boolean(regla.activo), dias_semana: typeof regla.dias_semana === 'string' ? JSON.parse(regla.dias_semana) : regla.dias_semana };
}
export async function guardarRegla(actor, datos, reglaId) {
  return transaccion(actor, async (conexion) => {
    const valores = camposRegla.map((campo) => {
      if (campo === 'dias_semana') return JSON.stringify(datos[campo]);
      if (campo.startsWith('vigente_')) return datos[campo] ? new Date(datos[campo]) : null;
      return datos[campo];
    });
    if (reglaId) {
      const [previa] = await conexion.query('SELECT id FROM reglas_acceso WHERE id = ? FOR UPDATE', [reglaId]);
      if (!previa) throw error('REGLA_NO_ENCONTRADA', 'La regla no existe.', 404);
      await conexion.query(`UPDATE reglas_acceso SET ${camposRegla.map((campo) => `${campo} = ?`).join(', ')}, actualizado_por = ? WHERE id = ?`, [...valores, actor, reglaId]);
    } else {
      const nueva = await conexion.query(`INSERT INTO reglas_acceso (${camposRegla.join(', ')}, creado_por, actualizado_por) VALUES (${camposRegla.map(() => '?').join(', ')}, ?, ?)`, [...valores, actor, actor]);
      reglaId = nueva.insertId;
    }
    await auditar(conexion, actor, 'REGLA_ACCESO_GUARDADA', 'REGLA_ACCESO', reglaId, datos);
    const [regla] = await conexion.query('SELECT * FROM reglas_acceso WHERE id = ?', [reglaId]);
    return normalizarRegla(regla);
  });
}

export async function listarReglas({ pagina, limite }) {
  const [conteo] = await grupoConexiones.query('SELECT COUNT(*) AS total FROM reglas_acceso');
  const filas = await grupoConexiones.query('SELECT * FROM reglas_acceso ORDER BY id DESC LIMIT ? OFFSET ?', [limite, (pagina - 1) * limite]);
  return { datos: filas.map(normalizarRegla), paginacion: { pagina, limite, total: conteo.total, total_paginas: Math.ceil(conteo.total / limite) } };
}
