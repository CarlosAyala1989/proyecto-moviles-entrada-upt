import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';
import { calcularHashToken } from '../src/seguridad/tokens.js';

const sufijo = randomBytes(4).toString('hex').toUpperCase();
const contrasena = 'Historial-Personal!2026';
const aplicacion = crearAplicacion({ entornoEjecucion: 'test' });
const usuarios = new Map();
const registros = [];
const rolesPrueba = {
  estudiante: 'ESTUDIANTE',
  otro: 'ESTUDIANTE',
  docente: 'DOCENTE',
  trabajador: 'TRABAJADOR',
  seguridad: 'SEGURIDAD',
  administrador: 'ADMINISTRADOR',
  vacio: 'ESTUDIANTE',
  flujo: 'ESTUDIANTE',
};
const codigoPunto = `US14-PUNTO-${sufijo}`;
let puntoId;

async function iniciarSesion(nombre) {
  const respuesta = await request(aplicacion)
    .post('/api/autenticacion/iniciar-sesion')
    .send({ identificador: usuarios.get(nombre).codigo, contrasena })
    .expect(201);
  return respuesta.body.datos.token_acceso;
}

function consultar(nombre = 'estudiante', consulta = {}) {
  return request(aplicacion).get('/api/ingresos/historial')
    .query(consulta)
    .set('authorization', `Bearer ${usuarios.get(nombre).token}`);
}

async function insertarRegistro(nombre, resultado, fecha) {
  const insercion = await grupoConexiones.query(
    `INSERT INTO registros_acceso
      (usuario_id, punto_acceso_id, usuario_seguridad_id, resultado, motivo,
       registrado_en, huella_token, detalle, latitud_escaneo, longitud_escaneo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5, 5)`,
    [
      nombre ? usuarios.get(nombre).id : null,
      puntoId, usuarios.get('seguridad').id, resultado,
      resultado === 'AUTORIZADO' ? 'ACCESO_AUTORIZADO' : 'CREDENCIAL_YA_UTILIZADA',
      new Date(fecha), 'a'.repeat(64), JSON.stringify({ secreto_interno: 'no_exponer' }),
    ],
  );
  return insercion.insertId;
}

before(async () => {
  const contrasenaHash = await bcrypt.hash(contrasena, 4);
  for (const [nombre, rol] of Object.entries(rolesPrueba)) {
    const codigo = `US14-${nombre.toUpperCase()}-${sufijo}`;
    const resultado = await grupoConexiones.query(
      `INSERT INTO usuarios
        (codigo_institucional, correo_institucional, contrasena_hash, nombres,
         apellidos, estado, estado_autorizacion, identidad_verificada, identidad_verificada_en)
       VALUES (?, ?, ?, 'Prueba', 'Historial personal', 'ACTIVO', 'AUTORIZADO', TRUE,
         CURRENT_TIMESTAMP(3))`,
      [codigo, `${codigo.toLowerCase()}@example.invalid`, contrasenaHash],
    );
    usuarios.set(nombre, { id: resultado.insertId, codigo });
    await grupoConexiones.query(
      `INSERT INTO usuarios_roles (usuario_id, rol_id)
       SELECT ?, id FROM roles WHERE nombre = ?`,
      [resultado.insertId, rol],
    );
    usuarios.get(nombre).token = await iniciarSesion(nombre);
  }
  const punto = await grupoConexiones.query(
    `INSERT INTO puntos_acceso
      (codigo, nombre, latitud, longitud, radio_permitido_metros, estado)
     VALUES (?, 'Puerta de prueba US-14', 5, 5, 100, 'ACTIVO')`,
    [codigoPunto],
  );
  puntoId = punto.insertId;
  await grupoConexiones.query(
    `INSERT INTO asignaciones_seguridad (usuario_id, punto_acceso_id, asignado_por)
     VALUES (?, ?, ?)`,
    [usuarios.get('seguridad').id, puntoId, usuarios.get('administrador').id],
  );
  // Fechas e IDs en distinto orden; el empate se resuelve por ID descendente.
  registros.push(await insertarRegistro('estudiante', 'DENEGADO', '2026-10-18T15:00:00.000Z'));
  registros.push(await insertarRegistro('estudiante', 'AUTORIZADO', '2026-10-18T14:00:00.000Z'));
  registros.push(await insertarRegistro('estudiante', 'AUTORIZADO', '2026-10-18T15:00:00.000Z'));
  for (const nombre of ['otro', 'docente', 'trabajador', 'seguridad', 'administrador']) {
    await insertarRegistro(nombre, 'DENEGADO', '2026-10-18T16:00:00.000Z');
  }
  await insertarRegistro(null, 'DENEGADO', '2026-10-18T17:00:00.000Z');
});

