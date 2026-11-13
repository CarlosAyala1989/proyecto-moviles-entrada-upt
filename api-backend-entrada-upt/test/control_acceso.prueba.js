import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import morgan from 'morgan';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';
import { coincideHorario } from '../src/modulos/control_acceso/politicas_acceso.js';
import { calcularOtpOffline, firmarPasoOffline } from '../src/seguridad/codigos_qr_offline.js';
import { manejarErrores } from '../src/middleware/manejo_errores.js';

const app = crearAplicacion({ entornoEjecucion: 'test' });
const sufijo = randomBytes(4).toString('hex').toUpperCase();
const clave = 'Prueba-Operaciones-Seguridad!2026';
const ids = {};
const tokens = {};
const codigos = {};
let puerta;
const ubicacion = () => ({ latitud: 2, longitud: 2, precision_metros: 5, obtenida_en: new Date().toISOString() });
const como = (rol, operacion) => operacion.set('authorization', `Bearer ${tokens[rol]}`);
const login = async (rol) => {
  const respuesta = await request(app).post('/api/autenticacion/iniciar-sesion').send({ identificador: codigos[rol], contrasena: clave });
  if (respuesta.status === 201) tokens[rol] = respuesta.body.datos.token_acceso;
  return respuesta;
};
const validar = (codigo) => como('guardia', request(app).post('/api/ingresos/validar'))
  .send({ codigo_qr: codigo, punto_acceso_codigo: puerta.codigo, ubicacion: ubicacion() });
const emitir = async () => {
  const respuesta = await como('estudiante', request(app).post('/api/codigos-qr')).send({ ubicacion: ubicacion() }).expect(201);
  return respuesta.body.datos.codigo_qr;
};
const preparar = async () => {
  const respuesta = await como('estudiante', request(app).post('/api/codigos-qr/preparar-offline'))
    .send({ identificador_dispositivo: randomBytes(32).toString('base64url'), plataforma: 'ANDROID' }).expect(201);
  return respuesta.body.datos;
};
function offline(vinculacion) {
  const paso = Math.floor(Date.now() / 15000);
  const secreto = Buffer.from(vinculacion.secreto, 'base64url');
  return `upt_offline_v2.${vinculacion.dispositivo_id}.${paso}.${calcularOtpOffline(secreto, vinculacion.dispositivo_id, paso)}.${firmarPasoOffline(secreto, vinculacion.dispositivo_id, paso)}`;
}
const regla = (cambios = {}) => ({
  nombre: 'Horario ficticio de prueba', rol: 'ESTUDIANTE', estado_usuario: 'ACTIVO',
  accion: 'DENEGAR', punto_acceso_id: puerta.id, dias_semana: [1, 2, 3, 4, 5, 6, 7],
  hora_inicio: '00:00', hora_fin: '00:00', vigente_desde: '2020-01-01T00:00:00Z',
  vigente_hasta: null, activo: true, ...cambios,
});

before(async () => {
  process.env.CLAVE_QR_OFFLINE ??= randomBytes(32).toString('base64url');
  const hash = await bcrypt.hash(clave, 12);
  for (const [nombre, rol] of Object.entries({ admin: 'ADMINISTRADOR', guardia: 'SEGURIDAD', otro: 'SEGURIDAD', estudiante: 'ESTUDIANTE' })) {
    codigos[nombre] = `OPS-${nombre.toUpperCase()}-${sufijo}`;
    const usuario = await grupoConexiones.query(
      `INSERT INTO usuarios (codigo_institucional, correo_institucional, nombres, apellidos, foto_url,
       contrasena_hash, estado, estado_autorizacion, identidad_verificada, identidad_verificada_en)
       VALUES (?, ?, 'Persona', 'Ficticia', 'https://example.invalid/foto.png', ?, 'ACTIVO', 'AUTORIZADO', TRUE, CURRENT_TIMESTAMP(3))`,
      [codigos[nombre], `${codigos[nombre].toLowerCase()}@example.invalid`, hash],
    );
    ids[nombre] = usuario.insertId;
    await grupoConexiones.query('INSERT INTO usuarios_roles (usuario_id, rol_id) SELECT ?, id FROM roles WHERE nombre = ?', [usuario.insertId, rol]);
    assert.equal((await login(nombre)).status, 201);
  }
  const respuesta = await como('admin', request(app).post('/api/administracion/puntos-acceso'))
    .send({ codigo: `OPS-${sufijo}`, nombre: 'Puerta ficticia de operaciones', latitud: 2, longitud: 2, radio_permitido_metros: 100 }).expect(201);
  puerta = respuesta.body.datos;
  for (const nombre of ['guardia', 'otro']) {
    await grupoConexiones.query('INSERT INTO asignaciones_seguridad (usuario_id, punto_acceso_id, asignado_por) VALUES (?, ?, ?)', [ids[nombre], puerta.id, ids.admin]);
  }
});

