import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

const contrasena = 'Validacion-Ingreso-Segura!2026';
const codigoPuntoPrincipal = 'PRUEBA-INGRESO-H7';
const codigoPuntoAlterno = 'PRUEBA-INGRESO-H7-B';
const usuariosPrueba = [
  {
    codigo: 'PRUEBA-INGRESO-PORTADOR',
    correo: 'ingreso.portador@example.invalid',
    rol: 'ESTUDIANTE',
    nombres: 'Ana María',
    apellidos: 'Torres Flores',
  },
  {
    codigo: 'PRUEBA-INGRESO-SEGURIDAD',
    correo: 'ingreso.seguridad@example.invalid',
    rol: 'SEGURIDAD',
    nombres: 'Personal',
    apellidos: 'Seguridad',
  },
  {
    codigo: 'PRUEBA-INGRESO-SIN-ROL',
    correo: 'ingreso.sin.rol@example.invalid',
    rol: 'DOCENTE',
    nombres: 'Docente',
    apellidos: 'Sin Rol',
  },
];
const aplicacion = crearAplicacion({ entornoEjecucion: 'test' });
const idsUsuarios = new Map();

function ubicacionValida(longitud = 10) {
  return {
    latitud: 10,
    longitud,
    precision_metros: 15,
    obtenida_en: new Date().toISOString(),
  };
}

async function eliminarDatosPrueba() {
  const codigosUsuarios = usuariosPrueba.map(({ codigo }) => codigo);
  const marcadoresUsuarios = codigosUsuarios.map(() => '?').join(', ');
  const usuarios = await grupoConexiones.query(
    `SELECT id FROM usuarios WHERE codigo_institucional IN (${marcadoresUsuarios})`,
    codigosUsuarios,
  );
  const ids = usuarios.map(({ id }) => id);
  const puntos = await grupoConexiones.query(
    'SELECT id FROM puntos_acceso WHERE codigo IN (?, ?)',
    [codigoPuntoPrincipal, codigoPuntoAlterno],
  );
  const idsPuntos = puntos.map(({ id }) => id);

  if (ids.length > 0 || idsPuntos.length > 0) {
    const condiciones = [];
    const parametros = [];
    if (ids.length > 0) {
      const marcadores = ids.map(() => '?').join(', ');
      condiciones.push(`usuario_id IN (${marcadores})`);
      parametros.push(...ids);
      condiciones.push(`usuario_seguridad_id IN (${marcadores})`);
      parametros.push(...ids);
    }
    if (idsPuntos.length > 0) {
      const marcadores = idsPuntos.map(() => '?').join(', ');
      condiciones.push(`punto_acceso_id IN (${marcadores})`);
      parametros.push(...idsPuntos);
    }
    await grupoConexiones.query(
      `DELETE FROM registros_acceso WHERE ${condiciones.join(' OR ')}`,
      parametros,
    );
  }

  if (ids.length > 0) {
    const marcadores = ids.map(() => '?').join(', ');
    await grupoConexiones.query(
      `DELETE FROM registros_auditoria WHERE usuario_actor_id IN (${marcadores})`,
      ids,
    );
    await grupoConexiones.query(
      `DELETE FROM credenciales_acceso WHERE usuario_id IN (${marcadores})`,
      ids,
    );
    await grupoConexiones.query(
      `DELETE FROM intentos_inicio_sesion WHERE usuario_id IN (${marcadores})`,
      ids,
    );
    await grupoConexiones.query(
      `DELETE FROM sesiones WHERE usuario_id IN (${marcadores})`,
      ids,
    );
    await grupoConexiones.query(
      `DELETE FROM perfiles_academicos WHERE usuario_id IN (${marcadores})`,
      ids,
    );
    await grupoConexiones.query(
      `DELETE FROM usuarios_roles WHERE usuario_id IN (${marcadores})`,
      ids,
    );
    await grupoConexiones.query(
      `DELETE FROM usuarios WHERE id IN (${marcadores})`,
      ids,
    );
  }
  await grupoConexiones.query(
    'DELETE FROM puntos_acceso WHERE codigo IN (?, ?)',
    [codigoPuntoPrincipal, codigoPuntoAlterno],
  );
}