after(async () => {
  try {
    // Sólo se eliminan los IDs creados por esta ejecución.
    if (puntoId) {
      await grupoConexiones.query('DELETE FROM registros_acceso WHERE punto_acceso_id = ?', [puntoId]);
      await grupoConexiones.query('DELETE FROM asignaciones_seguridad WHERE punto_acceso_id = ?', [puntoId]);
    }
    for (const { id } of usuarios.values()) {
      for (const tabla of [
        'registros_auditoria', 'credenciales_acceso', 'intentos_inicio_sesion',
        'sesiones', 'usuarios_roles',
      ]) {
        const columna = tabla === 'registros_auditoria' ? 'usuario_actor_id' : 'usuario_id';
        await grupoConexiones.query(`DELETE FROM ${tabla} WHERE ${columna} = ?`, [id]);
      }
      await grupoConexiones.query('DELETE FROM usuarios WHERE id = ?', [id]);
    }
    if (puntoId) await grupoConexiones.query('DELETE FROM puntos_acceso WHERE id = ?', [puntoId]);
  } finally {
    await grupoConexiones.end();
  }
});

describe('US-14: historial personal autenticado', { concurrency: false }, () => {
  it('exige autenticación y rechaza tokens inválidos', async () => {
    const sinToken = await request(aplicacion).get('/api/ingresos/historial').expect(401);
    assert.equal(sinToken.body.error.codigo, 'AUTENTICACION_REQUERIDA');
    const invalido = await request(aplicacion).get('/api/ingresos/historial')
      .set('authorization', 'Bearer token-inexistente').expect(401);
    assert.equal(invalido.body.error.codigo, 'TOKEN_ACCESO_INVALIDO');
  });

  it('devuelve ingresos y rechazos propios, ordenados y con tipos estables', async () => {
    const respuesta = await consultar().expect(200);
    assert.equal(respuesta.headers['cache-control'], 'no-store');
    assert.deepEqual(respuesta.body.paginacion, { pagina: 1, limite: 20, total: 3, total_paginas: 1 });
    assert.deepEqual(respuesta.body.datos.map(({ id }) => id), [registros[2], registros[0], registros[1]]);
    for (const registro of respuesta.body.datos) {
      assert.deepEqual(Object.keys(registro).sort(), [
        'id', 'motivo', 'punto_acceso', 'registrado_en', 'resultado', 'usuario_id',
      ]);
      assert.equal(typeof registro.id, 'number');
      assert.equal(registro.usuario_id, usuarios.get('estudiante').id);
      assert.equal(typeof registro.motivo, 'string');
      assert.match(registro.registrado_en, /^2026-10-18T1[45]:00:00\.000Z$/);
      assert.deepEqual(registro.punto_acceso, {
        id: puntoId, codigo: codigoPunto, nombre: 'Puerta de prueba US-14',
      });
    }
    assert.doesNotMatch(JSON.stringify(respuesta.body), /huella|secreto|seguridad|latitud|longitud|token|correo|contrasena/i);
  });

  it('pagina sin repetir registros y devuelve lista vacía fuera de rango', async () => {
    const ids = [];
    for (let pagina = 1; pagina <= 3; pagina += 1) {
      const respuesta = await consultar('estudiante', { pagina, limite: 1 }).expect(200);
      assert.deepEqual(respuesta.body.paginacion, { pagina, limite: 1, total: 3, total_paginas: 3 });
      ids.push(respuesta.body.datos[0].id);
    }
    assert.deepEqual(ids, [registros[2], registros[0], registros[1]]);
    const fuera = await consultar('estudiante', { pagina: 4, limite: 1 }).expect(200);
    assert.deepEqual(fuera.body.datos, []);
    assert.equal(fuera.body.paginacion.total, 3);
  });

  it('filtra autorizaciones y rechazos sin mezclar otros usuarios', async () => {
    for (const [resultado, ids] of [
      ['AUTORIZADO', [registros[2], registros[1]]], ['DENEGADO', [registros[0]]],
    ]) {
      const respuesta = await consultar('estudiante', { resultado }).expect(200);
      assert.deepEqual(respuesta.body.datos.map(({ id }) => id), ids);
      assert.equal(respuesta.body.paginacion.total, ids.length);
    }
  });

  it('aplica fechas inclusivas, zonas horarias y combinación de filtros', async () => {
    const respuesta = await consultar('estudiante', {
      desde: '2026-10-18T10:00:00.000-05:00',
      hasta: '2026-10-18T15:00:00.000Z', resultado: 'DENEGADO',
    }).expect(200);
    assert.deepEqual(respuesta.body.datos.map(({ id }) => id), [registros[0]]);
    const desde = await consultar('estudiante', { desde: '2026-10-18T15:00:00.000Z' }).expect(200);
    assert.equal(desde.body.paginacion.total, 2);
    const hasta = await consultar('estudiante', { hasta: '2026-10-18T14:00:00.000Z' }).expect(200);
    assert.deepEqual(hasta.body.datos.map(({ id }) => id), [registros[1]]);
  });

  it('devuelve un contrato vacío para usuarios sin actividad o sin coincidencias', async () => {
    for (const [nombre, consulta] of [
      ['vacio', {}], ['estudiante', { desde: '2027-01-01T00:00:00Z' }],
    ]) {
      const respuesta = await consultar(nombre, consulta).expect(200);
      assert.deepEqual(respuesta.body, {
        datos: [], paginacion: { pagina: 1, limite: 20, total: 0, total_paginas: 0 },
      });
    }
  });

  it('permite todos los roles y siempre limita al titular, incluso seguridad y administrador', async () => {
    for (const nombre of ['otro', 'docente', 'trabajador', 'seguridad', 'administrador']) {
      const respuesta = await consultar(nombre).expect(200);
      assert.equal(respuesta.body.paginacion.total, 1);
      assert.equal(respuesta.body.datos[0].usuario_id, usuarios.get(nombre).id);
    }
  });

  it('rechaza filtros de identidad, parámetros desconocidos y consultas inválidas', async () => {
    for (const consulta of [
      { usuario_id: usuarios.get('otro').id }, { usuarioId: usuarios.get('otro').id },
      { usuario_seguridad_id: usuarios.get('seguridad').id }, { buscar: 'otro' },
      { pagina: 0 }, { pagina: -1 }, { pagina: 1.5 }, { pagina: 1000001 },
      { pagina: 'abc' }, { limite: 0 }, { limite: 101 }, { limite: '' },
      { resultado: 'RECHAZADO' }, { resultado: "DENEGADO' OR 1=1 --" },
      { desde: '2026-10-18' }, { hasta: '2026-10-18T15:00:00' },
      { desde: '2026-02-30T00:00:00Z' }, { hasta: 'no-es-fecha' },
      { desde: '2026-10-19T00:00:00Z', hasta: '2026-10-18T00:00:00Z' },
      { resultado: ['AUTORIZADO', 'DENEGADO'] },
    ]) {
      const respuesta = await consultar('estudiante', consulta).expect(400);
      assert.equal(respuesta.body.error.codigo, 'DATOS_INVALIDOS');
    }
  });

  it('mantiene las restricciones de las rutas de seguridad existentes', async () => {
    await request(aplicacion).get('/api/ingresos/recientes')
      .set('authorization', `Bearer ${usuarios.get('estudiante').token}`).expect(403);
    await request(aplicacion).post('/api/ingresos/validar')
      .set('authorization', `Bearer ${usuarios.get('estudiante').token}`).send({}).expect(403);
    await request(aplicacion).get('/api/administracion/accesos')
      .set('authorization', `Bearer ${usuarios.get('estudiante').token}`).expect(403);
  });

  it('rechaza sesiones vencidas, revocadas y cuentas bloqueadas', async () => {
    const tokenVencido = await iniciarSesion('vacio');
    await grupoConexiones.query(
      `UPDATE sesiones SET creada_en = TIMESTAMPADD(HOUR, -1, CURRENT_TIMESTAMP(3)),
        expira_en = TIMESTAMPADD(MINUTE, -1, CURRENT_TIMESTAMP(3))
       WHERE token_acceso_hash = ?`, [calcularHashToken(tokenVencido)],
    );
    await request(aplicacion).get('/api/ingresos/historial')
      .set('authorization', `Bearer ${tokenVencido}`).expect(401);
    const tokenRevocado = await iniciarSesion('vacio');
    await request(aplicacion).post('/api/autenticacion/cerrar-sesion')
      .set('authorization', `Bearer ${tokenRevocado}`).expect(204);
    await request(aplicacion).get('/api/ingresos/historial')
      .set('authorization', `Bearer ${tokenRevocado}`).expect(401);
    await grupoConexiones.query("UPDATE usuarios SET estado = 'BLOQUEADO' WHERE id = ?", [usuarios.get('vacio').id]);
    const bloqueado = await consultar('vacio').expect(403);
    assert.equal(bloqueado.body.error.codigo, 'USUARIO_NO_HABILITADO');
  });

  it('conserva la consulta histórica de puertas inactivas sin exigir GPS', async () => {
    await grupoConexiones.query("UPDATE puntos_acceso SET estado = 'INACTIVO' WHERE id = ?", [puntoId]);
    try {
      const respuesta = await consultar().expect(200);
      assert.equal(respuesta.body.paginacion.total, 3);
    } finally {
      await grupoConexiones.query("UPDATE puntos_acceso SET estado = 'ACTIVO' WHERE id = ?", [puntoId]);
    }
  });

  it('consulta una autorización y un rechazo producidos por validaciones reales de QR', async () => {
    const ubicacion = () => ({
      latitud: 5, longitud: 5, precision_metros: 5, obtenida_en: new Date().toISOString(),
    });
    const qr = await request(aplicacion).post('/api/codigos-qr')
      .set('authorization', `Bearer ${usuarios.get('flujo').token}`)
      .send({ ubicacion: ubicacion() }).expect(201);
    for (const esperado of ['AUTORIZADO', 'DENEGADO']) {
      const decision = await request(aplicacion).post('/api/ingresos/validar')
        .set('authorization', `Bearer ${usuarios.get('seguridad').token}`)
        .send({ codigo_qr: qr.body.datos.codigo_qr, punto_acceso_codigo: codigoPunto, ubicacion: ubicacion() })
        .expect(200);
      assert.equal(decision.body.datos.resultado, esperado);
    }
    const respuesta = await consultar('flujo').expect(200);
    assert.equal(respuesta.body.paginacion.total, 2);
    assert.deepEqual(respuesta.body.datos.map(({ resultado }) => resultado), ['DENEGADO', 'AUTORIZADO']);
    assert.equal(respuesta.body.datos[0].motivo, 'CREDENCIAL_YA_UTILIZADA');
    assert.ok(respuesta.body.datos.every(({ usuario_id }) => usuario_id === usuarios.get('flujo').id));
  });
});
