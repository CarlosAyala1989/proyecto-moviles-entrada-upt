import { grupoConexiones } from '../../../config/database.js';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';

function paginacion(pagina, limite, total) {
  return {
    pagina,
    limite,
    total,
    total_paginas: Math.ceil(total / limite),
  };
}

function normalizarRegistroAcceso(fila, { incluirUbicacion = false } = {}) {
  const registro = {
    id: fila.id,
    resultado: fila.resultado,
    motivo: fila.motivo,
    registrado_en: fila.registrado_en,
    usuario: fila.usuario_id ? {
      id: fila.usuario_id,
      codigo_institucional: fila.usuario_codigo,
      nombre_completo: fila.usuario_nombre,
    } : null,
    punto_acceso: {
      id: fila.punto_id,
      codigo: fila.punto_codigo,
      nombre: fila.punto_nombre,
    },
    personal_seguridad: {
      id: fila.seguridad_id,
      codigo_institucional: fila.seguridad_codigo,
      nombre_completo: fila.seguridad_nombre,
    },
  };
  if (incluirUbicacion) {
    registro.ubicacion_escaneo = {
      latitud: fila.latitud_escaneo === null ? null : Number(fila.latitud_escaneo),
      longitud: fila.longitud_escaneo === null ? null : Number(fila.longitud_escaneo),
      precision_metros: fila.precision_escaneo_metros === null
        ? null
        : Number(fila.precision_escaneo_metros),
      obtenida_en: fila.ubicacion_escaneo_obtenida_en,
      distancia_punto_acceso_metros: fila.distancia_escaneo_metros === null
        ? null
        : Number(fila.distancia_escaneo_metros),
    };
  }
  return registro;
}

const seleccionRegistroAcceso = `
  registros_acceso.id,
  registros_acceso.resultado,
  registros_acceso.motivo,
  registros_acceso.registrado_en,
  usuarios.id AS usuario_id,
  usuarios.codigo_institucional AS usuario_codigo,
  COALESCE(
    NULLIF(usuarios.nombre_institucional, ''),
    CONCAT_WS(' ', usuarios.nombres, usuarios.apellidos)
  ) AS usuario_nombre,
  puntos_acceso.id AS punto_id,
  puntos_acceso.codigo AS punto_codigo,
  puntos_acceso.nombre AS punto_nombre,
  seguridad.id AS seguridad_id,
  seguridad.codigo_institucional AS seguridad_codigo,
  COALESCE(
    NULLIF(seguridad.nombre_institucional, ''),
    CONCAT_WS(' ', seguridad.nombres, seguridad.apellidos)
  ) AS seguridad_nombre
`;
const relacionesRegistroAcceso = `
  FROM registros_acceso
  LEFT JOIN usuarios ON usuarios.id = registros_acceso.usuario_id
  JOIN puntos_acceso ON puntos_acceso.id = registros_acceso.punto_acceso_id
  JOIN usuarios AS seguridad
    ON seguridad.id = registros_acceso.usuario_seguridad_id
`;

function construirFiltrosAccesos(filtros) {
  const condiciones = [];
  const parametros = [];
  const campos = [
    ['usuario_id', 'registros_acceso.usuario_id'],
    ['punto_acceso_id', 'registros_acceso.punto_acceso_id'],
    ['usuario_seguridad_id', 'registros_acceso.usuario_seguridad_id'],
    ['resultado', 'registros_acceso.resultado'],
    ['motivo', 'registros_acceso.motivo'],
  ];
  for (const [filtro, columna] of campos) {
    if (filtros[filtro] !== undefined) {
      condiciones.push(`${columna} = ?`);
      parametros.push(filtros[filtro]);
    }
  }
  if (filtros.desde) {
    condiciones.push('registros_acceso.registrado_en >= ?');
    parametros.push(filtros.desde);
  }
  if (filtros.hasta) {
    condiciones.push('registros_acceso.registrado_en <= ?');
    parametros.push(filtros.hasta);
  }
  return {
    clausula: condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '',
    parametros,
  };
}