after(async () => {
  const lista = Object.values(ids);
  const marcas = lista.map(() => '?').join(',');
  if (lista.length) {
    await grupoConexiones.query(`DELETE FROM incidencias_seguridad WHERE responsable_id IN (${marcas})`, lista);
    await grupoConexiones.query(`DELETE n FROM notificaciones_usuario n JOIN registros_acceso a ON a.id = n.registro_acceso_id WHERE a.usuario_seguridad_id IN (${marcas})`, lista);
    await grupoConexiones.query(`DELETE FROM registros_acceso WHERE usuario_seguridad_id IN (${marcas})`, lista);
    await grupoConexiones.query(`DELETE FROM reglas_acceso WHERE creado_por IN (${marcas})`, lista);
    await grupoConexiones.query(`DELETE FROM bloqueos_identidad WHERE creado_por IN (${marcas})`, lista);
    await grupoConexiones.query(`DELETE FROM turnos_seguridad WHERE usuario_seguridad_id IN (${marcas})`, lista);
    await grupoConexiones.query(`DELETE FROM asignaciones_seguridad WHERE usuario_id IN (${marcas})`, lista);
    await grupoConexiones.query(`DELETE u FROM usos_codigos_offline u JOIN dispositivos d ON d.id = u.dispositivo_id WHERE d.usuario_id IN (${marcas})`, lista);
    for (const tabla of ['credenciales_acceso', 'dispositivos', 'sesiones', 'intentos_inicio_sesion', 'usuarios_roles']) {
      await grupoConexiones.query(`DELETE FROM ${tabla} WHERE usuario_id IN (${marcas})`, lista);
    }
    await grupoConexiones.query(`DELETE FROM registros_auditoria WHERE usuario_actor_id IN (${marcas})`, lista);
    await grupoConexiones.query(`DELETE FROM usuarios WHERE id IN (${marcas})`, lista);
  }
  if (puerta) await grupoConexiones.query('DELETE FROM puntos_acceso WHERE id = ?', [puerta.id]);
  await grupoConexiones.end();
});

