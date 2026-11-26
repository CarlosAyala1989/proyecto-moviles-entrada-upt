import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash, createHmac } from 'node:crypto';
import { after, describe, it } from 'node:test';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones as db } from '../src/config/database.js';
import { RepositorioEliminacionCuenta } from '../src/modulos/cuenta/eliminacion.repositorio.js';
import { ServicioEliminacionCuenta } from '../src/modulos/cuenta/eliminacion.servicio.js';
import { depurarDatosEstudiantes } from '../src/modulos/cuenta/retencion.js';
import { calcularHashIdentificador } from '../src/seguridad/tokens.js';
import { RepositorioRegistroEstudianteMariaDb } from '../src/modulos/registro_estudiante/repositorios/repositorio_registro_estudiante_mariadb.js';

const hash = (valor) => createHash('sha256').update(valor).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const creados = [];
const solicitudes = [];
const repo = new RepositorioEliminacionCuenta();
const config = { clientId: 'cliente-prueba', clientSecret: 'secreto-prueba', redirectUri: 'https://api.upt.test/api/cuenta/eliminacion/google/callback', sitioPublico: 'https://portal.upt.test', dominio: 'virtual.upt.pe' };

async function usuario(roles = ['ESTUDIANTE'], identidad = {}) {
  const sufijo = randomBytes(6).toString('hex');
  const datos = { codigo: `ZZ-PRIV-${sufijo}`, correo: `zz${sufijo}@virtual.upt.pe`, sub: `sub-${sufijo}`, ...identidad };
  const insercion = await db.query(
    `INSERT INTO usuarios (codigo_institucional, correo_institucional, google_sub, nombres, apellidos, estado, estado_autorizacion)
     VALUES (?, ?, ?, 'PRUEBA', 'PRIVACIDAD', 'ACTIVO', 'AUTORIZADO')`, [datos.codigo, datos.correo, datos.sub],
  );
  datos.id = insercion.insertId;
  creados.push(datos.id);
  for (const rol of roles) await db.query('INSERT INTO usuarios_roles (usuario_id, rol_id) SELECT ?, id FROM roles WHERE nombre = ?', [datos.id, rol]);
  return datos;
}

function entornoPrueba(cuenta, { repositorio = repo, transformar = (datos) => datos } = {}) {
  let opciones;
  let intercambios = 0;
  const oauth = {
      generateAuthUrl: (valor) => { opciones = valor; return `https://accounts.google.com/o/oauth2/v2/auth?state=${valor.state}`; },
      getToken: async ({ codeVerifier }) => {
        assert.equal(createHash('sha256').update(codeVerifier).digest('base64url'), opciones.code_challenge);
        intercambios++;
        return { tokens: { id_token: 'identidad-de-prueba' } };
      },
      verifyIdToken: async ({ audience }) => {
        assert.equal(audience, config.clientId);
        return { getPayload: () => transformar({ sub: cuenta.sub, email: cuenta.correo, email_verified: true, hd: 'virtual.upt.pe', nonce: opciones.nonce }) };
      },
  };
  const servicio = new ServicioEliminacionCuenta({ repositorio, configuracion: config, oauth });
  return { servicio, oauth, app: crearAplicacion({ servicioEliminacion: servicio }), state: () => opciones.state, intercambios: () => intercambios };
}

async function iniciar(prueba) {
  const verificador = token();
  const respuesta = await request(prueba.app).post('/api/cuenta/eliminacion/iniciar').send({ verificador }).expect(201);
  const id = respuesta.body.datos.id;
  solicitudes.push(id);
  return { id, verificador };
}

async function autenticar(prueba) {
  await request(prueba.app).get('/api/cuenta/eliminacion/google/callback').query({ state: prueba.state(), code: 'codigo-prueba' }).expect(303).expect('Location', 'https://portal.upt.test/eliminar-cuenta');
}

