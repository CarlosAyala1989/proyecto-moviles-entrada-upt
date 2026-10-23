import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';
import { entorno } from '../src/config/env.js';
import { ejecutarMigraciones } from '../src/base_datos/migraciones.js';
import { registrarNotificacionesDenegacion } from '../src/modulos/notificaciones/servicios/notificaciones.servicio.js';
import { calcularOtpOffline, firmarPasoOffline } from '../src/seguridad/codigos_qr_offline.js';
import { calcularHashToken } from '../src/seguridad/tokens.js';

const aplicacion = crearAplicacion({ entornoEjecucion: 'test' });
const sufijo = randomBytes(4).toString('hex').toUpperCase();
const codigoPunto = `ALERTAS-${sufijo}`;
const contrasena = 'Notificaciones-Prueba!2026';
const usuarios = new Map();
const claveOfflineOriginal = process.env.CLAVE_QR_OFFLINE;
let puntoId;
let contrasenaHash;
let iniciales;

const ubicacion = () => ({ latitud: 6, longitud: 6, precision_metros: 5, obtenida_en: new Date().toISOString() });

async function crearUsuario(nombre, rol = 'ESTUDIANTE') {
  const codigo = `AVISOS-${sufijo}-${usuarios.size}`;
  const resultado = await grupoConexiones.query(
    `INSERT INTO usuarios (codigo_institucional, correo_institucional, contrasena_hash,
      nombres, apellidos, estado, estado_autorizacion, identidad_verificada, identidad_verificada_en)
     VALUES (?, ?, ?, 'Prueba', 'Notificaciones', 'ACTIVO', 'AUTORIZADO', TRUE, CURRENT_TIMESTAMP(3))`,
    [codigo, `${codigo.toLowerCase()}@example.invalid`, contrasenaHash],
  );
  usuarios.set(nombre, { id: resultado.insertId, codigo });
  await grupoConexiones.query(
    'INSERT INTO usuarios_roles (usuario_id, rol_id) SELECT ?, id FROM roles WHERE nombre = ?',
    [resultado.insertId, rol],
  );
  const sesion = await request(aplicacion).post('/api/autenticacion/iniciar-sesion')
    .send({ identificador: codigo, contrasena }).expect(201);
  usuarios.get(nombre).token = sesion.body.datos.token_acceso;
  return usuarios.get(nombre);
}

function como(nombre, peticion) {
  return peticion.set('authorization', `Bearer ${usuarios.get(nombre).token}`);
}

async function listar(nombre = 'estudiante', consulta = {}) {
  return como(nombre, request(aplicacion).get('/api/notificaciones').query(consulta)).expect(200);
}

async function generarQr(nombre) {
  const qr = await como(nombre, request(aplicacion).post('/api/codigos-qr'))
    .send({ ubicacion: ubicacion() }).expect(201);
  return qr.body.datos.codigo_qr;
}

async function validar(codigo, esperado) {
  const respuesta = await como('seguridad', request(aplicacion).post('/api/ingresos/validar'))
    .send({ codigo_qr: codigo, punto_acceso_codigo: codigoPunto, ubicacion: ubicacion() }).expect(200);
  assert.equal(respuesta.body.datos.motivo, esperado);
  return respuesta.body.datos;
}