describe('Operaciones de seguridad y privacidad', { concurrency: false }, () => {
  it('protege las rutas de operación y administración por rol', async () => {
    await request(app).post('/api/seguridad/identidades/buscar').send({}).expect(401);
    await como('estudiante', request(app).post('/api/seguridad/identidades/buscar')).send({}).expect(403);
    await como('guardia', request(app).get('/api/administracion/reglas-acceso')).expect(403);
    await como('guardia', request(app).post(`/api/administracion/usuarios/${ids.estudiante}/bloqueos`)).send({}).expect(403);
    // Las nuevas rutas no deben interceptar el historial propio del estudiante.
    await como('estudiante', request(app).get('/api/ingresos/historial')).expect(200);
  });

  it('devuelve identidad mínima, fotografía y acción sin datos académicos ni secretos', async () => {
    const respuesta = await validar(await emitir()).expect(200);
    const datos = respuesta.body.datos;
    assert.equal(datos.puede_confirmar, true);
    assert.ok(Number.isInteger(datos.registro_id));
    assert.deepEqual(Object.keys(datos.identidad).sort(), ['foto_url', 'nombre_completo', 'codigo_institucional', 'tipo_usuario'].sort());
    assert.equal(datos.identidad.foto_url, 'https://example.invalid/foto.png');
    assert.ok(datos.accion_sugerida);
    assert.equal(respuesta.headers['cache-control'], 'no-store');
    const respuestaOffline = await validar(offline(await preparar())).expect(200);
    assert.equal(respuestaOffline.body.datos.puede_confirmar, true);
    assert.equal(Object.hasOwn(respuestaOffline.body.datos.identidad, 'escuela'), false);
    const denegada = await validar('qr-ficticio-invalido').expect(200);
    assert.equal(denegada.body.datos.puede_confirmar, false);
    assert.equal(Object.hasOwn(denegada.body.datos, 'identidad'), false);
    assert.ok(denegada.body.datos.accion_sugerida);
    assert.doesNotMatch(JSON.stringify(denegada.body), /latitud|longitud|otp|nonce|hash|secreto/iu);
  });

  it('no autoriza una identidad sin nombre y no consume el QR rechazado por datos incompletos', async () => {
    const codigo = await emitir();
    await grupoConexiones.query("UPDATE usuarios SET nombres = '', apellidos = '', nombre_institucional = '' WHERE id = ?", [ids.estudiante]);
    try {
      const respuesta = await validar(codigo).expect(200);
      assert.equal(respuesta.body.datos.motivo, 'DATOS_IDENTIDAD_INCOMPLETOS');
      assert.equal(respuesta.body.datos.puede_confirmar, false);
    } finally {
      await grupoConexiones.query("UPDATE usuarios SET nombres = 'Persona', apellidos = 'Ficticia' WHERE id = ?", [ids.estudiante]);
    }
    assert.equal((await validar(codigo).expect(200)).body.datos.resultado, 'AUTORIZADO');
  });

  it('consume el QR normal aunque la configuración histórica tenga false', async () => {
    await grupoConexiones.query("UPDATE configuraciones_sistema SET valor = 'false' WHERE clave = 'QR_UN_SOLO_USO'");
    try {
      const codigo = await emitir();
      await validar(codigo).expect(200);
      assert.equal((await validar(codigo).expect(200)).body.datos.motivo, 'CREDENCIAL_YA_UTILIZADA');
    } finally {
      await grupoConexiones.query("UPDATE configuraciones_sistema SET valor = 'true' WHERE clave = 'QR_UN_SOLO_USO'");
    }
  });

  it('busca exclusivamente por código o correo exactos, exige motivo y audita sin guardar el criterio literal', async () => {
    const buscar = (datos) => como('guardia', request(app).post('/api/seguridad/identidades/buscar')).send({ motivo: 'Verificación manual ficticia', ubicacion: ubicacion(), ...datos });
    const encontrado = await buscar({ codigo: codigos.estudiante }).expect(200);
    assert.equal(encontrado.body.datos.id, ids.estudiante);
    assert.equal(encontrado.body.datos.permite_ingreso, false);
    assert.equal(encontrado.body.datos.bloqueo_vigente, false);
    assert.doesNotMatch(JSON.stringify(encontrado.body), /escuela|academico|contrasena|secreto/iu);
    assert.equal((await buscar({ correo: `${codigos.estudiante.toLowerCase()}@example.invalid` }).expect(200)).body.datos.id, ids.estudiante);
    assert.equal((await buscar({ codigo: 'NO-EXISTE-FICTICIO' }).expect(200)).body.datos, null);
    await buscar({ codigo: codigos.estudiante, correo: 'otro@example.invalid' }).expect(400);
    await buscar({ codigo: '%' }).expect(400);
    await buscar({ codigo: codigos.estudiante, motivo: '' }).expect(400);
    await buscar({ codigo: codigos.estudiante, ubicacion: { ...ubicacion(), latitud: 20 } }).expect(403);
    const [auditoria] = await grupoConexiones.query("SELECT detalle FROM registros_auditoria WHERE usuario_actor_id = ? AND accion = 'BUSQUEDA_MANUAL_IDENTIDAD' ORDER BY id DESC LIMIT 1", [ids.guardia]);
    assert.doesNotMatch(JSON.stringify(auditoria), /NO-EXISTE-FICTICIO|@example.invalid/iu);
  });

  it('vincula incidencias a validaciones propias y evita duplicados por reintentos', async () => {
    const registro = (await validar('qr-ficticio-invalido').expect(200)).body.datos.registro_id;
    const datos = { tipo: 'PROBLEMA_QR', observacion: 'Observación ficticia de una validación', clave_idempotencia: randomUUID() };
    const ruta = `/api/ingresos/${registro}/incidencias`;
    const primera = await como('guardia', request(app).post(ruta)).send(datos).expect(201);
    assert.equal(primera.body.datos.responsable_id, ids.guardia);
    const repetida = await como('guardia', request(app).post(ruta)).send(datos).expect(200);
    assert.equal(repetida.body.datos.id, primera.body.datos.id);
    await como('guardia', request(app).post(ruta)).send({ ...datos, observacion: 'Otra observación ficticia distinta' }).expect(409);
    await como('otro', request(app).post(ruta)).send({ ...datos, clave_idempotencia: randomUUID() }).expect(404);
    await como('otro', request(app).get(ruta)).expect(404);
    await como('guardia', request(app).post(ruta)).send({ ...datos, responsable_id: ids.admin }).expect(400);
    assert.equal((await como('guardia', request(app).get(ruta)).expect(200)).body.datos.length, 1);
    assert.ok((await como('admin', request(app).get('/api/administracion/incidencias')).expect(200)).body.datos.some((i) => i.id === primera.body.datos.id));
  });

  it('registra turnos sin solaparse y filtra recientes por guardia, puerta y turno con identidad enmascarada', async () => {
    const turno = (await como('guardia', request(app).post('/api/seguridad/turnos')).send({ ubicacion: ubicacion() }).expect(201)).body.datos;
    await como('guardia', request(app).post('/api/seguridad/turnos')).send({ ubicacion: ubicacion() }).expect(409);
    assert.equal((await como('guardia', request(app).get('/api/seguridad/turnos/actual')).expect(200)).body.datos.id, turno.id);
    const acceso = (await validar(await emitir()).expect(200)).body.datos;
    assert.equal(acceso.turno_id, turno.id);
    const consulta = { ...ubicacion(), turno_id: turno.id, punto_acceso_codigo: puerta.codigo, limite: 1 };
    const recientes = await como('guardia', request(app).get('/api/ingresos/recientes')).query(consulta).expect(200);
    assert.equal(recientes.body.paginacion.total, 1);
    assert.equal(recientes.body.datos[0].id, acceso.registro_id);
    assert.ok(recientes.body.datos[0].usuario.codigo_enmascarado.startsWith('*'));
    assert.doesNotMatch(JSON.stringify(recientes.body), /nombre_completo|codigo_institucional|escuela|latitud|longitud/iu);
    await como('otro', request(app).get('/api/ingresos/recientes')).query(consulta).expect(404);
    await como('guardia', request(app).get('/api/ingresos/recientes')).query({ ...consulta, punto_acceso_codigo: 'OTRA-PUERTA' }).expect(403);
    await como('otro', request(app).post(`/api/seguridad/turnos/${turno.id}/cerrar`)).send({}).expect(404);
    await como('guardia', request(app).post(`/api/seguridad/turnos/${turno.id}/cerrar`)).send({}).expect(200);
    await como('guardia', request(app).post(`/api/seguridad/turnos/${turno.id}/cerrar`)).send({}).expect(200);
  });

  it('aplica reglas configurables a QR normal y offline y no consume el QR al denegar por regla', async () => {
    const datos = regla();
    await como('guardia', request(app).post('/api/administracion/reglas-acceso')).send(datos).expect(403);
    await como('admin', request(app).post('/api/administracion/reglas-acceso')).send({ ...datos, hora_inicio: '25:00' }).expect(400);
    const creada = (await como('admin', request(app).post('/api/administracion/reglas-acceso')).send(datos).expect(201)).body.datos;
    const codigo = await emitir();
    assert.equal((await validar(codigo).expect(200)).body.datos.motivo, 'REGLA_ACCESO_DENEGADA');
    const vinculo = await preparar();
    const codigoOffline = offline(vinculo);
    assert.equal((await validar(codigoOffline).expect(200)).body.datos.motivo, 'REGLA_ACCESO_DENEGADA');
    await como('admin', request(app).put(`/api/administracion/reglas-acceso/${creada.id}`)).send({ ...datos, activo: false }).expect(200);
    assert.equal((await validar(codigo).expect(200)).body.datos.resultado, 'AUTORIZADO');
    assert.equal((await validar(codigoOffline).expect(200)).body.datos.resultado, 'AUTORIZADO');
    const lima = new Date(Date.now() - 5 * 3600000);
    const otroDia = ((lima.getUTCDay() || 7) % 7) + 1;
    await como('admin', request(app).put(`/api/administracion/reglas-acceso/${creada.id}`)).send(regla({ accion: 'PERMITIR', dias_semana: [otroDia] })).expect(200);
    assert.equal((await validar(await emitir()).expect(200)).body.datos.motivo, 'FUERA_HORARIO_PERMITIDO');
    await como('admin', request(app).put(`/api/administracion/reglas-acceso/${creada.id}`)).send({ ...datos, activo: false }).expect(200);
  });

  it('bloquea con motivo y vigencia, revoca sesiones y dispositivo, rehabilita sin reactivar credenciales', async () => {
    const ruta = `/api/administracion/usuarios/${ids.estudiante}/bloqueos`;
    const datos = { motivo: 'Restricción ficticia para prueba', vigente_hasta: new Date(Date.now() + 3600000).toISOString(), confirmacion: true };
    const previo = await preparar();
    await como('admin', request(app).post(ruta)).send({ ...datos, confirmacion: false }).expect(400);
    const bloqueo = (await como('admin', request(app).post(ruta)).send(datos).expect(201)).body.datos;
    assert.equal(bloqueo.creado_por, ids.admin);
    await como('admin', request(app).post(ruta)).send(datos).expect(409);
    await como('estudiante', request(app).get('/api/autenticacion/sesion')).expect(401);
    assert.equal((await login('estudiante')).body.error.codigo, 'IDENTIDAD_BLOQUEADA');
    assert.equal((await validar(offline(previo)).expect(200)).body.datos.motivo, 'DISPOSITIVO_NO_VINCULADO');
    await como('admin', request(app).post(`${ruta}/${bloqueo.id}/rehabilitar`)).send({ motivo: 'Revisión ficticia completada', confirmacion: true }).expect(200);
    assert.equal((await login('estudiante')).status, 201);
    assert.equal((await validar(offline(previo)).expect(200)).body.datos.motivo, 'DISPOSITIVO_NO_VINCULADO');
    const segundo = (await como('admin', request(app).post(ruta)).send(datos).expect(201)).body.datos;
    await grupoConexiones.query('UPDATE bloqueos_identidad SET vigente_desde = TIMESTAMPADD(HOUR, -2, CURRENT_TIMESTAMP(3)), vigente_hasta = TIMESTAMPADD(HOUR, -1, CURRENT_TIMESTAMP(3)) WHERE id = ?', [segundo.id]);
    assert.equal((await login('estudiante')).status, 201);
    const [usuario] = await grupoConexiones.query('SELECT estado FROM usuarios WHERE id = ?', [ids.estudiante]);
    assert.equal(usuario.estado, 'ACTIVO');
    const historial = await como('admin', request(app).get(ruta)).expect(200);
    assert.ok(historial.body.datos.some((b) => b.id === bloqueo.id && b.motivo_rehabilitacion));
    await como('admin', request(app).post(`/api/administracion/usuarios/${ids.admin}/bloqueos`)).send(datos).expect(409);
  });

  it('limita reglas por vigencia, rol y estado y da prioridad a una denegación aplicable', async () => {
    const crear = async (datos) => (await como('admin', request(app).post('/api/administracion/reglas-acceso')).send(datos).expect(201)).body.datos.id;
    const filas = [];
    try {
      filas.push(await crear(regla({ vigente_desde: '2099-01-01T00:00:00Z' })));
      filas.push(await crear(regla({ rol: 'DOCENTE' })));
      filas.push(await crear(regla({ estado_usuario: 'INACTIVO' })));
      assert.equal((await validar(await emitir()).expect(200)).body.datos.resultado, 'AUTORIZADO');
      filas.push(await crear(regla({ accion: 'PERMITIR' })));
      filas.push(await crear(regla({ punto_acceso_id: null })));
      assert.equal((await validar(await emitir()).expect(200)).body.datos.motivo, 'REGLA_ACCESO_DENEGADA');
      const lista = await como('admin', request(app).get('/api/administracion/reglas-acceso')).expect(200);
      assert.ok(lista.body.datos.every((r) => typeof r.activo === 'boolean' && Array.isArray(r.dias_semana)));
    } finally {
      for (const fila of filas) await como('admin', request(app).put(`/api/administracion/reglas-acceso/${fila}`)).send(regla({ activo: false })).expect(200);
    }
  });

  it('rechaza en ambos formatos un bloqueo vigente aunque se conserve una credencial activa', async () => {
    // Simula una credencial retenida por una réplica anterior: además de
    // revocar al crear el bloqueo, la decisión debe evaluar su vigencia.
    const codigo = await emitir();
    const vinculo = await preparar();
    const bloqueo = await grupoConexiones.query('INSERT INTO bloqueos_identidad (usuario_id, motivo, creado_por) VALUES (?, ?, ?)', [ids.estudiante, 'Bloqueo ficticio de compatibilidad', ids.admin]);
    try {
      assert.equal((await validar(codigo).expect(200)).body.datos.motivo, 'IDENTIDAD_BLOQUEADA');
      assert.equal((await validar(offline(vinculo)).expect(200)).body.datos.motivo, 'IDENTIDAD_BLOQUEADA');
    } finally {
      await grupoConexiones.query('UPDATE bloqueos_identidad SET rehabilitado_en = CURRENT_TIMESTAMP(3), rehabilitado_por = ? WHERE id = ?', [ids.admin, bloqueo.insertId]);
    }
  });

  it('serializa inicios de turno y reintentos de incidencia simultáneos', async () => {
    const turnos = await Promise.all(Array.from({ length: 2 }, () => como('guardia', request(app).post('/api/seguridad/turnos')).send({ ubicacion: ubicacion() })));
    assert.deepEqual(turnos.map((r) => r.status).sort(), [201, 409]);
    const registro = (await validar('qr-concurrente-ficticio').expect(200)).body.datos.registro_id;
    const datos = { tipo: 'OTRA', observacion: 'Incidencia concurrente ficticia', clave_idempotencia: randomUUID() };
    const incidencias = await Promise.all(Array.from({ length: 2 }, () => como('guardia', request(app).post(`/api/ingresos/${registro}/incidencias`)).send(datos)));
    assert.deepEqual(incidencias.map((r) => r.status).sort(), [200, 201]);
    assert.equal(incidencias[0].body.datos.id, incidencias[1].body.datos.id);
    await como('guardia', request(app).post(`/api/seguridad/turnos/${turnos.find((t) => t.status === 201).body.datos.id}/cerrar`)).send({}).expect(200);
  });

  it('limita las búsquedas manuales por operador en base de datos', async () => {
    let limitada = false;
    for (let indice = 0; indice < 21; indice += 1) {
      const respuesta = await como('guardia', request(app).post('/api/seguridad/identidades/buscar'))
        .send({ codigo: codigos.estudiante, motivo: 'Control ficticio de límite', ubicacion: ubicacion() });
      if (respuesta.status === 429) { limitada = true; break; }
      assert.equal(respuesta.status, 200);
    }
    assert.equal(limitada, true);
  });
});

