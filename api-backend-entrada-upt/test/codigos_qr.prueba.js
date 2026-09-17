import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

const contrasena = 'Codigo-QR-Seguro!2026';
const codigoPunto = 'PRUEBA-QR-H6';
const usuariosPrueba = [
  {
    codigo: 'PRUEBA-QR-PORTADOR',
    correo: 'qr.portador@example.invalid',
    rol: 'ESTUDIANTE',
    verificada: true,
  },
  {
    codigo: 'PRUEBA-QR-PENDIENTE',
    correo: 'qr.pendiente@example.invalid',
    rol: 'ESTUDIANTE',
    verificada: false,
  },
  {
    codigo: 'PRUEBA-QR-SEGURIDAD',
    correo: 'qr.seguridad@example.invalid',
    rol: 'SEGURIDAD',
    verificada: true,
  },
];
const aplicacion = crearAplicacion({ entornoEjecucion: 'test' });
const idsUsuarios = new Map();

function ubicacionValida() {
  return {
    latitud: 10,
    longitud: 10.001,
    precision_metros: 20,
    obtenida_en: new Date().toISOString(),
  };
}

async function eliminarDatosPrueba() {
  const codigos = usuariosPrueba.map(({ codigo }) => codigo);
  const marcadores = codigos.map(() => '?').join(', ');
  const usuarios = await grupoConexiones.query(
    `SELECT id FROM usuarios WHERE codigo_institucional IN (${marcadores})`,
    codigos,
  );
  const ids = usuarios.map(({ id }) => id);

  if (ids.length > 0) {
    const marcadoresIds = ids.map(() => '?').join(', ');
    await grupoConexiones.query(
      `DELETE FROM registros_auditoria WHERE usuario_actor_id IN (${marcadoresIds})`,
      ids,
    );
    await grupoConexiones.query(
      `DELETE FROM credenciales_acceso WHERE usuario_id IN (${marcadoresIds})`,
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
  await grupoConexiones.query('DELETE FROM puntos_acceso WHERE codigo = ?', [
    codigoPunto,
  ]);
}

async function crearDatosPrueba() {
  await grupoConexiones.query(
    `INSERT INTO puntos_acceso (
      codigo,
      nombre,
      descripcion,
      latitud,
      longitud,
      radio_permitido_metros,
      estado
    ) VALUES (?, 'Punto QR de prueba', 'Coordenadas ficticias.', 10, 10, 150, 'ACTIVO')`,
    [codigoPunto],
  );

  const contrasenaHash = await bcrypt.hash(contrasena, 12);
  for (const usuario of usuariosPrueba) {
    const resultado = await grupoConexiones.query(
      `INSERT INTO usuarios (
        codigo_institucional,
        correo_institucional,
        contrasena_hash,
        nombres,
        apellidos,
        estado,
        estado_autorizacion,
        identidad_verificada,
        identidad_verificada_en
      ) VALUES (?, ?, ?, 'Usuario', 'Código QR', 'ACTIVO', 'AUTORIZADO', ?, ?)`,
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
}

async function iniciarSesion(codigo = 'PRUEBA-QR-PORTADOR') {
  const respuesta = await request(aplicacion)
    .post('/api/autenticacion/iniciar-sesion')
    .send({ identificador: codigo, contrasena })
    .expect(201);
  return respuesta.body.datos;
}

function generarCodigoQr(token, ubicacion = ubicacionValida()) {
  return request(aplicacion)
    .post('/api/codigos-qr')
    .set('authorization', `Bearer ${token}`)
    .send({ ubicacion });
}

before(async () => {
  await eliminarDatosPrueba();
  await crearDatosPrueba();
});

after(async () => {
  await eliminarDatosPrueba();
  await grupoConexiones.end();
});

describe('Generación de códigos QR temporales', { concurrency: false }, () => {
  it('exige una sesión autenticada', async () => {
    const respuesta = await request(aplicacion)
      .post('/api/codigos-qr')
      .send({ ubicacion: ubicacionValida() })
      .expect(401);
    assert.equal(respuesta.body.error.codigo, 'AUTENTICACION_REQUERIDA');
  });

  it('genera un código opaco y almacena únicamente sus hashes', async () => {
    const sesion = await iniciarSesion();
    const respuesta = await generarCodigoQr(sesion.token_acceso).expect(201);
    const credencial = respuesta.body.datos;

    assert.match(
      credencial.codigo_qr,
      /^upt_qr_v1\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/,
    );
    assert.equal(credencial.estado, 'PENDIENTE');
    assert.equal(credencial.duracion_segundos, 15);
    assert.equal(credencial.un_solo_uso, true);
    assert.equal(credencial.ubicacion.punto_acceso.codigo, codigoPunto);
    assert.equal(credencial.ubicacion.resultado, 'DENTRO_DE_ZONA_CONFIGURADA');
    assert.doesNotMatch(credencial.codigo_qr, /PRUEBA-QR-PORTADOR/i);
    assert.doesNotMatch(credencial.codigo_qr, /qr\.portador@example\.invalid/i);

    const usuarioId = idsUsuarios.get('PRUEBA-QR-PORTADOR');
    const [fila] = await grupoConexiones.query(
      `SELECT token_hash, otp_hash, nonce_hash
       FROM credenciales_acceso
       WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`,
      [usuarioId],
    );
    assert.equal(fila.token_hash.length, 64);
    assert.equal(fila.otp_hash.length, 64);
    assert.equal(fila.nonce_hash.length, 64);
    assert.notEqual(fila.token_hash, credencial.codigo_qr);

    const actual = await request(aplicacion)
      .get('/api/codigos-qr/actual')
      .set('authorization', `Bearer ${sesion.token_acceso}`)
      .expect(200);
    assert.equal(actual.body.datos.estado, 'PENDIENTE');
    assert.equal(actual.body.datos.codigo_qr, undefined);
  });

  it('revoca el código anterior cuando genera uno nuevo', async () => {
    const sesion = await iniciarSesion();
    const primero = await generarCodigoQr(sesion.token_acceso).expect(201);
    const segundo = await generarCodigoQr(sesion.token_acceso).expect(201);

    assert.notEqual(primero.body.datos.codigo_qr, segundo.body.datos.codigo_qr);
    const usuarioId = idsUsuarios.get('PRUEBA-QR-PORTADOR');
    const filas = await grupoConexiones.query(
      `SELECT estado, motivo_revocacion
       FROM credenciales_acceso
       WHERE usuario_id = ? ORDER BY id DESC LIMIT 2`,
      [usuarioId],
    );
    assert.equal(filas[0].estado, 'PENDIENTE');
    assert.deepEqual(filas[1], {
      estado: 'REVOCADA',
      motivo_revocacion: 'ROTACION_CODIGO_QR',
    });
  });

  it('mantiene una sola credencial pendiente ante solicitudes simultáneas', async () => {
    const sesion = await iniciarSesion();
    const [primera, segunda] = await Promise.all([
      generarCodigoQr(sesion.token_acceso).expect(201),
      generarCodigoQr(sesion.token_acceso).expect(201),
    ]);
    assert.notEqual(primera.body.datos.codigo_qr, segunda.body.datos.codigo_qr);

    const [conteo] = await grupoConexiones.query(
      `SELECT COUNT(*) AS total
       FROM credenciales_acceso
       WHERE usuario_id = ? AND estado = 'PENDIENTE'`,
      [idsUsuarios.get('PRUEBA-QR-PORTADOR')],
    );
    assert.equal(conteo.total, 1);
  });

  it('marca como expirada una credencial cuya vigencia terminó', async () => {
    const sesion = await iniciarSesion();
    await generarCodigoQr(sesion.token_acceso).expect(201);
    const usuarioId = idsUsuarios.get('PRUEBA-QR-PORTADOR');
    const [fila] = await grupoConexiones.query(
      `SELECT id FROM credenciales_acceso
       WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`,
      [usuarioId],
    );
    await grupoConexiones.query(
      `UPDATE credenciales_acceso
       SET emitida_en = TIMESTAMPADD(MINUTE, -2, CURRENT_TIMESTAMP(3)),
           expira_en = TIMESTAMPADD(SECOND, -1, CURRENT_TIMESTAMP(3))
       WHERE id = ?`,
      [fila.id],
    );

    const actual = await request(aplicacion)
      .get('/api/codigos-qr/actual')
      .set('authorization', `Bearer ${sesion.token_acceso}`)
      .expect(200);
    assert.equal(actual.body.datos.estado, 'EXPIRADA');
  });

  it('permite al usuario revocar su código vigente', async () => {
    const sesion = await iniciarSesion();
    await generarCodigoQr(sesion.token_acceso).expect(201);
    await request(aplicacion)
      .delete('/api/codigos-qr/actual')
      .set('authorization', `Bearer ${sesion.token_acceso}`)
      .expect(204);

    const actual = await request(aplicacion)
      .get('/api/codigos-qr/actual')
      .set('authorization', `Bearer ${sesion.token_acceso}`)
      .expect(200);
    assert.equal(actual.body.datos.estado, 'REVOCADA');
  });

  it('rechaza ubicaciones antiguas, imprecisas o fuera de la zona', async () => {
    const sesion = await iniciarSesion();
    const antigua = ubicacionValida();
    antigua.obtenida_en = new Date(Date.now() - 60_000).toISOString();
    const respuestaAntigua = await generarCodigoQr(
      sesion.token_acceso,
      antigua,
    ).expect(422);
    assert.equal(respuestaAntigua.body.error.codigo, 'UBICACION_DESACTUALIZADA');

    const futura = ubicacionValida();
    futura.obtenida_en = new Date(Date.now() + 20_000).toISOString();
    const respuestaFutura = await generarCodigoQr(
      sesion.token_acceso,
      futura,
    ).expect(422);
    assert.equal(respuestaFutura.body.error.codigo, 'MOMENTO_UBICACION_INVALIDO');

    const imprecisa = ubicacionValida();
    imprecisa.precision_metros = 101;
    const respuestaImprecisa = await generarCodigoQr(
      sesion.token_acceso,
      imprecisa,
    ).expect(422);
    assert.equal(
      respuestaImprecisa.body.error.codigo,
      'PRECISION_UBICACION_INSUFICIENTE',
    );

    const fueraZona = ubicacionValida();
    fueraZona.latitud = 11;
    fueraZona.longitud = 11;
    const respuestaFuera = await generarCodigoQr(
      sesion.token_acceso,
      fueraZona,
    ).expect(403);
    assert.equal(respuestaFuera.body.error.codigo, 'UBICACION_FUERA_DE_ZONA');
  });

  it('rechaza identidades no verificadas y roles no portadores', async () => {
    const identidadPendiente = await iniciarSesion('PRUEBA-QR-PENDIENTE');
    const pendiente = await generarCodigoQr(
      identidadPendiente.token_acceso,
    ).expect(403);
    assert.equal(pendiente.body.error.codigo, 'IDENTIDAD_NO_VERIFICADA');

    const seguridad = await iniciarSesion('PRUEBA-QR-SEGURIDAD');
    const rolNoValido = await generarCodigoQr(
      seguridad.token_acceso,
    ).expect(403);
    assert.equal(
      rolNoValido.body.error.codigo,
      'ROL_NO_HABILITADO_PARA_CODIGO_QR',
    );
  });

  it('revoca el código pendiente cuando se cierra la sesión', async () => {
    const sesion = await iniciarSesion();
    await generarCodigoQr(sesion.token_acceso).expect(201);
    await request(aplicacion)
      .post('/api/autenticacion/cerrar-sesion')
      .set('authorization', `Bearer ${sesion.token_acceso}`)
      .expect(204);

    const [credencial] = await grupoConexiones.query(
      `SELECT estado, motivo_revocacion
       FROM credenciales_acceso
       WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`,
      [idsUsuarios.get('PRUEBA-QR-PORTADOR')],
    );
    assert.deepEqual(credencial, {
      estado: 'REVOCADA',
      motivo_revocacion: 'SESION_CERRADA',
    });
  });
});
