import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

const contrasena = 'Prueba-Temporal-Segura!2026';
const usuariosPrueba = [
  { codigo: 'PRUEBA-AUTH-ACTIVO', estado: 'ACTIVO', rol: 'ESTUDIANTE' },
  { codigo: 'PRUEBA-AUTH-INACTIVO', estado: 'INACTIVO', rol: 'ESTUDIANTE' },
  { codigo: 'PRUEBA-AUTH-BLOQUEO', estado: 'ACTIVO', rol: 'ESTUDIANTE' },
];
const aplicacion = crearAplicacion({
  entornoEjecucion: 'test',
  configuracionAutenticacion: {
    duracionTokenAccesoMinutos: 15,
    duracionTokenRenovacionDias: 7,
    maxIntentosInicioSesion: 3,
    duracionBloqueoMinutos: 1,
  },
});

async function eliminarDatosPrueba() {
  const codigos = usuariosPrueba.map(({ codigo }) => codigo);
  const marcadores = codigos.map(() => '?').join(', ');
  const usuarios = await grupoConexiones.query(
    `SELECT id FROM usuarios WHERE codigo_institucional IN (${marcadores})`,
    codigos,
  );
  const ids = usuarios.map(({ id }) => id);
  if (ids.length === 0) return;
  const marcadoresIds = ids.map(() => '?').join(', ');

  await grupoConexiones.query(
    `DELETE FROM registros_auditoria WHERE usuario_actor_id IN (${marcadoresIds})`,
    ids,
  );
  await grupoConexiones.query(
    `DELETE FROM intentos_inicio_sesion WHERE usuario_id IN (${marcadoresIds})`,
    ids,
  );
  await grupoConexiones.query(
    `DELETE FROM sesiones WHERE usuario_id IN (${marcadoresIds})`,
    ids,
  );
  await grupoConexiones.query(
    `DELETE FROM usuarios_roles WHERE usuario_id IN (${marcadoresIds})`,
    ids,
  );
  await grupoConexiones.query(
    `DELETE FROM usuarios WHERE id IN (${marcadoresIds})`,
    ids,
  );
}

async function crearDatosPrueba() {
  const hash = await bcrypt.hash(contrasena, 12);
  for (const [indice, usuario] of usuariosPrueba.entries()) {
    const resultado = await grupoConexiones.query(
      `INSERT INTO usuarios (
        codigo_institucional,
        correo_institucional,
        contrasena_hash,
        nombres,
        apellidos,
        estado,
        estado_autorizacion
      ) VALUES (?, ?, ?, 'Usuario', 'Autenticación', ?, 'AUTORIZADO')`,
      [usuario.codigo, `autenticacion${indice}@example.invalid`, hash, usuario.estado],
    );
    await grupoConexiones.query(
      `INSERT INTO usuarios_roles (usuario_id, rol_id)
       SELECT ?, id FROM roles WHERE nombre = ?`,
      [resultado.insertId, usuario.rol],
    );
  }
}

function iniciarSesion(codigo = usuariosPrueba[0].codigo) {
  return request(aplicacion)
    .post('/api/autenticacion/iniciar-sesion')
    .send({ identificador: codigo, contrasena });
}

before(async () => {
  await eliminarDatosPrueba();
  await crearDatosPrueba();
});

after(async () => {
  await eliminarDatosPrueba();
  await grupoConexiones.end();
});