async function fixture() {
  const guardia = await usuario(['SEGURIDAD']);
  const cuenta = await usuario();
  const [punto] = await db.query('SELECT id FROM puntos_acceso LIMIT 1');
  const acceso = token();
  const renovacion = token();
  const dispositivo = await db.query("INSERT INTO dispositivos (usuario_id, identificador_hash, plataforma, secreto_qr_cifrado) VALUES (?, ?, 'IOS', 'secreto-cifrado-prueba')", [cuenta.id, hash(token())]);
  const sesion = await db.query(
    `INSERT INTO sesiones (usuario_id, dispositivo_id, token_acceso_hash, token_renovacion_hash, expira_en, token_renovacion_expira_en)
     VALUES (?, ?, ?, ?, TIMESTAMPADD(MINUTE, 15, CURRENT_TIMESTAMP(3)), TIMESTAMPADD(DAY, 7, CURRENT_TIMESTAMP(3)))`,
    [cuenta.id, dispositivo.insertId, hash(acceso), hash(renovacion)],
  );
  const credencial = await db.query(
    `INSERT INTO credenciales_acceso (usuario_id, sesion_id, dispositivo_id, token_hash, otp_hash, nonce_hash, expira_en, latitud_emision, longitud_emision)
     VALUES (?, ?, ?, ?, ?, ?, TIMESTAMPADD(SECOND, 15, CURRENT_TIMESTAMP(3)), -18.013, -70.251)`,
    [cuenta.id, sesion.insertId, dispositivo.insertId, hash(token()), hash(token()), hash(token())],
  );
  const registro = await db.query(
    "INSERT INTO registros_acceso (usuario_id, credencial_id, punto_acceso_id, usuario_seguridad_id, resultado, motivo) VALUES (?, ?, ?, ?, 'DENEGADO', 'PRUEBA')",
    [cuenta.id, credencial.insertId, punto.id, guardia.id],
  );
  const incidencia = await db.query(
    "INSERT INTO incidencias_seguridad (registro_acceso_id, responsable_id, tipo, observacion, clave_idempotencia) VALUES (?, ?, 'OTRA', 'Datos de prueba del estudiante', ?)", [registro.insertId, guardia.id, randomUUID()],
  );
  await db.query("INSERT INTO notificaciones_usuario (usuario_id, registro_acceso_id, tipo, evento, titulo, mensaje, causa_general, canal_soporte) VALUES (?, ?, 'DENEGACION_ACCESO', 'PRUEBA', 'Prueba', 'Prueba', 'Prueba', 'Prueba')", [cuenta.id, registro.insertId]);
  await db.query("INSERT INTO usos_codigos_offline (dispositivo_id, paso_tiempo, punto_acceso_id) VALUES (?, 1, ?)", [dispositivo.insertId, punto.id]);
  await db.query("INSERT INTO perfiles_academicos (usuario_id, escuela) VALUES (?, 'ESCUELA PRUEBA')", [cuenta.id]);
  await db.query("INSERT INTO bloqueos_identidad (usuario_id, motivo, creado_por) VALUES (?, 'Prueba', ?)", [cuenta.id, guardia.id]);
  await db.query("INSERT INTO intentos_inicio_sesion (usuario_id, identificador_hash, exitoso, motivo) VALUES (NULL, ?, FALSE, 'PRUEBA')", [calcularHashIdentificador(cuenta.correo)]);
  await db.query("INSERT INTO registros_auditoria (usuario_actor_id, accion, entidad, entidad_id, detalle) VALUES (?, 'PRUEBA', 'USUARIO', ?, ?), (?, 'PRUEBA', 'INCIDENCIA', ?, '{}'), (?, 'PRUEBA', 'USUARIO', ?, '{}')", [guardia.id, String(cuenta.id), JSON.stringify({ correo: cuenta.correo }), guardia.id, String(incidencia.insertId), guardia.id, String(guardia.id)]);
  return { cuenta, guardia, acceso, renovacion, registroId: registro.insertId, credencialId: credencial.insertId, dispositivoId: dispositivo.insertId };
}

after(async () => {
  for (const id of solicitudes) await db.query('DELETE FROM solicitudes_eliminacion_cuenta WHERE id = ?', [id]);
  for (const id of [...creados].reverse()) {
    const [fila] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (fila) await repo.borrarDatos(db, fila);
  }
  await db.end();
});

