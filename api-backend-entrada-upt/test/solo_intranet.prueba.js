import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { ServicioIntranetUpt } from '../src/modulos/registro_estudiante/servicios/intranet_upt.servicio.js';
import { RepositorioEliminacionCuenta } from '../src/modulos/cuenta/eliminacion.repositorio.js';
import { grupoConexiones as db } from '../src/config/database.js';
import { ErrorHttp } from '../src/middleware/manejo_errores.js';

const codigos = [];
const solicitudes = [];
const intranet = new ServicioIntranetUpt({ crearSesionFn: async () => ({
  cargarCaptcha: async () => Buffer.from('captcha-de-prueba'),
  verificar: async ({ codigo, contrasena, captcha }) => {
    if (contrasena !== '123456' || captcha !== '12345') throw new ErrorHttp({ codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Credenciales o CAPTCHA incorrectos.', estadoHttp: 401 });
    return { codigo, nombre_apellidos: 'PRUEBA INTRANET, ESTUDIANTE', escuela_profesional: 'Ingeniería de Sistemas' };
  },
  cerrar: async () => {},
}) });
const app = crearAplicacion({ servicioIntranet: intranet });
const repo = new RepositorioEliminacionCuenta();
const codigoNuevo = () => { const codigo = String(9000000000 + (Number.parseInt(randomBytes(4).toString('hex'), 16) % 1000000000)); codigos.push(codigo); return codigo; };
async function credenciales(codigo, eliminacion = false) {
  const r = eliminacion
    ? await request(app).post('/api/cuenta/eliminacion/intranet/captcha').send({}).expect(200)
    : await request(app).get('/api/registro-estudiante/intranet/captcha').expect(200);
  return { transaccion_id: r.body.datos.transaccion_id, codigo, contrasena: '123456', captcha: '12345' };
}
async function login(codigo, estado = 200) {
  return request(app).post('/api/registro-estudiante/intranet/verificar').send(await credenciales(codigo)).expect(estado);
}
async function prepararBorrado(codigo, estado = 201) {
  const verificador = randomBytes(32).toString('base64url');
  const r = await request(app).post('/api/cuenta/eliminacion/intranet/verificar').send({ ...await credenciales(codigo, true), verificador }).expect(estado);
  if (r.body.datos?.id) solicitudes.push(r.body.datos.id);
  return { id: r.body.datos?.id, verificador };
}

describe('Variante sin Google: intranet, sesiones y eliminación', () => {
  it('inicia sesión y consulta identidad sin correo inventado ni vínculo Google', async () => {
    const codigo = codigoNuevo();
    const r = await login(codigo);
    const s = r.body.datos.sesion;
    assert.deepEqual(s.usuario.roles, ['ESTUDIANTE']);
    assert.equal(s.usuario.correo_institucional, '');
    const [fila] = await db.query('SELECT google_sub, correo_institucional FROM usuarios WHERE id = ?', [s.usuario.id]);
    assert.equal(fila.google_sub, null);
    assert.equal(fila.correo_institucional, null);
    const perfil = await request(app).get('/api/identidad-digital').auth(s.token_acceso, { type: 'bearer' }).expect(200);
    assert.equal(perfil.body.datos.verificacion.estado, 'VERIFICADA');
    assert.equal(perfil.body.datos.preparacion_codigo_qr.puede_solicitar, true);
    await assert.rejects(intranet.obtenerVerificacion(r.body.datos.verificacion_intranet_id), (e) => e.codigo === 'VERIFICACION_INTRANET_EXPIRADA');
    await request(app).post('/api/registro-estudiante/google/iniciar').send({}).expect(404);
    await request(app).get('/api/cuenta/eliminacion/google/callback').expect(404);
  });

  it('rechaza credenciales erróneas y CAPTCHA reutilizado sin crear cuenta', async () => {
    const codigo = codigoNuevo();
    const datos = await credenciales(codigo);
    await request(app).post('/api/registro-estudiante/intranet/verificar').send({ ...datos, contrasena: '999999' }).expect(401);
    await request(app).post('/api/registro-estudiante/intranet/verificar').send(datos).expect(410);
    const [n] = await db.query('SELECT COUNT(*) AS total FROM usuarios WHERE codigo_institucional = ?', [codigo]);
    assert.equal(n.total, 0);
  });

  it('genera y valida QR global sin GPS, manteniendo el uso único y la autorización', async () => {
    const codigo = codigoNuevo();
    const acceso = (await login(codigo)).body.datos.sesion;
    const operador = (await login(codigoNuevo())).body.datos.sesion;
    await db.query("INSERT INTO usuarios_roles (usuario_id, rol_id) SELECT ?, id FROM roles WHERE nombre = 'SEGURIDAD'", [operador.usuario.id]);
    await db.query("INSERT INTO asignaciones_seguridad (usuario_id, punto_acceso_id, asignado_por) SELECT ?, id, ? FROM puntos_acceso WHERE codigo = 'PRUEBA-LOCAL'", [operador.usuario.id, operador.usuario.id]);
    const generado = await request(app).post('/api/codigos-qr').auth(acceso.token_acceso, { type: 'bearer' }).send({}).expect(201);
    assert.equal(generado.body.datos.ubicacion.resultado, 'NO_REQUERIDA');
    const [fila] = await db.query('SELECT latitud_emision, longitud_emision, ubicacion_obtenida_en FROM credenciales_acceso WHERE usuario_id = ? ORDER BY id DESC LIMIT 1', [acceso.usuario.id]);
    assert.equal(fila.latitud_emision, null);
    assert.equal(fila.longitud_emision, null);
    assert.equal(fila.ubicacion_obtenida_en, null);
    const datos = { codigo_qr: generado.body.datos.codigo_qr, punto_acceso_codigo: 'PRUEBA-LOCAL' };
    const entrada = await request(app).post('/api/ingresos/validar').auth(operador.token_acceso, { type: 'bearer' }).send(datos).expect(200);
    assert.equal(entrada.body.datos.resultado, 'AUTORIZADO');
    const repetido = await request(app).post('/api/ingresos/validar').auth(operador.token_acceso, { type: 'bearer' }).send(datos).expect(200);
    assert.equal(repetido.body.datos.resultado, 'DENEGADO');
    await db.query("UPDATE usuarios SET estado_autorizacion = 'DENEGADO' WHERE id = ?", [acceso.usuario.id]);
    await request(app).post('/api/codigos-qr').auth(acceso.token_acceso, { type: 'bearer' }).send({}).expect(403);
  });

  it('conserva el bloqueo de acceso aunque se vuelva a validar la intranet', async () => {
    const codigo = codigoNuevo();
    await login(codigo);
    await db.query("UPDATE usuarios SET estado = 'BLOQUEADO', estado_autorizacion = 'DENEGADO' WHERE codigo_institucional = ?", [codigo]);
    await login(codigo, 403);
    const [fila] = await db.query('SELECT estado, estado_autorizacion FROM usuarios WHERE codigo_institucional = ?', [codigo]);
    assert.equal(fila.estado, 'BLOQUEADO');
    assert.equal(fila.estado_autorizacion, 'DENEGADO');
  });

  it('exige titularidad y confirmación; borra y revoca sesiones sin borrar una cuenta recreada', async () => {
    const codigo = codigoNuevo();
    const acceso = (await login(codigo)).body.datos.sesion;
    const c = await prepararBorrado(codigo);
    await request(app).post('/api/cuenta/eliminacion/confirmar').send({ ...c, confirmacion: 'NO' }).expect(400);
    await request(app).post('/api/cuenta/eliminacion/confirmar').send({ ...c, verificador: randomBytes(32).toString('base64url'), confirmacion: 'ELIMINAR' }).expect(410);
    const consulta = await request(app).post('/api/cuenta/eliminacion/estado').send(c).expect(200);
    assert.equal(consulta.body.datos.cuenta.codigo, codigo);
    await request(app).post('/api/cuenta/eliminacion/confirmar').send({ ...c, confirmacion: 'ELIMINAR' }).expect(200);
    await request(app).get('/api/autenticacion/sesion').auth(acceso.token_acceso, { type: 'bearer' }).expect(401);
    const nueva = await login(codigo);
    assert.notEqual(nueva.body.datos.sesion.usuario.id, acceso.usuario.id);
    await request(app).post('/api/cuenta/eliminacion/confirmar').send({ ...c, confirmacion: 'ELIMINAR' }).expect(200);
    await request(app).get('/api/autenticacion/sesion').auth(nueva.body.datos.sesion.token_acceso, { type: 'bearer' }).expect(200);
  });

  it('permite borrar una cuenta bloqueada y conserva su restricción por separado', async () => {
    const codigo = codigoNuevo();
    await login(codigo);
    await db.query("UPDATE usuarios SET estado = 'BLOQUEADO' WHERE codigo_institucional = ?", [codigo]);
    const c = await prepararBorrado(codigo);
    await request(app).post('/api/cuenta/eliminacion/confirmar').send({ ...c, confirmacion: 'ELIMINAR' }).expect(200);
    const r = await login(codigo, 403);
    assert.equal(r.body.error.codigo, 'RESTRICCION_INSTITUCIONAL_VIGENTE');
  });

  it('no convierte cuentas de operadores en estudiantes ni permite borrarlas desde este flujo', async () => {
    const codigo = codigoNuevo();
    const r = await login(codigo);
    await db.query("INSERT INTO usuarios_roles (usuario_id, rol_id) SELECT ?, id FROM roles WHERE nombre = 'SEGURIDAD'", [r.body.datos.sesion.usuario.id]);
    await login(codigo, 409);
    await prepararBorrado(codigo, 403);
  });
});

after(async () => {
  for (const id of solicitudes) await db.query('DELETE FROM solicitudes_eliminacion_cuenta WHERE id = ?', [id]);
  for (const codigo of codigos) {
    const [usuario] = await db.query('SELECT * FROM usuarios WHERE codigo_institucional = ?', [codigo]);
    if (usuario) {
      await db.query('DELETE FROM asignaciones_seguridad WHERE usuario_id = ?', [usuario.id]);
      await repo.borrarDatos(db, usuario);
    }
  }
  await intranet.cerrar();
  await db.end();
});