describe('Autenticación temporal y autorización', { concurrency: false }, () => {
  it('inicia sesión con credenciales válidas y no almacena tokens legibles', async () => {
    const respuesta = await iniciarSesion().expect(201);

    assert.equal(respuesta.body.datos.tipo_token, 'Bearer');
    assert.match(respuesta.body.datos.token_acceso, /^upt_acceso_/);
    assert.match(respuesta.body.datos.token_renovacion, /^upt_renovacion_/);
    assert.deepEqual(respuesta.body.datos.usuario.roles, ['ESTUDIANTE']);
    assert.equal(respuesta.body.datos.usuario.contrasena_hash, undefined);

    const [sesion] = await grupoConexiones.query(
      'SELECT token_acceso_hash, token_renovacion_hash FROM sesiones WHERE usuario_id = ?',
      [respuesta.body.datos.usuario.id],
    );
    assert.notEqual(sesion.token_acceso_hash, respuesta.body.datos.token_acceso);
    assert.notEqual(sesion.token_renovacion_hash, respuesta.body.datos.token_renovacion);
    assert.equal(sesion.token_acceso_hash.length, 64);
  });

  it('rechaza credenciales inválidas sin confirmar si el usuario existe', async () => {
    const respuesta = await request(aplicacion)
      .post('/api/autenticacion/iniciar-sesion')
      .send({ identificador: 'USUARIO-INEXISTENTE', contrasena: 'Incorrecta!123456' })
      .expect(401);

    assert.equal(respuesta.body.error.codigo, 'CREDENCIALES_INVALIDAS');
  });

  it('rechaza a un usuario inactivo aunque su contraseña sea correcta', async () => {
    const respuesta = await iniciarSesion(usuariosPrueba[1].codigo).expect(403);
    assert.equal(respuesta.body.error.codigo, 'USUARIO_NO_HABILITADO');
  });

  it('rechaza un token ausente y un token inválido', async () => {
    const ausente = await request(aplicacion)
      .get('/api/autenticacion/sesion')
      .expect(401);
    assert.equal(ausente.body.error.codigo, 'AUTENTICACION_REQUERIDA');

    const invalido = await request(aplicacion)
      .get('/api/autenticacion/sesion')
      .set('authorization', 'Bearer token-inventado')
      .expect(401);
    assert.equal(invalido.body.error.codigo, 'TOKEN_ACCESO_INVALIDO');
  });

  it('rechaza un token de acceso vencido', async () => {
    const inicio = await iniciarSesion().expect(201);
    const usuarioId = inicio.body.datos.usuario.id;
    const [sesion] = await grupoConexiones.query(
      'SELECT id FROM sesiones WHERE usuario_id = ? ORDER BY id DESC LIMIT 1',
      [usuarioId],
    );
    await grupoConexiones.query(
      `UPDATE sesiones
       SET creada_en = TIMESTAMPADD(MINUTE, -10, CURRENT_TIMESTAMP(3)),
           expira_en = TIMESTAMPADD(SECOND, -1, CURRENT_TIMESTAMP(3))
       WHERE id = ?`,
      [sesion.id],
    );

    const respuesta = await request(aplicacion)
      .get('/api/autenticacion/sesion')
      .set('authorization', `Bearer ${inicio.body.datos.token_acceso}`)
      .expect(401);
    assert.equal(respuesta.body.error.codigo, 'TOKEN_ACCESO_INVALIDO');
  });

  it('rechaza una sesión vigente si el usuario fue deshabilitado', async () => {
    const inicio = await iniciarSesion().expect(201);
    const usuarioId = inicio.body.datos.usuario.id;
    await grupoConexiones.query(
      "UPDATE usuarios SET estado = 'INACTIVO' WHERE id = ?",
      [usuarioId],
    );

    const respuesta = await request(aplicacion)
      .get('/api/autenticacion/sesion')
      .set('authorization', `Bearer ${inicio.body.datos.token_acceso}`)
      .expect(403);
    assert.equal(respuesta.body.error.codigo, 'USUARIO_NO_HABILITADO');

    await grupoConexiones.query(
      "UPDATE usuarios SET estado = 'ACTIVO' WHERE id = ?",
      [usuarioId],
    );
  });

  it('deniega una operación administrativa a un rol no autorizado', async () => {
    const inicio = await iniciarSesion().expect(201);
    const respuesta = await request(aplicacion)
      .get('/api/administracion/usuarios')
      .set('authorization', `Bearer ${inicio.body.datos.token_acceso}`)
      .expect(403);

    assert.equal(respuesta.body.error.codigo, 'ROL_NO_AUTORIZADO');
  });

  it('rota ambos tokens al renovar y rechaza el token anterior', async () => {
    const inicio = await iniciarSesion().expect(201);
    const renovacion = await request(aplicacion)
      .post('/api/autenticacion/renovar-sesion')
      .send({ token_renovacion: inicio.body.datos.token_renovacion })
      .expect(200);

    assert.notEqual(
      renovacion.body.datos.token_acceso,
      inicio.body.datos.token_acceso,
    );
    assert.notEqual(
      renovacion.body.datos.token_renovacion,
      inicio.body.datos.token_renovacion,
    );

    const anterior = await request(aplicacion)
      .post('/api/autenticacion/renovar-sesion')
      .send({ token_renovacion: inicio.body.datos.token_renovacion })
      .expect(401);
    assert.equal(anterior.body.error.codigo, 'TOKEN_RENOVACION_INVALIDO');
  });

  it('revoca la sesión al cerrarla', async () => {
    const inicio = await iniciarSesion().expect(201);
    await request(aplicacion)
      .post('/api/autenticacion/cerrar-sesion')
      .set('authorization', `Bearer ${inicio.body.datos.token_acceso}`)
      .expect(204);

    const respuesta = await request(aplicacion)
      .get('/api/autenticacion/sesion')
      .set('authorization', `Bearer ${inicio.body.datos.token_acceso}`)
      .expect(401);
    assert.equal(respuesta.body.error.codigo, 'TOKEN_ACCESO_INVALIDO');
  });

  it('aplica un bloqueo temporal después del máximo de fallos', async () => {
    for (let intento = 0; intento < 3; intento += 1) {
      await request(aplicacion)
        .post('/api/autenticacion/iniciar-sesion')
        .send({
          identificador: usuariosPrueba[2].codigo,
          contrasena: 'Clave-Incorrecta!2026',
        })
        .expect(401);
    }

    const respuesta = await iniciarSesion(usuariosPrueba[2].codigo).expect(429);
    assert.equal(respuesta.body.error.codigo, 'INICIO_SESION_BLOQUEADO');
  });
});