describe('Eliminación real de cuenta de estudiante', () => {
  it('exige Google y prueba del navegador; borra todos los datos de la cuenta y conserva otros usuarios', async () => {
    const datos = await fixture();
    const prueba = entornoPrueba(datos.cuenta);
    const credencial = await iniciar(prueba);
    await request(prueba.app).post('/api/cuenta/eliminacion/confirmar').send({ ...credencial, confirmacion: 'ELIMINAR' }).expect(403);
    await autenticar(prueba);
    const estado = await request(prueba.app).post('/api/cuenta/eliminacion/estado').send(credencial).expect(200);
    assert.equal(estado.body.datos.cuenta.correo, datos.cuenta.correo);
    assert.equal((await db.query('SELECT id FROM usuarios WHERE id = ?', [datos.cuenta.id])).length, 1);
    await request(prueba.app).post('/api/cuenta/eliminacion/confirmar').send({ ...credencial, verificador: token(), confirmacion: 'ELIMINAR' }).expect(410);
    await request(prueba.app).post('/api/cuenta/eliminacion/confirmar').send({ ...credencial, confirmacion: 'ELIMINAR', usuario_id: datos.guardia.id }).expect(400);
    await request(prueba.app).post('/api/cuenta/eliminacion/confirmar').send({ ...credencial, confirmacion: 'ELIMINAR' }).expect(200);
    for (const tabla of ['usuarios', 'perfiles_academicos', 'sesiones', 'dispositivos', 'credenciales_acceso', 'registros_acceso', 'notificaciones_usuario', 'usuarios_roles', 'bloqueos_identidad']) {
      const columna = tabla === 'usuarios' ? 'id' : 'usuario_id';
      assert.equal((await db.query(`SELECT COUNT(*) AS total FROM ${tabla} WHERE ${columna} = ?`, [datos.cuenta.id]))[0].total, 0, tabla);
    }
    assert.equal((await db.query('SELECT COUNT(*) AS total FROM incidencias_seguridad WHERE registro_acceso_id = ?', [datos.registroId]))[0].total, 0);
    assert.equal((await db.query('SELECT COUNT(*) AS total FROM usos_codigos_offline WHERE dispositivo_id = ?', [datos.dispositivoId]))[0].total, 0);
    assert.equal((await db.query('SELECT COUNT(*) AS total FROM intentos_inicio_sesion WHERE identificador_hash = ?', [calcularHashIdentificador(datos.cuenta.correo)]))[0].total, 0);
    assert.equal((await db.query("SELECT COUNT(*) AS total FROM registros_auditoria WHERE entidad = 'USUARIO' AND entidad_id = ?", [String(datos.cuenta.id)]))[0].total, 0);
    assert.equal((await db.query('SELECT id FROM usuarios WHERE id = ?', [datos.guardia.id])).length, 1);
    await request(prueba.app).get('/api/autenticacion/sesion').set('Authorization', `Bearer ${datos.acceso}`).expect(401);
    await request(prueba.app).post('/api/autenticacion/renovar-sesion').send({ token_renovacion: datos.renovacion }).expect(401);
    const comprobante = await request(prueba.app).post('/api/cuenta/eliminacion/estado').send(credencial).expect(200);
    assert.equal(comprobante.body.datos.estado, 'COMPLETADA');
    assert.ok(!JSON.stringify(comprobante.body).includes(datos.cuenta.correo));
    const nueva = await usuario(['ESTUDIANTE'], datos.cuenta);
    await request(prueba.app).post('/api/cuenta/eliminacion/confirmar').send({ ...credencial, confirmacion: 'ELIMINAR' }).expect(200);
    assert.equal((await db.query('SELECT id FROM usuarios WHERE id = ?', [nueva.id])).length, 1, 'un reintento no elimina una cuenta creada después');
  });

  it('rechaza nonce, dominio, correo no verificado e identidades no vinculadas sin crear cuentas', async () => {
    const cuenta = await usuario();
    for (const transformar of [
      (datos) => ({ ...datos, nonce: 'otro-nonce' }),
      (datos) => ({ ...datos, hd: 'otro.pe' }),
      (datos) => ({ ...datos, email_verified: false }),
      (datos) => ({ ...datos, sub: 'sub-no-registrado' }),
    ]) {
      const prueba = entornoPrueba(cuenta, { transformar });
      const credencial = await iniciar(prueba);
      await autenticar(prueba);
      const estado = await request(prueba.app).post('/api/cuenta/eliminacion/estado').send(credencial).expect(200);
      assert.equal(estado.body.datos.estado, 'ERROR');
      await request(prueba.app).post('/api/cuenta/eliminacion/confirmar').send({ ...credencial, confirmacion: 'ELIMINAR' }).expect(403);
    }
    assert.equal((await db.query('SELECT id FROM usuarios WHERE google_sub = ?', ['sub-no-registrado'])).length, 0);
  });

  it('callback de un solo uso, cancelación y vencimiento no permiten borrar', async () => {
    const prueba = entornoPrueba(await usuario());
    const credencial = await iniciar(prueba);
    await autenticar(prueba);
    await autenticar(prueba);
    assert.equal(prueba.intercambios(), 1);
    await request(prueba.app).post('/api/cuenta/eliminacion/cancelar').send(credencial).expect(200);
    await request(prueba.app).post('/api/cuenta/eliminacion/confirmar').send({ ...credencial, confirmacion: 'ELIMINAR' }).expect(410);
    const vencida = await iniciar(prueba);
    await db.query('UPDATE solicitudes_eliminacion_cuenta SET expira_en = TIMESTAMPADD(SECOND, -1, CURRENT_TIMESTAMP(3)) WHERE id = ?', [vencida.id]);
    await request(prueba.app).post('/api/cuenta/eliminacion/estado').send(vencida).expect(410);
    await repo.limpiarExpiradas();
    assert.equal((await db.query('SELECT id FROM solicitudes_eliminacion_cuenta WHERE id = ?', [vencida.id])).length, 0);
  });

  it('no borra identidades de seguridad o administración desde el portal de estudiante', async () => {
    const cuenta = await usuario(['ESTUDIANTE', 'SEGURIDAD']);
    const prueba = entornoPrueba(cuenta);
    const credencial = await iniciar(prueba);
    await autenticar(prueba);
    const estado = await request(prueba.app).post('/api/cuenta/eliminacion/estado').send(credencial).expect(200);
    assert.equal(estado.body.datos.codigo, 'CUENTA_INSTITUCIONAL_COMPARTIDA');
    assert.equal((await db.query('SELECT id FROM usuarios WHERE id = ?', [cuenta.id])).length, 1);
  });

  it('un fallo durante el borrado revierte toda la transacción', async () => {
    const datos = await fixture();
    class RepositorioFallido extends RepositorioEliminacionCuenta {
      async borrarDatos(conexion, cuenta) { await super.borrarDatos(conexion, cuenta); throw new Error('fallo simulado'); }
    }
    const prueba = entornoPrueba(datos.cuenta, { repositorio: new RepositorioFallido() });
    const credencial = await iniciar(prueba);
    await autenticar(prueba);
    await assert.rejects(prueba.servicio.confirmar(credencial), /fallo simulado/);
    assert.equal((await db.query('SELECT id FROM usuarios WHERE id = ?', [datos.cuenta.id])).length, 1);
    assert.equal((await db.query('SELECT id FROM registros_acceso WHERE id = ?', [datos.registroId])).length, 1);
    const estado = await prueba.servicio.consultar(credencial);
    assert.equal(estado.estado, 'LISTA');
  });

  it('la política de 30 días retira el historial antiguo de estudiante y conserva datos actuales y del guardia', async () => {
    const datos = await fixture();
    await db.query('UPDATE registros_acceso SET registrado_en = TIMESTAMPADD(DAY, -31, CURRENT_TIMESTAMP(3)) WHERE id = ?', [datos.registroId]);
    await db.query("UPDATE credenciales_acceso SET estado = 'EXPIRADA', emitida_en = TIMESTAMPADD(DAY, -31, CURRENT_TIMESTAMP(3)), expira_en = TIMESTAMPADD(DAY, -30, CURRENT_TIMESTAMP(3)) WHERE id = ?", [datos.credencialId]);
    await db.query("UPDATE sesiones SET creada_en = TIMESTAMPADD(DAY, -31, CURRENT_TIMESTAMP(3)), direccion_ip = '192.0.2.1', agente_usuario = 'dato-antiguo' WHERE usuario_id = ?", [datos.cuenta.id]);
    const [punto] = await db.query('SELECT id FROM puntos_acceso LIMIT 1');
    const reciente = await db.query("INSERT INTO registros_acceso (usuario_id, punto_acceso_id, usuario_seguridad_id, resultado, motivo) VALUES (?, ?, ?, 'AUTORIZADO', 'PRUEBA')", [datos.cuenta.id, punto.id, datos.guardia.id]);
    const ajeno = await db.query("INSERT INTO registros_acceso (usuario_id, punto_acceso_id, usuario_seguridad_id, resultado, motivo, registrado_en) VALUES (?, ?, ?, 'AUTORIZADO', 'PRUEBA', TIMESTAMPADD(DAY, -31, CURRENT_TIMESTAMP(3)))", [datos.guardia.id, punto.id, datos.guardia.id]);
    await depurarDatosEstudiantes();
    assert.equal((await db.query('SELECT id FROM registros_acceso WHERE id = ?', [datos.registroId])).length, 0);
    assert.equal((await db.query('SELECT id FROM registros_acceso WHERE id IN (?, ?)', [reciente.insertId, ajeno.insertId])).length, 2);
    assert.equal((await db.query('SELECT id FROM incidencias_seguridad WHERE registro_acceso_id = ?', [datos.registroId])).length, 0);
    assert.equal((await db.query('SELECT id FROM usuarios WHERE id = ?', [datos.cuenta.id])).length, 1);
    assert.equal((await db.query('SELECT id FROM credenciales_acceso WHERE id = ?', [datos.credencialId])).length, 0);
    const [sesion] = await db.query('SELECT direccion_ip, agente_usuario FROM sesiones WHERE usuario_id = ?', [datos.cuenta.id]);
    assert.equal(sesion.direccion_ip, null);
    assert.equal(sesion.agente_usuario, null);
  });

  it('el sub estable permite eliminar aunque el correo de Google haya cambiado', async () => {
    const cuenta = await usuario();
    const prueba = entornoPrueba(cuenta, { transformar: (datos) => ({ ...datos, email: 'correo-nuevo@virtual.upt.pe' }) });
    const credencial = await iniciar(prueba);
    await autenticar(prueba);
    await request(prueba.app).post('/api/cuenta/eliminacion/confirmar').send({ ...credencial, confirmacion: 'ELIMINAR' }).expect(200);
    assert.equal((await db.query('SELECT id FROM usuarios WHERE id = ?', [cuenta.id])).length, 0);
  });

  it('otra instancia puede completar la verificación iniciada antes de un reinicio', async () => {
    const cuenta = await usuario();
    const prueba = entornoPrueba(cuenta);
    const credencial = await iniciar(prueba);
    const segunda = new ServicioEliminacionCuenta({ repositorio: new RepositorioEliminacionCuenta(), configuracion: config, oauth: prueba.oauth });
    await segunda.procesarRetorno({ state: prueba.state(), code: 'codigo-prueba' });
    assert.equal((await segunda.consultar(credencial)).estado, 'LISTA');
  });

  it('sin configuración del portal falla solo el flujo nuevo y no cambia las rutas existentes', async () => {
    const app = crearAplicacion({ configuracionEliminacion: {} });
    await request(app).post('/api/cuenta/eliminacion/iniciar').send({ verificador: token() }).expect(503);
    await request(app).get('/api').expect(200);
    await request(app).get('/api/autenticacion/sesion').expect(401);
  });

  it('borrar una cuenta bloqueada conserva solo la restricción protegida y no permite reingresar por registro', async () => {
    const cuenta = await usuario();
    await db.query("UPDATE usuarios SET estado = 'BLOQUEADO', estado_autorizacion = 'DENEGADO' WHERE id = ?", [cuenta.id]);
    const prueba = entornoPrueba(cuenta);
    const credencial = await iniciar(prueba);
    await autenticar(prueba);
    await request(prueba.app).post('/api/cuenta/eliminacion/confirmar').send({ ...credencial, confirmacion: 'ELIMINAR' }).expect(200);
    assert.equal((await db.query('SELECT id FROM usuarios WHERE id = ?', [cuenta.id])).length, 0);
    const identidadHash = createHmac('sha256', Buffer.from(process.env.CLAVE_RESTRICCIONES_IDENTIDAD, 'base64url')).update(`upt:restriccion:codigo:${cuenta.codigo.toUpperCase()}`).digest('hex');
    const [retenida] = await db.query('SELECT * FROM restricciones_identidad_eliminada WHERE identidad_hash = ?', [identidadHash]);
    assert.ok(retenida);
    for (const dato of [cuenta.codigo, cuenta.correo, cuenta.sub, 'PRIVACIDAD']) assert.ok(!JSON.stringify(retenida).includes(dato));
    assert.ok(retenida.expira_en <= new Date(Date.now() + 30 * 86400000 + 2000));
    const datosRegistro = { codigo: cuenta.codigo, correoInstitucional: cuenta.correo, googleSub: cuenta.sub, nombres: 'PRUEBA', apellidos: 'PRIVACIDAD', nombreGoogle: 'PRUEBA PRIVACIDAD', nombreIntranet: 'PRIVACIDAD, PRUEBA', fotoUrl: null, escuelaProfesional: null };
    const registro = new RepositorioRegistroEstudianteMariaDb();
    await assert.rejects(registro.registrarIdentidadVerificada(datosRegistro), (error) => error.codigo === 'RESTRICCION_INSTITUCIONAL_VIGENTE');
    assert.equal((await db.query('SELECT id FROM usuarios WHERE codigo_institucional = ?', [cuenta.codigo])).length, 0);
    const claveAnterior = process.env.CLAVE_RESTRICCIONES_IDENTIDAD;
    try {
      process.env.CLAVE_RESTRICCIONES_IDENTIDAD = token();
      await assert.rejects(registro.registrarIdentidadVerificada(datosRegistro), (error) => error.codigo === 'RESTRICCIONES_NO_CONFIGURADAS');
    } finally { process.env.CLAVE_RESTRICCIONES_IDENTIDAD = claveAnterior; }
    await db.query('UPDATE restricciones_identidad_eliminada SET expira_en = TIMESTAMPADD(SECOND, -1, CURRENT_TIMESTAMP(3)) WHERE identidad_hash = ?', [identidadHash]);
    const nueva = await registro.registrarIdentidadVerificada(datosRegistro);
    creados.push(nueva.id);
    assert.notEqual(nueva.id, cuenta.id);
    await depurarDatosEstudiantes();
    assert.equal((await db.query('SELECT identidad_hash FROM restricciones_identidad_eliminada WHERE identidad_hash = ?', [identidadHash])).length, 0);
  });

  it('una restricción temporal no se extiende más allá de su vencimiento anterior', async () => {
    const cuenta = await usuario();
    const guardia = await usuario(['SEGURIDAD']);
    await db.query("INSERT INTO bloqueos_identidad (usuario_id, motivo, creado_por, vigente_hasta) VALUES (?, 'Prueba temporal', ?, TIMESTAMPADD(HOUR, 1, CURRENT_TIMESTAMP(3)))", [cuenta.id, guardia.id]);
    const prueba = entornoPrueba(cuenta);
    const credencial = await iniciar(prueba);
    await autenticar(prueba);
    await request(prueba.app).post('/api/cuenta/eliminacion/confirmar').send({ ...credencial, confirmacion: 'ELIMINAR' }).expect(200);
    const identidadHash = createHmac('sha256', Buffer.from(process.env.CLAVE_RESTRICCIONES_IDENTIDAD, 'base64url')).update(`upt:restriccion:codigo:${cuenta.codigo.toUpperCase()}`).digest('hex');
    const [fila] = await db.query('SELECT TIMESTAMPDIFF(SECOND, CURRENT_TIMESTAMP(3), expira_en) AS segundos FROM restricciones_identidad_eliminada WHERE identidad_hash = ?', [identidadHash]);
    assert.ok(fila.segundos > 0 && fila.segundos <= 3600);
  });
});
