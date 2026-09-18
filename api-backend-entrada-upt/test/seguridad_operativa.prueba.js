import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

const app = crearAplicacion({ entornoEjecucion: 'test' });
const sufijo = randomBytes(4).toString('hex').toUpperCase();
const usuarioAdmin = `PRUEBA-GEO-ADMIN-${sufijo}`;
const usuarioGuardia = `PRUEBA-GEO-GUARD-${sufijo}`;
const contrasena = 'Prueba-Geografica!2026';
let adminId;
let guardiaId;
let puertaId;
let tokenAdmin;
let tokenGuardia;
const guardia = { usuario: usuarioGuardia, nombres: 'Juan Pedro', apellidos: 'Pérez Torres', contrasena, activo: true };
const ubicacion = (latitud = 1) => ({ latitud, longitud: 1, precision_metros: 5, obtenida_en: new Date().toISOString() });
const comoAdmin = (consulta) => consulta.set('authorization', `Bearer ${tokenAdmin}`);
const comoGuardia = (consulta) => consulta.set('authorization', `Bearer ${tokenGuardia}`);
async function login(usuario) {
  const respuesta = await request(app).post('/api/autenticacion/iniciar-sesion').send({ identificador: usuario, contrasena }).expect(201);
  return respuesta.body.datos.token_acceso;
}

before(async () => {
  const hash = await bcrypt.hash(contrasena, 12);
  const admin = await grupoConexiones.query(`INSERT INTO usuarios (codigo_institucional, correo_institucional, nombres, apellidos, contrasena_hash, estado, estado_autorizacion, identidad_verificada, identidad_verificada_en) VALUES (?, ?, 'Admin', 'Prueba', ?, 'ACTIVO', 'AUTORIZADO', TRUE, CURRENT_TIMESTAMP(3))`, [usuarioAdmin, `${usuarioAdmin}@example.invalid`, hash]);
  adminId = admin.insertId;
  await grupoConexiones.query("INSERT INTO usuarios_roles (usuario_id, rol_id) SELECT ?, id FROM roles WHERE nombre = 'ADMINISTRADOR'", [adminId]);
  tokenAdmin = await login(usuarioAdmin);
  const puerta = await comoAdmin(request(app).post('/api/administracion/puntos-acceso')).send({ codigo: `PRUEBA-GEO-${sufijo}`, nombre: 'Puerta geográfica de prueba', latitud: 1, longitud: 1, radio_permitido_metros: 100 }).expect(201);
  puertaId = puerta.body.datos.id;
  const creada = await comoAdmin(request(app).post('/api/administracion/guardias')).send({ ...guardia, punto_acceso_id: puertaId }).expect(201);
  guardiaId = creada.body.datos.id;
  tokenGuardia = await login(usuarioGuardia);
});

after(async () => {
  const ids = [adminId, guardiaId].filter(Boolean);
  if (ids.length) {
    const marcas = ids.map(() => '?').join(',');
    await grupoConexiones.query(`DELETE FROM asignaciones_seguridad WHERE usuario_id IN (${marcas}) OR asignado_por IN (${marcas})`, [...ids, ...ids]);
    await grupoConexiones.query(`DELETE FROM registros_auditoria WHERE usuario_actor_id IN (${marcas})`, ids);
    await grupoConexiones.query(`DELETE FROM sesiones WHERE usuario_id IN (${marcas})`, ids);
    await grupoConexiones.query(`DELETE FROM intentos_inicio_sesion WHERE usuario_id IN (${marcas})`, ids);
    await grupoConexiones.query(`DELETE FROM usuarios_roles WHERE usuario_id IN (${marcas}) OR asignado_por IN (${marcas})`, [...ids, ...ids]);
    await grupoConexiones.query(`DELETE FROM usuarios WHERE id IN (${marcas})`, ids);
  }
  if (puertaId) await grupoConexiones.query('DELETE FROM puntos_acceso WHERE id = ?', [puertaId]);
  await grupoConexiones.end();
});

