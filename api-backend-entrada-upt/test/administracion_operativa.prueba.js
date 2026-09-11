import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

const contrasena = 'Administracion-Operativa!2026';
const codigoPuntoPrincipal = 'PRUEBA-OPERATIVA-H8';
const codigoPuntoSecundario = 'PRUEBA-OPERATIVA-H8-B';
const codigoPuntoCreado = 'PRUEBA-OPERATIVA-H8-NUEVO';
const usuariosPrueba = [
  ['PRUEBA-OPERATIVA-ADMIN', 'ADMINISTRADOR'],
  ['PRUEBA-OPERATIVA-SEG-A', 'SEGURIDAD'],
  ['PRUEBA-OPERATIVA-SEG-B', 'SEGURIDAD'],
  ['PRUEBA-OPERATIVA-PORTADOR', 'ESTUDIANTE'],
];
const aplicacion = crearAplicacion({ entornoEjecucion: 'test' });
const idsUsuarios = new Map();
const idsPuntos = new Map();
const idsRegistros = [];
let tokenAdministrador;
let tokenSeguridadA;
let tokenSeguridadB;
let configuracionOriginal;

async function obtenerIdsExistentes() {
  const codigos = usuariosPrueba.map(([codigo]) => codigo);
  const usuarios = await grupoConexiones.query(
    `SELECT id FROM usuarios
     WHERE codigo_institucional IN (${codigos.map(() => '?').join(', ')})`,
    codigos,
  );
  const puntos = await grupoConexiones.query(
    'SELECT id FROM puntos_acceso WHERE codigo IN (?, ?, ?)',
    [codigoPuntoPrincipal, codigoPuntoSecundario, codigoPuntoCreado],
  );
  return {
    usuarios: usuarios.map(({ id }) => id),
    puntos: puntos.map(({ id }) => id),
  };
}

async function eliminarDatosPrueba() {
  const { usuarios, puntos } = await obtenerIdsExistentes();
  if (usuarios.length > 0 || puntos.length > 0) {
    const condiciones = [];
    const parametros = [];
    if (usuarios.length > 0) {
      const marcadores = usuarios.map(() => '?').join(', ');
      condiciones.push(`usuario_id IN (${marcadores})`);
      parametros.push(...usuarios);
      condiciones.push(`usuario_seguridad_id IN (${marcadores})`);
      parametros.push(...usuarios);
    }
    if (puntos.length > 0) {
      condiciones.push(`punto_acceso_id IN (${puntos.map(() => '?').join(', ')})`);
      parametros.push(...puntos);
    }
    await grupoConexiones.query(
      `DELETE FROM registros_acceso WHERE ${condiciones.join(' OR ')}`,
      parametros,
    );
  }
  if (usuarios.length > 0) {
    const marcadores = usuarios.map(() => '?').join(', ');
    await grupoConexiones.query(
      `DELETE FROM registros_auditoria WHERE usuario_actor_id IN (${marcadores})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM credenciales_acceso WHERE usuario_id IN (${marcadores})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM intentos_inicio_sesion WHERE usuario_id IN (${marcadores})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM sesiones WHERE usuario_id IN (${marcadores})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM perfiles_academicos WHERE usuario_id IN (${marcadores})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM usuarios_roles WHERE usuario_id IN (${marcadores})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM usuarios WHERE id IN (${marcadores})`,
      usuarios,
    );
  }
  await grupoConexiones.query(
    'DELETE FROM puntos_acceso WHERE codigo IN (?, ?, ?)',
    [codigoPuntoPrincipal, codigoPuntoSecundario, codigoPuntoCreado],
  );
}