before(async () => {
  process.env.CLAVE_QR_OFFLINE = claveOfflineOriginal ?? randomBytes(32).toString('base64url');
  contrasenaHash = await bcrypt.hash(contrasena, 4);
  await crearUsuario('estudiante');
  await crearUsuario('otro');
  await crearUsuario('vacio');
  await crearUsuario('seguridad', 'SEGURIDAD');
  await crearUsuario('administrador', 'ADMINISTRADOR');
  const punto = await grupoConexiones.query(
    `INSERT INTO puntos_acceso (codigo, nombre, latitud, longitud, radio_permitido_metros, estado)
     VALUES (?, 'Puerta de prueba de avisos', 6, 6, 100, 'ACTIVO')`, [codigoPunto],
  );
  puntoId = punto.insertId;
  await grupoConexiones.query(
    'INSERT INTO asignaciones_seguridad (usuario_id, punto_acceso_id, asignado_por) VALUES (?, ?, ?)',
    [usuarios.get('seguridad').id, puntoId, usuarios.get('administrador').id],
  );
  const revocado = await generarQr('estudiante');
  await como('estudiante', request(aplicacion).delete('/api/codigos-qr/actual')).expect(204);
  await validar(revocado, 'CREDENCIAL_REVOCADA');
  const qr = await generarQr('estudiante');
  await validar(qr, 'ACCESO_AUTORIZADO');
  await validar(qr, 'CREDENCIAL_YA_UTILIZADA');
  const ajeno = await generarQr('otro');
  await como('otro', request(aplicacion).delete('/api/codigos-qr/actual')).expect(204);
  await validar(ajeno, 'CREDENCIAL_REVOCADA');
  iniciales = (await listar()).body.datos;
});

after(async () => {
  try {
    if (puntoId) {
      await grupoConexiones.query('DELETE FROM registros_acceso WHERE punto_acceso_id = ?', [puntoId]);
      await grupoConexiones.query('DELETE FROM asignaciones_seguridad WHERE punto_acceso_id = ?', [puntoId]);
    }
    for (const { id } of usuarios.values()) {
      await grupoConexiones.query(
        `DELETE usos_codigos_offline FROM usos_codigos_offline JOIN dispositivos
         ON dispositivos.id = usos_codigos_offline.dispositivo_id WHERE dispositivos.usuario_id = ?`, [id],
      );
      for (const tabla of ['registros_auditoria', 'credenciales_acceso', 'dispositivos', 'intentos_inicio_sesion', 'sesiones', 'usuarios_roles']) {
        const columna = tabla === 'registros_auditoria' ? 'usuario_actor_id' : 'usuario_id';
        await grupoConexiones.query(`DELETE FROM ${tabla} WHERE ${columna} = ?`, [id]);
      }
      await grupoConexiones.query('DELETE FROM usuarios WHERE id = ?', [id]);
    }
    if (puntoId) await grupoConexiones.query('DELETE FROM puntos_acceso WHERE id = ?', [puntoId]);
  } finally {
    if (claveOfflineOriginal === undefined) delete process.env.CLAVE_QR_OFFLINE;
    else process.env.CLAVE_QR_OFFLINE = claveOfflineOriginal;
    await grupoConexiones.end();
  }
});