async function crearDatosPrueba() {
  await grupoConexiones.query(
    `INSERT INTO puntos_acceso
      (codigo, nombre, latitud, longitud, radio_permitido_metros, estado)
     VALUES
      (?, 'Puerta principal de prueba', 10, 10, 150, 'ACTIVO'),
      (?, 'Puerta alterna de prueba', 10, 10.0005, 150, 'ACTIVO')`,
    [codigoPuntoPrincipal, codigoPuntoAlterno],
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
        nombre_institucional,
        foto_url,
        estado,
        estado_autorizacion,
        identidad_verificada,
        identidad_verificada_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVO', 'AUTORIZADO', TRUE, CURRENT_TIMESTAMP(3))`,
      [
        usuario.codigo,
        usuario.correo,
        contrasenaHash,
        usuario.nombres,
        usuario.apellidos,
        `${usuario.nombres} ${usuario.apellidos}`,
        usuario.rol === 'ESTUDIANTE'
          ? 'https://example.invalid/foto-identidad.png'
          : null,
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
    `INSERT INTO perfiles_academicos
      (usuario_id, escuela, facultad, estado_academico, periodo_academico)
     VALUES (?, 'Ingeniería de Sistemas', 'Ingeniería', 'REGULAR', '2026-II')`,
    [idsUsuarios.get('PRUEBA-INGRESO-PORTADOR')],
  );
}

async function iniciarSesion(codigo) {
  const respuesta = await request(aplicacion)
    .post('/api/autenticacion/iniciar-sesion')
    .send({ identificador: codigo, contrasena })
    .expect(201);
  return respuesta.body.datos.token_acceso;
}

async function emitirCodigoQr() {
  const token = await iniciarSesion('PRUEBA-INGRESO-PORTADOR');
  const respuesta = await request(aplicacion)
    .post('/api/codigos-qr')
    .set('authorization', `Bearer ${token}`)
    .send({ ubicacion: ubicacionValida() })
    .expect(201);
  return { codigoQr: respuesta.body.datos.codigo_qr, tokenPortador: token };
}

function validarIngreso(tokenSeguridad, codigoQr, {
  puntoAccesoCodigo = codigoPuntoPrincipal,
  ubicacion = ubicacionValida(),
} = {}) {
  return request(aplicacion)
    .post('/api/ingresos/validar')
    .set('authorization', `Bearer ${tokenSeguridad}`)
    .send({
      codigo_qr: codigoQr,
      punto_acceso_codigo: puntoAccesoCodigo,
      ubicacion,
    });
}

before(async () => {
  await eliminarDatosPrueba();
  await crearDatosPrueba();
});

after(async () => {
  await eliminarDatosPrueba();
  await grupoConexiones.end();
});

describe('Validación de ingresos mediante códigos QR', { concurrency: false }, () => {
  it('exige autenticación y el rol SEGURIDAD', async () => {
    const { codigoQr } = await emitirCodigoQr();
    const sinAutenticacion = await request(aplicacion)
      .post('/api/ingresos/validar')
      .send({
        codigo_qr: codigoQr,
        punto_acceso_codigo: codigoPuntoPrincipal,
        ubicacion: ubicacionValida(),
      })
      .expect(401);
    assert.equal(sinAutenticacion.body.error.codigo, 'AUTENTICACION_REQUERIDA');

    const tokenSinRol = await iniciarSesion('PRUEBA-INGRESO-SIN-ROL');
    const sinRol = await validarIngreso(tokenSinRol, codigoQr).expect(403);
    assert.equal(sinRol.body.error.codigo, 'ROL_NO_AUTORIZADO');
  });

  it('autoriza un ingreso válido y devuelve sólo la identidad necesaria', async () => {
    const { codigoQr } = await emitirCodigoQr();
    const tokenSeguridad = await iniciarSesion('PRUEBA-INGRESO-SEGURIDAD');
    const respuesta = await validarIngreso(tokenSeguridad, codigoQr).expect(200);

    assert.equal(respuesta.body.datos.resultado, 'AUTORIZADO');
    assert.equal(respuesta.body.datos.motivo, 'ACCESO_AUTORIZADO');
    assert.equal(
      respuesta.body.datos.identidad.codigo_institucional,
      'PRUEBA-INGRESO-PORTADOR',
    );
    assert.equal(respuesta.body.datos.identidad.nombre_completo, 'Ana María Torres Flores');
    assert.deepEqual(respuesta.body.datos.identidad.tipo_usuario, ['ESTUDIANTE']);
    assert.equal(respuesta.body.datos.identidad.escuela, 'Ingeniería de Sistemas');
    assert.equal(respuesta.body.datos.punto_acceso.codigo, codigoPuntoPrincipal);
    assert.match(respuesta.body.datos.registrado_en, /^\d{4}-\d{2}-\d{2}T/);
    assert.doesNotMatch(JSON.stringify(respuesta.body), /correo_institucional/i);

    const [credencial] = await grupoConexiones.query(
      `SELECT estado, usada_en FROM credenciales_acceso
       WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`,
      [idsUsuarios.get('PRUEBA-INGRESO-PORTADOR')],
    );
    assert.equal(credencial.estado, 'USADA');
    assert.ok(credencial.usada_en instanceof Date);
  });

  it('deniega y registra un token inválido sin exponer identidad', async () => {
    const tokenSeguridad = await iniciarSesion('PRUEBA-INGRESO-SEGURIDAD');
    const respuesta = await validarIngreso(
      tokenSeguridad,
      'codigo-qr-invalido',
    ).expect(200);

    assert.equal(respuesta.body.datos.resultado, 'DENEGADO');
    assert.equal(respuesta.body.datos.motivo, 'TOKEN_INVALIDO');
    assert.equal(respuesta.body.datos.identidad, undefined);

    const [registro] = await grupoConexiones.query(
      `SELECT resultado, motivo, usuario_id, credencial_id, LENGTH(huella_token) AS largo_huella
       FROM registros_acceso ORDER BY id DESC LIMIT 1`,
    );
    assert.deepEqual(registro, {
      resultado: 'DENEGADO',
      motivo: 'TOKEN_INVALIDO',
      usuario_id: null,
      credencial_id: null,
      largo_huella: 64,
    });
  });

  it('detecta un OTP alterado', async () => {
    const { codigoQr } = await emitirCodigoQr();
    const partes = codigoQr.split('.');
    partes[2] = `${partes[2][0] === 'A' ? 'B' : 'A'}${partes[2].slice(1)}`;
    const tokenSeguridad = await iniciarSesion('PRUEBA-INGRESO-SEGURIDAD');
    const respuesta = await validarIngreso(
      tokenSeguridad,
      partes.join('.'),
    ).expect(200);

    assert.equal(respuesta.body.datos.resultado, 'DENEGADO');
    assert.equal(
      respuesta.body.datos.motivo,
      'INTEGRIDAD_CREDENCIAL_INVALIDA',
    );
  });

  it('deniega una credencial vencida', async () => {
    const { codigoQr } = await emitirCodigoQr();
    await grupoConexiones.query(
      `UPDATE credenciales_acceso
       SET emitida_en = TIMESTAMPADD(MINUTE, -2, CURRENT_TIMESTAMP(3)),
           expira_en = TIMESTAMPADD(SECOND, -1, CURRENT_TIMESTAMP(3))
       WHERE usuario_id = ? AND estado = 'PENDIENTE'`,
      [idsUsuarios.get('PRUEBA-INGRESO-PORTADOR')],
    );
    const tokenSeguridad = await iniciarSesion('PRUEBA-INGRESO-SEGURIDAD');
    const respuesta = await validarIngreso(tokenSeguridad, codigoQr).expect(200);

    assert.equal(respuesta.body.datos.resultado, 'DENEGADO');
    assert.equal(respuesta.body.datos.motivo, 'CREDENCIAL_EXPIRADA');
  });

  it('deniega el ingreso si el usuario fue deshabilitado', async () => {
    const { codigoQr } = await emitirCodigoQr();
    const usuarioId = idsUsuarios.get('PRUEBA-INGRESO-PORTADOR');
    await grupoConexiones.query(
      "UPDATE usuarios SET estado = 'INACTIVO' WHERE id = ?",
      [usuarioId],
    );
    const tokenSeguridad = await iniciarSesion('PRUEBA-INGRESO-SEGURIDAD');
    const respuesta = await validarIngreso(tokenSeguridad, codigoQr).expect(200);

    assert.equal(respuesta.body.datos.resultado, 'DENEGADO');
    assert.equal(respuesta.body.datos.motivo, 'USUARIO_NO_HABILITADO');
    await grupoConexiones.query(
      "UPDATE usuarios SET estado = 'ACTIVO' WHERE id = ?",
      [usuarioId],
    );
  });

  it('deniega una credencial revocada y una credencial reutilizada', async () => {
    const primera = await emitirCodigoQr();
    await request(aplicacion)
      .delete('/api/codigos-qr/actual')
      .set('authorization', `Bearer ${primera.tokenPortador}`)
      .expect(204);
    const tokenSeguridad = await iniciarSesion('PRUEBA-INGRESO-SEGURIDAD');
    const revocada = await validarIngreso(tokenSeguridad, primera.codigoQr).expect(200);
    assert.equal(revocada.body.datos.motivo, 'CREDENCIAL_REVOCADA');

    const segunda = await emitirCodigoQr();
    const autorizada = await validarIngreso(tokenSeguridad, segunda.codigoQr).expect(200);
    assert.equal(autorizada.body.datos.resultado, 'AUTORIZADO');
    const reutilizada = await validarIngreso(tokenSeguridad, segunda.codigoQr).expect(200);
    assert.equal(reutilizada.body.datos.resultado, 'DENEGADO');
    assert.equal(reutilizada.body.datos.motivo, 'CREDENCIAL_YA_UTILIZADA');
  });

  it('deniega un punto distinto y una ubicación de escaneo fuera de zona', async () => {
    const primera = await emitirCodigoQr();
    const tokenSeguridad = await iniciarSesion('PRUEBA-INGRESO-SEGURIDAD');
    const otroPunto = await validarIngreso(tokenSeguridad, primera.codigoQr, {
      puntoAccesoCodigo: codigoPuntoAlterno,
      ubicacion: ubicacionValida(10.0005),
    }).expect(200);
    assert.equal(otroPunto.body.datos.motivo, 'PUNTO_ACCESO_NO_COINCIDE');

    const segunda = await emitirCodigoQr();
    const fueraZona = await validarIngreso(tokenSeguridad, segunda.codigoQr, {
      ubicacion: {
        ...ubicacionValida(),
        latitud: 11,
        longitud: 11,
      },
    }).expect(200);
    assert.equal(fueraZona.body.datos.motivo, 'UBICACION_ESCANEO_FUERA_DE_ZONA');
  });

  it('autoriza sólo una vez ante dos validaciones simultáneas', async () => {
    const { codigoQr } = await emitirCodigoQr();
    const tokenSeguridad = await iniciarSesion('PRUEBA-INGRESO-SEGURIDAD');
    const [credencial] = await grupoConexiones.query(
      `SELECT id FROM credenciales_acceso
       WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`,
      [idsUsuarios.get('PRUEBA-INGRESO-PORTADOR')],
    );
    const [primera, segunda] = await Promise.all([
      validarIngreso(tokenSeguridad, codigoQr).expect(200),
      validarIngreso(tokenSeguridad, codigoQr).expect(200),
    ]);
    const resultados = [primera.body.datos, segunda.body.datos];

    assert.equal(
      resultados.filter(({ resultado }) => resultado === 'AUTORIZADO').length,
      1,
    );
    assert.equal(
      resultados.filter(({ motivo }) => motivo === 'CREDENCIAL_YA_UTILIZADA').length,
      1,
    );

    const [conteo] = await grupoConexiones.query(
      `SELECT COUNT(*) AS total
       FROM registros_acceso
       WHERE credencial_id = ? AND resultado = 'AUTORIZADO'`,
      [credencial.id],
    );
    assert.equal(conteo.total, 1);
  });
});