describe('Administración y zona de operación de seguridad', () => {
  it('permite administrar sin GPS y prohíbe al guardia administrar', async () => {
    const lista = await comoAdmin(request(app).get('/api/administracion/guardias')).expect(200);
    const fila = lista.body.datos.find((g) => g.id === guardiaId);
    assert.equal(fila.punto_acceso_id, puertaId);
    assert.equal(fila.nombres, guardia.nombres);
    assert.doesNotMatch(JSON.stringify(lista.body), /contrasena|hash/iu);
    await comoGuardia(request(app).get('/api/administracion/guardias')).expect(403);
    await comoAdmin(request(app).get('/api/administracion/puntos-acceso')).expect(200);
    await comoAdmin(request(app).put(`/api/administracion/guardias/${adminId}`)).send({ ...guardia, punto_acceso_id: puertaId }).expect(404);
  });
  it('habilita cerca de la puerta y bloquea fuera de zona tanto escaneo como historial', async () => {
    const dentro = await comoGuardia(request(app).post('/api/seguridad/comprobar-ubicacion')).send({ ubicacion: ubicacion() }).expect(200);
    assert.equal(dentro.body.datos.habilitado, true);
    assert.equal(dentro.body.datos.punto_acceso.id, puertaId);
    const fuera = await comoGuardia(request(app).post('/api/seguridad/comprobar-ubicacion')).send({ ubicacion: ubicacion(2) }).expect(403);
    assert.equal(fuera.body.error.codigo, 'SEGURIDAD_FUERA_DE_ZONA');
    await comoGuardia(request(app).post('/api/ingresos/validar')).send({ codigo_qr: 'dato-no-validado', punto_acceso_codigo: `PRUEBA-GEO-${sufijo}`, ubicacion: ubicacion(2) }).expect(403);
    await comoGuardia(request(app).get('/api/ingresos/recientes')).query(ubicacion(2)).expect(403);
    await comoGuardia(request(app).get('/api/ingresos/recientes')).query(ubicacion()).expect(200);
    await comoGuardia(request(app).get('/api/ingresos/recientes')).expect(400);
  });
  it('rechaza otra puerta, GPS antiguo y precisión que cruza el límite del radio', async () => {
    const otra = await comoGuardia(request(app).post('/api/ingresos/validar')).send({ codigo_qr: 'dato-no-validado', punto_acceso_codigo: 'OTRA-PUERTA', ubicacion: ubicacion() }).expect(403);
    assert.equal(otra.body.error.codigo, 'SEGURIDAD_PUNTO_NO_ASIGNADO');
    await comoGuardia(request(app).post('/api/seguridad/comprobar-ubicacion')).send({ ubicacion: { ...ubicacion(), obtenida_en: new Date(Date.now() - 180000).toISOString() } }).expect(422);
    await comoGuardia(request(app).post('/api/seguridad/comprobar-ubicacion')).send({ ubicacion: { ...ubicacion(1.0009), precision_metros: 10 } }).expect(403);
  });
  it('bloquea una puerta inactiva y un guardia sin asignación', async () => {
    await comoAdmin(request(app).patch(`/api/administracion/puntos-acceso/${puertaId}`)).send({ estado: 'INACTIVO' }).expect(200);
    await comoGuardia(request(app).post('/api/seguridad/comprobar-ubicacion')).send({ ubicacion: ubicacion() }).expect(403);
    await comoAdmin(request(app).patch(`/api/administracion/puntos-acceso/${puertaId}`)).send({ estado: 'ACTIVO' }).expect(200);
    await grupoConexiones.query('DELETE FROM asignaciones_seguridad WHERE usuario_id = ?', [guardiaId]);
    const sinPuerta = await comoGuardia(request(app).post('/api/seguridad/comprobar-ubicacion')).send({ ubicacion: ubicacion() }).expect(403);
    assert.equal(sinPuerta.body.error.codigo, 'SEGURIDAD_SIN_ASIGNACION');
    await comoAdmin(request(app).put(`/api/administracion/guardias/${guardiaId}`)).send({ ...guardia, punto_acceso_id: puertaId, nombres: 'Juan actualizado' }).expect(200);
    await comoGuardia(request(app).post('/api/seguridad/comprobar-ubicacion')).send({ ubicacion: ubicacion() }).expect(401);
    tokenGuardia = await login(usuarioGuardia);
    await comoGuardia(request(app).post('/api/seguridad/comprobar-ubicacion')).send({ ubicacion: ubicacion() }).expect(200);
  });
  it('rechaza puertas inexistentes sin crear usuarios y no acepta roles enviados por el cliente', async () => {
    await comoAdmin(request(app).post('/api/administracion/guardias')).send({ ...guardia, usuario: `INVALIDO-${sufijo}`, punto_acceso_id: 99999999 }).expect(400);
    const [conteo] = await grupoConexiones.query('SELECT COUNT(*) AS total FROM usuarios WHERE codigo_institucional = ?', [`INVALIDO-${sufijo}`]);
    assert.equal(conteo.total, 0);
    await comoAdmin(request(app).post('/api/administracion/guardias')).send({ ...guardia, punto_acceso_id: puertaId, roles: ['ADMINISTRADOR'] }).expect(400);
  });
});