function traducirErrorPuntoAcceso(error) {
  if (error instanceof ErrorHttp) return error;
  if (error.errno === 1062) {
    return new ErrorHttp({
      codigo: 'CODIGO_PUNTO_ACCESO_DUPLICADO',
      mensaje: 'El código del punto de acceso ya está registrado.',
      estadoHttp: 409,
    });
  }
  if (error.errno === 4025) {
    return new ErrorHttp({
      codigo: 'DATOS_PUNTO_ACCESO_INVALIDOS',
      mensaje: 'Los datos del punto de acceso no cumplen las restricciones.',
      estadoHttp: 400,
    });
  }
  return error;
}

function normalizarPuntoAcceso(fila) {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    latitud: Number(fila.latitud),
    longitud: Number(fila.longitud),
    radio_permitido_metros: Number(fila.radio_permitido_metros),
    estado: fila.estado,
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
  };
}

async function obtenerPuntoAcceso(conexion, id) {
  const [punto] = await conexion.query(
    `SELECT id, codigo, nombre, descripcion, latitud, longitud,
      radio_permitido_metros, estado, creado_en, actualizado_en
     FROM puntos_acceso WHERE id = ?`,
    [id],
  );
  return punto ? normalizarPuntoAcceso(punto) : null;
}

async function registrarAuditoria(
  conexion,
  { usuarioActorId, accion, entidad, entidadId, detalle },
) {
  await conexion.query(
    `INSERT INTO registros_auditoria
      (usuario_actor_id, accion, entidad, entidad_id, detalle)
     VALUES (?, ?, ?, ?, ?)`,
    [
      usuarioActorId,
      accion,
      entidad,
      String(entidadId),
      detalle ? JSON.stringify(detalle) : null,
    ],
  );
}

export class RepositorioAdministracionOperativaMariaDb {
  async consultarResumen() {
    const [resumen] = await grupoConexiones.query(
      `SELECT
        (SELECT COUNT(*) FROM usuarios) AS usuarios_total,
        (SELECT COUNT(*) FROM usuarios WHERE estado = 'ACTIVO') AS usuarios_activos,
        (SELECT COUNT(*) FROM usuarios WHERE identidad_verificada = FALSE)
          AS identidades_pendientes,
        (SELECT COUNT(*) FROM puntos_acceso WHERE estado = 'ACTIVO')
          AS puntos_acceso_activos,
        (SELECT COUNT(*) FROM registros_acceso
          WHERE resultado = 'AUTORIZADO'
            AND registrado_en >= CURRENT_DATE()) AS accesos_autorizados_hoy,
        (SELECT COUNT(*) FROM registros_acceso
          WHERE resultado = 'DENEGADO'
            AND registrado_en >= CURRENT_DATE()) AS accesos_denegados_hoy`,
    );
    return resumen;
  }

  async consultarAccesos(filtros) {
    const { clausula, parametros } = construirFiltrosAccesos(filtros);
    const [conteo] = await grupoConexiones.query(
      `SELECT COUNT(*) AS total FROM registros_acceso ${clausula}`,
      parametros,
    );
    const desplazamiento = (filtros.pagina - 1) * filtros.limite;
    const filas = await grupoConexiones.query(
      `SELECT ${seleccionRegistroAcceso}
       ${relacionesRegistroAcceso}
       ${clausula}
       ORDER BY registros_acceso.id DESC
       LIMIT ? OFFSET ?`,
      [...parametros, filtros.limite, desplazamiento],
    );
    return {
      registros: filas.map((fila) => normalizarRegistroAcceso(fila)),
      paginacion: paginacion(filtros.pagina, filtros.limite, conteo.total),
    };
  }

  async obtenerAcceso(id) {
    const [fila] = await grupoConexiones.query(
      `SELECT ${seleccionRegistroAcceso},
        registros_acceso.latitud_escaneo,
        registros_acceso.longitud_escaneo,
        registros_acceso.precision_escaneo_metros,
        registros_acceso.ubicacion_escaneo_obtenida_en,
        registros_acceso.distancia_escaneo_metros
       ${relacionesRegistroAcceso}
       WHERE registros_acceso.id = ?`,
      [id],
    );
    return fila ? normalizarRegistroAcceso(fila, { incluirUbicacion: true }) : null;
  }