async function crearDatosPrueba() {
  const contrasenaHash = await bcrypt.hash(contrasena, 12);
  for (const [codigo, rol] of usuariosPrueba) {
    const resultado = await grupoConexiones.query(
      `INSERT INTO usuarios (
        codigo_institucional,
        correo_institucional,
        contrasena_hash,
        nombres,
        apellidos,
        nombre_institucional,
        estado,
        estado_autorizacion,
        identidad_verificada,
        identidad_verificada_en
      ) VALUES (?, ?, ?, 'Usuario', ?, ?, 'ACTIVO', 'AUTORIZADO', TRUE,
        CURRENT_TIMESTAMP(3))`,
      [
        codigo,
        `${codigo.toLowerCase()}@example.invalid`,
        contrasenaHash,
        rol,
        `Usuario ${rol}`,
      ],
    );
    idsUsuarios.set(codigo, resultado.insertId);
    await grupoConexiones.query(
      `INSERT INTO usuarios_roles (usuario_id, rol_id)
       SELECT ?, id FROM roles WHERE nombre = ?`,
      [resultado.insertId, rol],
    );
  }

  const puntoPrincipal = await grupoConexiones.query(
    `INSERT INTO puntos_acceso
      (codigo, nombre, latitud, longitud, radio_permitido_metros, estado)
     VALUES (?, 'Punto operativo principal', 12, 12, 150, 'ACTIVO')`,
    [codigoPuntoPrincipal],
  );
  const puntoSecundario = await grupoConexiones.query(
    `INSERT INTO puntos_acceso
      (codigo, nombre, latitud, longitud, radio_permitido_metros, estado)
     VALUES (?, 'Punto operativo secundario', 13, 13, 150, 'ACTIVO')`,
    [codigoPuntoSecundario],
  );
  idsPuntos.set(codigoPuntoPrincipal, puntoPrincipal.insertId);
  idsPuntos.set(codigoPuntoSecundario, puntoSecundario.insertId);

  const registros = [
    {
      usuarioId: idsUsuarios.get('PRUEBA-OPERATIVA-PORTADOR'),
      puntoId: puntoPrincipal.insertId,
      seguridadId: idsUsuarios.get('PRUEBA-OPERATIVA-SEG-A'),
      huella: 'a'.repeat(64),
      resultado: 'AUTORIZADO',
      motivo: 'ACCESO_AUTORIZADO',
      minutos: -2,
    },
    {
      usuarioId: idsUsuarios.get('PRUEBA-OPERATIVA-PORTADOR'),
      puntoId: puntoPrincipal.insertId,
      seguridadId: idsUsuarios.get('PRUEBA-OPERATIVA-SEG-A'),
      huella: 'b'.repeat(64),
      resultado: 'DENEGADO',
      motivo: 'CREDENCIAL_YA_UTILIZADA',
      minutos: -1,
    },
    {
      usuarioId: null,
      puntoId: puntoSecundario.insertId,
      seguridadId: idsUsuarios.get('PRUEBA-OPERATIVA-SEG-B'),
      huella: 'c'.repeat(64),
      resultado: 'DENEGADO',
      motivo: 'TOKEN_INVALIDO',
      minutos: 0,
    },
  ];
  for (const registro of registros) {
    const resultado = await grupoConexiones.query(
      `INSERT INTO registros_acceso (
        usuario_id,
        punto_acceso_id,
        usuario_seguridad_id,
        huella_token,
        resultado,
        motivo,
        detalle,
        latitud_escaneo,
        longitud_escaneo,
        precision_escaneo_metros,
        ubicacion_escaneo_obtenida_en,
        distancia_escaneo_metros,
        registrado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 12, 12, 10,
        TIMESTAMPADD(MINUTE, ?, CURRENT_TIMESTAMP(3)), 0,
        TIMESTAMPADD(MINUTE, ?, CURRENT_TIMESTAMP(3)))`,
      [
        registro.usuarioId,
        registro.puntoId,
        registro.seguridadId,
        registro.huella,
        registro.resultado,
        registro.motivo,
        JSON.stringify({ dato_interno: 'no_exponer' }),
        registro.minutos,
        registro.minutos,
      ],
    );
    idsRegistros.push(resultado.insertId);
  }
}

async function iniciarSesion(codigo) {
  const respuesta = await request(aplicacion)
    .post('/api/autenticacion/iniciar-sesion')
    .send({ identificador: codigo, contrasena })
    .expect(201);
  return respuesta.body.datos.token_acceso;
}

function comoAdministrador(peticion) {
  return peticion.set('authorization', `Bearer ${tokenAdministrador}`);
}

before(async () => {
  await eliminarDatosPrueba();
  [configuracionOriginal] = await grupoConexiones.query(
    `SELECT valor, actualizado_por, actualizado_en
     FROM configuraciones_sistema WHERE clave = 'DURACION_QR_SEGUNDOS'`,
  );
  await crearDatosPrueba();
  tokenAdministrador = await iniciarSesion('PRUEBA-OPERATIVA-ADMIN');
  tokenSeguridadA = await iniciarSesion('PRUEBA-OPERATIVA-SEG-A');
  tokenSeguridadB = await iniciarSesion('PRUEBA-OPERATIVA-SEG-B');
});

after(async () => {
  await grupoConexiones.query(
    `UPDATE configuraciones_sistema
     SET valor = ?, actualizado_por = ?, actualizado_en = ?
     WHERE clave = 'DURACION_QR_SEGUNDOS'`,
    [
      configuracionOriginal.valor,
      configuracionOriginal.actualizado_por,
      configuracionOriginal.actualizado_en,
    ],
  );
  await eliminarDatosPrueba();
  await grupoConexiones.end();
});