it('interpreta límites horarios y cruce de medianoche con días ISO de Lima', () => {
  const horario = { dias_semana: [1], hora_inicio: '22:00', hora_fin: '06:00' };
  assert.equal(coincideHorario(horario, new Date('2026-10-27T04:00:00Z')), true); // Lunes 23:00.
  assert.equal(coincideHorario(horario, new Date('2026-10-27T10:59:00Z')), true); // Martes 05:59.
  assert.equal(coincideHorario(horario, new Date('2026-10-27T11:00:00Z')), false);
  assert.equal(coincideHorario({ ...horario, hora_inicio: '08:00', hora_fin: '10:00' }, new Date('2026-10-26T13:00:00Z')), true);
});

it('no registra SQL, parámetros ni query strings sensibles en los logs de errores o solicitudes', () => {
  crearAplicacion({ entornoEjecucion: 'test', registrarSolicitudes: true });
  assert.equal(morgan['ruta-segura']({ route: { path: '/usuarios/:id' }, originalUrl: '/usuarios/42?correo=privado@example.invalid' }), '/usuarios/:id');
  const original = console.error;
  let registrado;
  console.error = (dato) => { registrado = dato; };
  try {
    manejarErrores(Object.assign(new Error('SQL contraseña y secreto'), { sql: 'correo privado' }), {}, { status: () => ({ json: () => {} }) }, () => {});
  } finally { console.error = original; }
  assert.deepEqual(registrado, { codigo: 'ERROR_INTERNO', tipo: 'Error' });
});