  async consultarPuntosAcceso({ pagina, limite, buscar, estado }) {
    const condiciones = [];
    const parametros = [];
    if (buscar) {
      condiciones.push('(codigo LIKE ? OR nombre LIKE ?)');
      parametros.push(`%${buscar}%`, `%${buscar}%`);
    }
    if (estado) {
      condiciones.push('estado = ?');
      parametros.push(estado);
    }
    const clausula = condiciones.length > 0
      ? `WHERE ${condiciones.join(' AND ')}`
      : '';
    const [conteo] = await grupoConexiones.query(
      `SELECT COUNT(*) AS total FROM puntos_acceso ${clausula}`,
      parametros,
    );
    const filas = await grupoConexiones.query(
      `SELECT id, codigo, nombre, descripcion, latitud, longitud,
        radio_permitido_metros, estado, creado_en, actualizado_en
       FROM puntos_acceso
       ${clausula}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...parametros, limite, (pagina - 1) * limite],
    );
    return {
      puntos: filas.map(normalizarPuntoAcceso),
      paginacion: paginacion(pagina, limite, conteo.total),
    };
  }

  async crearPuntoAcceso(datos, usuarioActorId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await conexion.query(
        `INSERT INTO puntos_acceso
          (codigo, nombre, descripcion, latitud, longitud,
           radio_permitido_metros, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          datos.codigo,
          datos.nombre,
          datos.descripcion,
          datos.latitud,
          datos.longitud,
          datos.radio_permitido_metros,
          datos.estado,
        ],
      );
      await registrarAuditoria(conexion, {
        usuarioActorId,
        accion: 'PUNTO_ACCESO_CREADO',
        entidad: 'PUNTO_ACCESO',
        entidadId: resultado.insertId,
        detalle: { codigo: datos.codigo, estado: datos.estado },
      });
      const punto = await obtenerPuntoAcceso(conexion, resultado.insertId);
      await conexion.commit();
      return punto;
    } catch (error) {
      await conexion.rollback();
      throw traducirErrorPuntoAcceso(error);
    } finally {
      conexion.release();
    }
  }

  async actualizarPuntoAcceso(id, datos, usuarioActorId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const [existente] = await conexion.query(
        'SELECT id FROM puntos_acceso WHERE id = ? FOR UPDATE',
        [id],
      );
      if (!existente) {
        throw new ErrorHttp({
          codigo: 'PUNTO_ACCESO_NO_ENCONTRADO',
          mensaje: 'El punto de acceso solicitado no existe.',
          estadoHttp: 404,
        });
      }
      const asignaciones = [];
      const valores = [];
      for (const campo of [
        'codigo',
        'nombre',
        'descripcion',
        'latitud',
        'longitud',
        'radio_permitido_metros',
        'estado',
      ]) {
        if (Object.hasOwn(datos, campo)) {
          asignaciones.push(`${campo} = ?`);
          valores.push(datos[campo]);
        }
      }
      await conexion.query(
        `UPDATE puntos_acceso SET ${asignaciones.join(', ')} WHERE id = ?`,
        [...valores, id],
      );

      const cambiaReglas = [
        'latitud',
        'longitud',
        'radio_permitido_metros',
        'estado',
      ].some((campo) => Object.hasOwn(datos, campo));
      if (cambiaReglas) {
        await conexion.query(
          `UPDATE credenciales_acceso
           SET estado = 'REVOCADA',
               revocada_en = CURRENT_TIMESTAMP(3),
               motivo_revocacion = 'PUNTO_ACCESO_ACTUALIZADO'
           WHERE punto_acceso_id = ? AND estado = 'PENDIENTE'`,
          [id],
        );
      }
      await registrarAuditoria(conexion, {
        usuarioActorId,
        accion: 'PUNTO_ACCESO_ACTUALIZADO',
        entidad: 'PUNTO_ACCESO',
        entidadId: id,
        detalle: { campos: Object.keys(datos) },
      });
      const punto = await obtenerPuntoAcceso(conexion, id);
      await conexion.commit();
      return punto;
    } catch (error) {
      await conexion.rollback();
      throw traducirErrorPuntoAcceso(error);
    } finally {
      conexion.release();
    }
  }

  async consultarAuditoria(filtros) {
    const condiciones = [];
    const parametros = [];
    for (const [filtro, columna] of [
      ['usuario_actor_id', 'registros_auditoria.usuario_actor_id'],
      ['accion', 'registros_auditoria.accion'],
      ['entidad', 'registros_auditoria.entidad'],
    ]) {
      if (filtros[filtro] !== undefined) {
        condiciones.push(`${columna} = ?`);
        parametros.push(filtros[filtro]);
      }
    }
    if (filtros.desde) {
      condiciones.push('registros_auditoria.registrado_en >= ?');
      parametros.push(filtros.desde);
    }
    if (filtros.hasta) {
      condiciones.push('registros_auditoria.registrado_en <= ?');
      parametros.push(filtros.hasta);
    }
    const clausula = condiciones.length > 0
      ? `WHERE ${condiciones.join(' AND ')}`
      : '';
    const [conteo] = await grupoConexiones.query(
      `SELECT COUNT(*) AS total FROM registros_auditoria ${clausula}`,
      parametros,
    );
    const filas = await grupoConexiones.query(
      `SELECT
        registros_auditoria.id,
        registros_auditoria.accion,
        registros_auditoria.entidad,
        registros_auditoria.entidad_id,
        registros_auditoria.registrado_en,
        usuarios.id AS actor_id,
        usuarios.codigo_institucional AS actor_codigo,
        COALESCE(
          NULLIF(usuarios.nombre_institucional, ''),
          CONCAT_WS(' ', usuarios.nombres, usuarios.apellidos)
        ) AS actor_nombre
       FROM registros_auditoria
       LEFT JOIN usuarios
         ON usuarios.id = registros_auditoria.usuario_actor_id
       ${clausula}
       ORDER BY registros_auditoria.id DESC
       LIMIT ? OFFSET ?`,
      [...parametros, filtros.limite, (filtros.pagina - 1) * filtros.limite],
    );
    return {
      registros: filas.map((fila) => ({
        id: fila.id,
        accion: fila.accion,
        entidad: fila.entidad,
        entidad_id: fila.entidad_id,
        registrado_en: fila.registrado_en,
        usuario_actor: fila.actor_id ? {
          id: fila.actor_id,
          codigo_institucional: fila.actor_codigo,
          nombre_completo: fila.actor_nombre,
        } : null,
      })),
      paginacion: paginacion(filtros.pagina, filtros.limite, conteo.total),
    };
  }

  async consultarConfiguraciones(claves) {
    const marcadores = claves.map(() => '?').join(', ');
    return grupoConexiones.query(
      `SELECT clave, valor, tipo, descripcion, actualizado_en
       FROM configuraciones_sistema
       WHERE es_secreta = FALSE AND clave IN (${marcadores})
       ORDER BY clave`,
      claves,
    );
  }

  async actualizarConfiguracion(clave, valor, usuarioActorId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const [anterior] = await conexion.query(
        `SELECT clave, valor, tipo, descripcion, actualizado_en
         FROM configuraciones_sistema
         WHERE clave = ? AND es_secreta = FALSE
         FOR UPDATE`,
        [clave],
      );
      if (!anterior) {
        throw new ErrorHttp({
          codigo: 'CONFIGURACION_NO_ENCONTRADA',
          mensaje: 'La configuración solicitada no existe.',
          estadoHttp: 404,
        });
      }
      await conexion.query(
        `UPDATE configuraciones_sistema
         SET valor = ?, actualizado_por = ?
         WHERE clave = ?`,
        [valor, usuarioActorId, clave],
      );
      await registrarAuditoria(conexion, {
        usuarioActorId,
        accion: 'CONFIGURACION_ACTUALIZADA',
        entidad: 'CONFIGURACION_SISTEMA',
        entidadId: clave,
        detalle: { valor_anterior: anterior.valor, valor_nuevo: valor },
      });
      const [configuracion] = await conexion.query(
        `SELECT clave, valor, tipo, descripcion, actualizado_en
         FROM configuraciones_sistema WHERE clave = ?`,
        [clave],
      );
      await conexion.commit();
      return configuracion;
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }
}
