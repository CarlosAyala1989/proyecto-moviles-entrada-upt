import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

const contrasena = 'Identidad-Digital-Segura!2026';
const usuariosPrueba = [
  {
    codigo: 'PRUEBA-IDENTIDAD-PROPIA',
    correo: 'identidad.propia@example.invalid',
    rol: 'ESTUDIANTE',
    verificada: true,
  },
  {
    codigo: 'PRUEBA-IDENTIDAD-AJENA',
    correo: 'identidad.ajena@example.invalid',
    rol: 'TRABAJADOR',
    verificada: true,
  },
  {
    codigo: 'PRUEBA-IDENTIDAD-PENDIENTE',
    correo: 'identidad.pendiente@example.invalid',
    rol: 'DOCENTE',
    verificada: false,
  },
];
const aplicacion = crearAplicacion({ entornoEjecucion: 'test' });
const idsUsuarios = new Map();

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
    `DELETE FROM perfiles_academicos WHERE usuario_id IN (${marcadoresIds})`,
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
  const contrasenaHash = await bcrypt.hash(contrasena, 12);
  for (const usuario of usuariosPrueba) {
    const resultado = await grupoConexiones.query(
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
      ) VALUES (
        ?, ?, ?, 'María Elena', 'Pérez Quispe', 'María Elena Pérez Quispe',
        'NOMBRE INTERNO DE INTRANET', 'https://example.invalid/foto.png',
        'ACTIVO', 'AUTORIZADO', ?, ?
      )`,
      [
        usuario.codigo,
        usuario.correo,
        contrasenaHash,
        usuario.verificada,
        usuario.verificada ? new Date() : null,
      ],
    );
    idsUsuarios.set(usuario.codigo, resultado.insertId);
    await grupoConexiones.query(
      `INSERT INTO usuarios_roles (usuario_id, rol_id)
       SELECT ?, id FROM roles WHERE nombre = ?`,
      [resultado.insertId, usuario.rol],
    );
  }

  await grupoConexiones.query(
    `INSERT INTO perfiles_academicos (
      usuario_id,
      escuela,
      facultad,
      estado_academico,
      periodo_academico
    ) VALUES (?, 'Ingeniería de Sistemas', 'Ingeniería', 'REGULAR', '2026-II')`,
    [idsUsuarios.get('PRUEBA-IDENTIDAD-PROPIA')],
  );
}

async function obtenerToken(codigo) {
  const respuesta = await request(aplicacion)
    .post('/api/autenticacion/iniciar-sesion')
    .send({ identificador: codigo, contrasena })
    .expect(201);
  return respuesta.body.datos.token_acceso;
}

before(async () => {
  await eliminarDatosPrueba();
  await crearDatosPrueba();
});

after(async () => {
  await eliminarDatosPrueba();
  await grupoConexiones.end();
});

describe('Identidad digital propia', { concurrency: false }, () => {
  it('exige una sesión autenticada', async () => {
    const respuesta = await request(aplicacion)
      .get('/api/identidad-digital')
      .expect(401);

    assert.equal(respuesta.body.error.codigo, 'AUTENTICACION_REQUERIDA');
  });

  it('devuelve únicamente los datos autorizados del usuario autenticado', async () => {
    const token = await obtenerToken('PRUEBA-IDENTIDAD-PROPIA');
    const respuesta = await request(aplicacion)
      .get('/api/identidad-digital')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(
      respuesta.body.datos.id,
      idsUsuarios.get('PRUEBA-IDENTIDAD-PROPIA'),
    );
    assert.equal(
      respuesta.body.datos.codigo_institucional,
      'PRUEBA-IDENTIDAD-PROPIA',
    );
    assert.equal(respuesta.body.datos.nombre_completo, 'María Elena Pérez Quispe');
    assert.deepEqual(respuesta.body.datos.roles, ['ESTUDIANTE']);
    assert.deepEqual(respuesta.body.datos.perfil_academico, {
      escuela: 'Ingeniería de Sistemas',
      facultad: 'Ingeniería',
      estado_academico: 'REGULAR',
      periodo_academico: '2026-II',
    });
    assert.equal(respuesta.body.datos.verificacion.estado, 'VERIFICADA');
    assert.equal(respuesta.body.datos.preparacion_codigo_qr.puede_solicitar, true);

    const cuerpoSerializado = JSON.stringify(respuesta.body);
    assert.doesNotMatch(cuerpoSerializado, /contrasena_hash/i);
    assert.doesNotMatch(cuerpoSerializado, /NOMBRE INTERNO DE INTRANET/);
    assert.doesNotMatch(cuerpoSerializado, /token_/i);
  });

  it('no acepta identificadores para consultar una identidad ajena', async () => {
    const token = await obtenerToken('PRUEBA-IDENTIDAD-PROPIA');
    const usuarioAjenoId = idsUsuarios.get('PRUEBA-IDENTIDAD-AJENA');

    const consulta = await request(aplicacion)
      .get(`/api/identidad-digital?usuario_id=${usuarioAjenoId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(400);
    assert.equal(consulta.body.error.codigo, 'DATOS_INVALIDOS');

    await request(aplicacion)
      .get(`/api/identidad-digital/${usuarioAjenoId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('informa que una identidad pendiente todavía no puede solicitar QR', async () => {
    const token = await obtenerToken('PRUEBA-IDENTIDAD-PENDIENTE');
    const respuesta = await request(aplicacion)
      .get('/api/identidad-digital')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(respuesta.body.datos.verificacion.estado, 'PENDIENTE');
    assert.equal(respuesta.body.datos.perfil_academico, null);
    assert.equal(respuesta.body.datos.preparacion_codigo_qr.puede_solicitar, false);
    assert.equal(
      respuesta.body.datos.preparacion_codigo_qr.requisitos.identidad_verificada,
      false,
    );
  });

  it('rechaza la identidad si el usuario deja de estar activo', async () => {
    const codigo = 'PRUEBA-IDENTIDAD-AJENA';
    const usuarioId = idsUsuarios.get(codigo);
    const token = await obtenerToken(codigo);
    await grupoConexiones.query(
      "UPDATE usuarios SET estado = 'INACTIVO' WHERE id = ?",
      [usuarioId],
    );

    const respuesta = await request(aplicacion)
      .get('/api/identidad-digital')
      .set('authorization', `Bearer ${token}`)
      .expect(403);
    assert.equal(respuesta.body.error.codigo, 'USUARIO_NO_HABILITADO');

    await grupoConexiones.query(
      "UPDATE usuarios SET estado = 'ACTIVO' WHERE id = ?",
      [usuarioId],
    );
  });
});