describe('Administración operativa y trazabilidad', { concurrency: false }, () => {
  it('protege todas las operaciones con el rol ADMINISTRADOR', async () => {
    const sinSesion = await request(aplicacion)
      .get('/api/administracion/accesos')
      .expect(401);
    assert.equal(sinSesion.body.error.codigo, 'AUTENTICACION_REQUERIDA');

    const sinRol = await request(aplicacion)
      .get('/api/administracion/puntos-acceso')
      .set('authorization', `Bearer ${tokenSeguridadA}`)
      .expect(403);
    assert.equal(sinRol.body.error.codigo, 'ROL_NO_AUTORIZADO');
  });

  it('consulta accesos con filtros, fechas, paginación y detalle protegido', async () => {
    const usuarioId = idsUsuarios.get('PRUEBA-OPERATIVA-PORTADOR');
    const desde = encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString());
    const hasta = encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString());
    const listado = await comoAdministrador(request(aplicacion)
      .get(`/api/administracion/accesos?usuario_id=${usuarioId}&resultado=DENEGADO&desde=${desde}&hasta=${hasta}&pagina=1&limite=1`))
      .expect(200);

    assert.equal(listado.body.datos.length, 1);
    assert.equal(listado.body.datos[0].motivo, 'CREDENCIAL_YA_UTILIZADA');
    assert.equal(listado.body.paginacion.total, 1);
    assert.equal(listado.body.paginacion.total_paginas, 1);
    assert.doesNotMatch(
      JSON.stringify(listado.body),
      /huella_token|correo_institucional|contrasena|token_hash|dato_interno/i,
    );

    const detalle = await comoAdministrador(request(aplicacion)
      .get(`/api/administracion/accesos/${idsRegistros[0]}`))
      .expect(200);
    assert.equal(detalle.body.datos.resultado, 'AUTORIZADO');
    assert.equal(detalle.body.datos.ubicacion_escaneo.precision_metros, 10);
    assert.equal(
      detalle.body.datos.usuario.codigo_institucional,
      'PRUEBA-OPERATIVA-PORTADOR',
    );
    assert.doesNotMatch(JSON.stringify(detalle.body), /huella|dato_interno/i);

    await comoAdministrador(request(aplicacion)
      .get(`/api/administracion/accesos?desde=${hasta}&hasta=${desde}`))
      .expect(400);
    await comoAdministrador(request(aplicacion)
      .get('/api/administracion/accesos/999999999'))
      .expect(404);
  });

  it('muestra al personal de seguridad sólo su historial reciente', async () => {
    const seguridadA = await request(aplicacion)
      .get('/api/ingresos/recientes?limite=10')
      .set('authorization', `Bearer ${tokenSeguridadA}`)
      .expect(200);
    assert.equal(seguridadA.body.datos.length, 2);
    const denegado = seguridadA.body.datos.find(
      ({ resultado }) => resultado === 'DENEGADO',
    );
    const autorizado = seguridadA.body.datos.find(
      ({ resultado }) => resultado === 'AUTORIZADO',
    );
    assert.equal(denegado.usuario, null);
    assert.equal(
      autorizado.usuario.codigo_institucional,
      'PRUEBA-OPERATIVA-PORTADOR',
    );

    const seguridadB = await request(aplicacion)
      .get('/api/ingresos/recientes')
      .set('authorization', `Bearer ${tokenSeguridadB}`)
      .expect(200);
    assert.equal(seguridadB.body.datos.length, 1);
    assert.equal(seguridadB.body.datos[0].motivo, 'TOKEN_INVALIDO');
    assert.equal(seguridadB.body.datos[0].usuario, null);
  });

  it('crea y actualiza puntos de acceso sin borrar el historial', async () => {
    const creacion = await comoAdministrador(request(aplicacion)
      .post('/api/administracion/puntos-acceso')
      .send({
        codigo: codigoPuntoCreado.toLowerCase(),
        nombre: 'Punto creado por API',
        descripcion: 'Punto ficticio para la prueba.',
        latitud: 14,
        longitud: 14,
        radio_permitido_metros: 120,
      }))
      .expect(201);
    assert.equal(creacion.body.datos.codigo, codigoPuntoCreado);
    assert.equal(creacion.body.datos.estado, 'ACTIVO');

    const listado = await comoAdministrador(request(aplicacion)
      .get('/api/administracion/puntos-acceso?buscar=H8-NUEVO&estado=ACTIVO'))
      .expect(200);
    assert.equal(listado.body.paginacion.total, 1);

    const actualizado = await comoAdministrador(request(aplicacion)
      .patch(`/api/administracion/puntos-acceso/${creacion.body.datos.id}`)
      .send({ estado: 'INACTIVO', nombre: 'Punto deshabilitado' }))
      .expect(200);
    assert.equal(actualizado.body.datos.estado, 'INACTIVO');

    const duplicado = await comoAdministrador(request(aplicacion)
      .post('/api/administracion/puntos-acceso')
      .send({
        codigo: codigoPuntoCreado,
        nombre: 'Duplicado',
        latitud: 14,
        longitud: 14,
        radio_permitido_metros: 120,
      }))
      .expect(409);
    assert.equal(duplicado.body.error.codigo, 'CODIGO_PUNTO_ACCESO_DUPLICADO');
  });

  it('revoca credenciales pendientes al cambiar las reglas de un punto', async () => {
    const tokenPortador = await iniciarSesion('PRUEBA-OPERATIVA-PORTADOR');
    await request(aplicacion)
      .post('/api/codigos-qr')
      .set('authorization', `Bearer ${tokenPortador}`)
      .send({
        ubicacion: {
          latitud: 12,
          longitud: 12,
          precision_metros: 10,
          obtenida_en: new Date().toISOString(),
        },
      })
      .expect(201);

    await comoAdministrador(request(aplicacion)
      .patch(`/api/administracion/puntos-acceso/${idsPuntos.get(codigoPuntoPrincipal)}`)
      .send({ radio_permitido_metros: 175 }))
      .expect(200);
    const [credencial] = await grupoConexiones.query(
      `SELECT estado, motivo_revocacion
       FROM credenciales_acceso
       WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`,
      [idsUsuarios.get('PRUEBA-OPERATIVA-PORTADOR')],
    );
    assert.deepEqual(credencial, {
      estado: 'REVOCADA',
      motivo_revocacion: 'PUNTO_ACCESO_ACTUALIZADO',
    });
  });

  it('consulta y modifica únicamente configuraciones operativas permitidas', async () => {
    const consulta = await comoAdministrador(request(aplicacion)
      .get('/api/administracion/configuraciones'))
      .expect(200);
    assert.equal(consulta.body.datos.length, 5);
    const unSoloUso = consulta.body.datos.find(
      ({ clave }) => clave === 'QR_UN_SOLO_USO',
    );
    assert.equal(unSoloUso.valor, true);
    assert.equal(unSoloUso.editable, false);

    const nuevoValor = Number(configuracionOriginal.valor) === 300
      ? 299
      : Number(configuracionOriginal.valor) + 1;
    const actualizada = await comoAdministrador(request(aplicacion)
      .put('/api/administracion/configuraciones/DURACION_QR_SEGUNDOS')
      .send({ valor: nuevoValor }))
      .expect(200);
    assert.equal(actualizada.body.datos.valor, nuevoValor);

    const protegida = await comoAdministrador(request(aplicacion)
      .put('/api/administracion/configuraciones/QR_UN_SOLO_USO')
      .send({ valor: false }))
      .expect(403);
    assert.equal(protegida.body.error.codigo, 'CONFIGURACION_NO_EDITABLE');

    const fueraRango = await comoAdministrador(request(aplicacion)
      .put('/api/administracion/configuraciones/DURACION_QR_SEGUNDOS')
      .send({ valor: 301 }))
      .expect(400);
    assert.equal(
      fueraRango.body.error.codigo,
      'VALOR_CONFIGURACION_FUERA_DE_RANGO',
    );
  });

  it('consulta auditoría protegida y un resumen sin datos personales', async () => {
    const administradorId = idsUsuarios.get('PRUEBA-OPERATIVA-ADMIN');
    const auditoria = await comoAdministrador(request(aplicacion)
      .get(`/api/administracion/auditoria?usuario_actor_id=${administradorId}&accion=PUNTO_ACCESO_CREADO&pagina=1&limite=10`))
      .expect(200);
    assert.equal(auditoria.body.paginacion.total, 1);
    assert.equal(auditoria.body.datos[0].entidad, 'PUNTO_ACCESO');
    assert.doesNotMatch(
      JSON.stringify(auditoria.body),
      /detalle|direccion_ip|contrasena|token/i,
    );

    const resumen = await comoAdministrador(request(aplicacion)
      .get('/api/administracion/resumen'))
      .expect(200);
    assert.ok(resumen.body.datos.usuarios_total >= 4);
    assert.ok(resumen.body.datos.puntos_acceso_activos >= 1);
    assert.ok(resumen.body.datos.accesos_autorizados_hoy >= 1);
    assert.equal(resumen.body.datos.usuario, undefined);
  });
});