describe('US-20 y US-21: notificaciones personales de acceso', { concurrency: false }, () => {
  it('exige Bearer en todos los endpoints y rechaza tokens inválidos', async () => {
    for (const [metodo, ruta] of [
      ['get', '/api/notificaciones'], ['get', '/api/notificaciones/resumen'],
      ['get', '/api/notificaciones/1'], ['patch', '/api/notificaciones/1/leida'],
    ]) {
      const sinToken = await request(aplicacion)[metodo](ruta).expect(401);
      assert.equal(sinToken.body.error.codigo, 'AUTENTICACION_REQUERIDA');
      const invalido = await request(aplicacion)[metodo](ruta).set('authorization', 'Bearer invalido').expect(401);
      assert.equal(invalido.body.error.codigo, 'TOKEN_ACCESO_INVALIDO');
    }
  });

  it('genera aviso con causa general y soporte para cada denegación identificada', async () => {
    const respuesta = await listar();
    assert.deepEqual(respuesta.body.paginacion, { pagina: 1, limite: 20, total: 3, total_paginas: 1 });
    const avisos = respuesta.body.datos.filter(({ tipo }) => tipo === 'DENEGACION_ACCESO');
    assert.equal(avisos.length, 2);
    const revocado = avisos.find(({ causa_general }) => causa_general.includes('anulada'));
    assert.ok(revocado);
    assert.equal(revocado.evento, 'ACCESO_DENEGADO');
    assert.equal(revocado.canal_soporte, entorno.canalSoporteAcceso);
    assert.equal(revocado.estado, 'NO_LEIDA');
    assert.equal(revocado.leida_en, null);
    assert.equal(respuesta.headers['cache-control'], 'no-store');
  });

  it('genera además una alerta por reutilización del QR, sin alertar por una revocación normal', async () => {
    const alerta = iniciales.find(({ tipo }) => tipo === 'INTENTO_SOSPECHOSO');
    assert.equal(alerta.evento, 'CREDENCIAL_YA_UTILIZADA');
    const relacionadas = iniciales.filter(({ registro_acceso_id }) => registro_acceso_id === alerta.registro_acceso_id);
    assert.equal(relacionadas.length, 2);
    assert.deepEqual(new Set(relacionadas.map(({ tipo }) => tipo)), new Set(['DENEGACION_ACCESO', 'INTENTO_SOSPECHOSO']));
    assert.equal((await listar('otro', { tipo: 'INTENTO_SOSPECHOSO' })).body.paginacion.total, 0);
  });

  it('mantiene tipos, fecha del intento, puerta y privacidad de la respuesta', async () => {
    for (const notificacion of iniciales) {
      assert.deepEqual(Object.keys(notificacion).sort(), [
        'canal_soporte', 'causa_general', 'creada_en', 'estado', 'evento', 'id', 'leida_en',
        'mensaje', 'punto_acceso', 'registrado_en', 'registro_acceso_id', 'tipo', 'titulo', 'usuario_id',
      ]);
      for (const campo of ['id', 'usuario_id', 'registro_acceso_id']) assert.equal(typeof notificacion[campo], 'number');
      assert.equal(notificacion.usuario_id, usuarios.get('estudiante').id);
      assert.match(notificacion.creada_en, /\.\d{3}Z$/);
      assert.match(notificacion.registrado_en, /\.\d{3}Z$/);
      assert.deepEqual(notificacion.punto_acceso, { id: puntoId, codigo: codigoPunto, nombre: 'Puerta de prueba de avisos' });
    }
    assert.doesNotMatch(JSON.stringify(iniciales), /huella_token|otp_hash|token_hash|contrasena|latitud|longitud|usuario_seguridad|correo_institucional/);
  });

  it('pagina con orden estable y filtra tipo, estado y fechas inclusivas', async () => {
    const ids = [];
    for (let pagina = 1; pagina <= 3; pagina += 1) {
      const respuesta = await listar('estudiante', { pagina, limite: 1 });
      assert.equal(respuesta.body.paginacion.total_paginas, 3);
      ids.push(respuesta.body.datos[0].id);
    }
    assert.deepEqual(ids, iniciales.map(({ id }) => id));
    assert.deepEqual((await listar('estudiante', { pagina: 4, limite: 1 })).body.datos, []);
    const alerta = await listar('estudiante', { tipo: 'INTENTO_SOSPECHOSO', estado: 'NO_LEIDA', desde: iniciales[0].creada_en, hasta: iniciales[0].creada_en });
    assert.equal(alerta.body.paginacion.total, 1);
    assert.equal((await listar('estudiante', { hasta: '2020-01-01T00:00:00Z' })).body.paginacion.total, 0);
  });

  it('consulta detalle y contador sin marcar automáticamente como leído', async () => {
    const antes = await como('estudiante', request(aplicacion).get('/api/notificaciones/resumen')).expect(200);
    assert.deepEqual(antes.body.datos, { total_no_leidas: 3, denegaciones_no_leidas: 2, alertas_no_leidas: 1 });
    const detalle = await como('estudiante', request(aplicacion).get(`/api/notificaciones/${iniciales[0].id}`)).expect(200);
    assert.deepEqual(detalle.body.datos, iniciales[0]);
    assert.equal((await listar('estudiante', { estado: 'NO_LEIDA' })).body.paginacion.total, 3);
  });

  it('no permite consultar ni marcar notificaciones de otros titulares, incluso como administrador', async () => {
    for (const nombre of ['otro', 'administrador', 'seguridad']) {
      for (const [metodo, sufijoRuta] of [['get', ''], ['patch', '/leida']]) {
        const respuesta = await como(nombre, request(aplicacion)[metodo](`/api/notificaciones/${iniciales[0].id}${sufijoRuta}`)).expect(404);
        assert.equal(respuesta.body.error.codigo, 'NOTIFICACION_NO_ENCONTRADA');
      }
      assert.ok((await listar(nombre)).body.datos.every(({ usuario_id }) => usuario_id === usuarios.get(nombre).id));
    }
    await como('estudiante', request(aplicacion).get('/api/notificaciones/9007199254740991')).expect(404);
  });

  it('marca lectura de forma idempotente y actualiza contadores', async () => {
    const ruta = `/api/notificaciones/${iniciales[0].id}/leida`;
    const primera = await como('estudiante', request(aplicacion).patch(ruta)).expect(200);
    assert.equal(primera.body.datos.estado, 'LEIDA');
    assert.match(primera.body.datos.leida_en, /\.\d{3}Z$/);
    const repetidas = await Promise.all([
      como('estudiante', request(aplicacion).patch(ruta).send({})).expect(200),
      como('estudiante', request(aplicacion).patch(ruta)).expect(200),
    ]);
    assert.ok(repetidas.every(({ body }) => body.datos.leida_en === primera.body.datos.leida_en));
    const resumen = await como('estudiante', request(aplicacion).get('/api/notificaciones/resumen')).expect(200);
    assert.deepEqual(resumen.body.datos, { total_no_leidas: 2, denegaciones_no_leidas: 2, alertas_no_leidas: 0 });
    assert.equal((await listar('estudiante', { estado: 'LEIDA' })).body.paginacion.total, 1);
  });

  it('devuelve listas y contadores vacíos para usuarios sin actividad', async () => {
    assert.deepEqual((await listar('vacio')).body, {
      datos: [], paginacion: { pagina: 1, limite: 20, total: 0, total_paginas: 0 },
    });
    const resumen = await como('vacio', request(aplicacion).get('/api/notificaciones/resumen')).expect(200);
    assert.deepEqual(resumen.body.datos, { total_no_leidas: 0, denegaciones_no_leidas: 0, alertas_no_leidas: 0 });
  });

  it('rechaza filtros ajenos, cuerpos no permitidos y parámetros inválidos', async () => {
    for (const consulta of [
      { usuario_id: 1 }, { usuarioId: 1 }, { registro_acceso_id: 1 }, { tipo: 'OTRO' },
      { estado: 'PENDIENTE' }, { pagina: 0 }, { pagina: 1.5 }, { pagina: 1000001 },
      { limite: 101 }, { limite: -1 }, { limite: '' }, { desde: '2026-10-23' },
      { hasta: '2026-02-30T00:00:00Z' }, { desde: '2027-01-01T00:00:00Z', hasta: '2026-01-01T00:00:00Z' },
      { tipo: ['DENEGACION_ACCESO', 'INTENTO_SOSPECHOSO'] },
    ]) {
      const respuesta = await como('estudiante', request(aplicacion).get('/api/notificaciones').query(consulta)).expect(400);
      assert.equal(respuesta.body.error.codigo, 'DATOS_INVALIDOS');
    }
    for (const id of ['0', '-1', 'abc', '1.5', '9007199254740992']) {
      await como('estudiante', request(aplicacion).get(`/api/notificaciones/${id}`)).expect(400);
    }
    await como('estudiante', request(aplicacion).get('/api/notificaciones/resumen?usuario_id=1')).expect(400);
    await como('estudiante', request(aplicacion).patch(`/api/notificaciones/${iniciales[1].id}/leida`).send({ usuario_id: 1 })).expect(400);
    await como('estudiante', request(aplicacion).patch(`/api/notificaciones/${iniciales[1].id}/leida?estado=LEIDA`)).expect(400);
  });

  it('no genera avisos por ingresos autorizados ni por códigos sin titular identificable', async () => {
    const contar = () => grupoConexiones.query(
      `SELECT COUNT(*) AS total FROM notificaciones_usuario n
       JOIN registros_acceso r ON r.id = n.registro_acceso_id WHERE r.punto_acceso_id = ?`, [puntoId],
    );
    const [antes] = await contar();
    const qr = await generarQr('vacio');
    await validar(qr, 'ACCESO_AUTORIZADO');
    await validar('codigo-desconocido', 'TOKEN_INVALIDO');
    const [despues] = await contar();
    assert.equal(despues.total, antes.total);
  });

  it('alerta al titular cuando se altera un QR reconocido', async () => {
    await crearUsuario('alterado');
    const partes = (await generarQr('alterado')).split('.');
    partes[2] = `${partes[2][0] === 'A' ? 'B' : 'A'}${partes[2].slice(1)}`;
    await validar(partes.join('.'), 'INTEGRIDAD_CREDENCIAL_INVALIDA');
    const notificaciones = (await listar('alterado')).body.datos;
    assert.equal(notificaciones.length, 2);
    assert.equal(notificaciones[0].evento, 'INTEGRIDAD_CREDENCIAL_INVALIDA');
  });

  it('notifica un QR expirado con causa general sin clasificarlo como sospechoso', async () => {
    await crearUsuario('expirado');
    const qr = await generarQr('expirado');
    await grupoConexiones.query("UPDATE credenciales_acceso SET estado = 'EXPIRADA' WHERE usuario_id = ?", [usuarios.get('expirado').id]);
    await validar(qr, 'CREDENCIAL_EXPIRADA');
    const notificaciones = (await listar('expirado')).body.datos;
    assert.equal(notificaciones.length, 1);
    assert.equal(notificaciones[0].tipo, 'DENEGACION_ACCESO');
    assert.equal(notificaciones[0].causa_general, 'La credencial presentada ya venció.');
  });

  it('cubre QR offline reutilizado y dispositivo desvinculado', async () => {
    await crearUsuario('offline');
    const preparado = await como('offline', request(aplicacion).post('/api/codigos-qr/preparar-offline'))
      .send({ identificador_dispositivo: randomBytes(32).toString('base64url'), plataforma: 'ANDROID' }).expect(201);
    const datos = preparado.body.datos;
    const secreto = Buffer.from(datos.secreto, 'base64url');
    const [reloj] = await grupoConexiones.query('SELECT CURRENT_TIMESTAMP(3) AS ahora');
    const paso = Math.floor(reloj.ahora.getTime() / 15000);
    const otp = calcularOtpOffline(secreto, datos.dispositivo_id, paso);
    const firma = firmarPasoOffline(secreto, datos.dispositivo_id, paso);
    const codigo = `upt_offline_v2.${datos.dispositivo_id}.${paso}.${otp}.${firma}`;
    await validar(codigo, 'ACCESO_AUTORIZADO');
    await validar(codigo, 'CREDENCIAL_YA_UTILIZADA');
    const firmaAlterada = `${firma[0] === 'A' ? 'B' : 'A'}${firma.slice(1)}`;
    await validar(`upt_offline_v2.${datos.dispositivo_id}.${paso}.${otp}.${firmaAlterada}`, 'INTEGRIDAD_CREDENCIAL_INVALIDA');
    await grupoConexiones.query("UPDATE dispositivos SET estado = 'REVOCADO' WHERE id = ?", [datos.dispositivo_id]);
    await validar(codigo, 'DISPOSITIVO_NO_VINCULADO');
    const notificaciones = (await listar('offline')).body.datos;
    assert.equal(notificaciones.length, 6);
    assert.deepEqual(new Set(notificaciones.filter(({ tipo }) => tipo === 'INTENTO_SOSPECHOSO').map(({ evento }) => evento)),
      new Set(['CREDENCIAL_YA_UTILIZADA', 'INTEGRIDAD_CREDENCIAL_INVALIDA', 'DISPOSITIVO_NO_VINCULADO']));
  });

  it('mantiene la atomicidad y no duplica notificaciones al repetir el mismo evento', async () => {
    const conexion = await grupoConexiones.getConnection();
    let registroId;
    try {
      await conexion.beginTransaction();
      const registro = await conexion.query(
        `INSERT INTO registros_acceso (usuario_id, punto_acceso_id, usuario_seguridad_id, resultado, motivo)
         VALUES (?, ?, ?, 'DENEGADO', 'CREDENCIAL_YA_UTILIZADA')`,
        [usuarios.get('vacio').id, puntoId, usuarios.get('seguridad').id],
      );
      registroId = registro.insertId;
      const datos = { usuarioId: usuarios.get('vacio').id, registroAccesoId: registroId, motivo: 'CREDENCIAL_YA_UTILIZADA' };
      await registrarNotificacionesDenegacion(conexion, datos);
      await registrarNotificacionesDenegacion(conexion, datos);
      const [cantidad] = await conexion.query('SELECT COUNT(*) AS total FROM notificaciones_usuario WHERE registro_acceso_id = ?', [registroId]);
      assert.equal(cantidad.total, 2);
      // Simula un fallo posterior: ni la decisión ni sus avisos deben persistir.
      await assert.rejects(conexion.query('INSERT INTO notificaciones_usuario (usuario_id) VALUES (?)', [datos.usuarioId]));
    } finally {
      await conexion.rollback();
      conexion.release();
    }
    const [avisos] = await grupoConexiones.query('SELECT COUNT(*) AS total FROM notificaciones_usuario WHERE registro_acceso_id = ?', [registroId]);
    const [registros] = await grupoConexiones.query('SELECT COUNT(*) AS total FROM registros_acceso WHERE id = ?', [registroId]);
    assert.equal(avisos.total, 0);
    assert.equal(registros.total, 0);
  });

  it('serializa validaciones simultáneas y genera un solo par de notificaciones', async () => {
    await crearUsuario('simultaneo');
    const codigo = await generarQr('simultaneo');
    const respuestas = await Promise.all([1, 2].map(() => como('seguridad', request(aplicacion).post('/api/ingresos/validar'))
      .send({ codigo_qr: codigo, punto_acceso_codigo: codigoPunto, ubicacion: ubicacion() }).expect(200)));
    assert.deepEqual(respuestas.map(({ body }) => body.datos.resultado).sort(), ['AUTORIZADO', 'DENEGADO']);
    assert.equal((await listar('simultaneo')).body.paginacion.total, 2);
  });

  it('restringe sesiones vencidas y cuentas bloqueadas', async () => {
    await crearUsuario('bloqueado');
    await grupoConexiones.query("UPDATE usuarios SET estado = 'BLOQUEADO' WHERE id = ?", [usuarios.get('bloqueado').id]);
    await como('bloqueado', request(aplicacion).get('/api/notificaciones')).expect(403);
    await crearUsuario('vencido');
    await grupoConexiones.query(
      `UPDATE sesiones SET creada_en = TIMESTAMPADD(HOUR, -1, CURRENT_TIMESTAMP(3)),
        expira_en = TIMESTAMPADD(MINUTE, -1, CURRENT_TIMESTAMP(3)) WHERE token_acceso_hash = ?`,
      [calcularHashToken(usuarios.get('vencido').token)],
    );
    await como('vencido', request(aplicacion).get('/api/notificaciones')).expect(401);
  });

  it('mantiene la migración repetible, la colación y la deduplicación por registro/tipo', async () => {
    assert.deepEqual(await ejecutarMigraciones({ grupoConexiones, registrar: () => {} }), []);
    const [tabla] = await grupoConexiones.query(
      "SELECT TABLE_COLLATION AS colacion FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notificaciones_usuario'",
    );
    assert.equal(tabla.colacion, 'utf8mb4_unicode_ci');
    const indices = await grupoConexiones.query("SHOW INDEX FROM notificaciones_usuario WHERE Key_name = 'uk_notificaciones_registro_tipo'");
    assert.deepEqual(indices.map(({ Column_name }) => Column_name), ['registro_acceso_id', 'tipo']);
    assert.ok(indices.every(({ Non_unique }) => Non_unique === 0));
  });
});
