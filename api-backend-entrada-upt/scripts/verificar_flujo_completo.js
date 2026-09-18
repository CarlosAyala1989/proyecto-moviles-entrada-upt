import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

const directorioBackend = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const directorioCliente = path.resolve(
  directorioBackend,
  '../paquetes/cliente_api_upt',
);

const sufijoEjecucion = randomBytes(4).toString('hex').toUpperCase();
const codigos = {
  administrador: `FLUJO-E2E-ADMIN-${sufijoEjecucion}`,
  portador: `FLUJO-E2E-PORTADOR-${sufijoEjecucion}`,
  seguridad: `FLUJO-E2E-SEGURIDAD-${sufijoEjecucion}`,
  punto: `FLUJO-E2E-PUNTO-${sufijoEjecucion}`,
};
const contrasenas = {
  administrador: 'Flujo-Admin-Seguro!2026',
  portadorInicial: 'Flujo-Portador-Inicial!2026',
  portadorFinal: 'Flujo-Portador-Renovado!2026',
  seguridad: 'Flujo-Seguridad-Seguro!2026',
};
const ubicacionPrueba = {
  latitud: -17.654321,
  longitud: -70.123456,
};

const rutasEsperadas = new Set([
  'GET /api',
  'GET /api/salud',
  'GET /api/health',
  'POST /api/autenticacion/iniciar-sesion',
  'POST /api/autenticacion/renovar-sesion',
  'GET /api/autenticacion/sesion',
  'POST /api/autenticacion/cerrar-sesion',
  'GET /api/identidad-digital',
  'POST /api/codigos-qr',
  'GET /api/codigos-qr/actual',
  'DELETE /api/codigos-qr/actual',
  'POST /api/ingresos/validar',
  'GET /api/ingresos/recientes',
  'GET /api/administracion/roles',
  'GET /api/administracion/usuarios',
  'POST /api/administracion/usuarios',
  'GET /api/administracion/usuarios/:id',
  'PATCH /api/administracion/usuarios/:id',
  'PATCH /api/administracion/usuarios/:id/estado',
  'PUT /api/administracion/usuarios/:id/roles',
  'PUT /api/administracion/usuarios/:id/credencial-local',
  'GET /api/administracion/resumen',
  'GET /api/administracion/accesos',
  'GET /api/administracion/accesos/:id',
  'GET /api/administracion/puntos-acceso',
  'POST /api/administracion/puntos-acceso',
  'PATCH /api/administracion/puntos-acceso/:id',
  'GET /api/administracion/auditoria',
  'GET /api/administracion/configuraciones',
  'PUT /api/administracion/configuraciones/:clave',
]);

const rutasVerificadas = new Set();
let servidor;
let urlRaiz;
let configuracionOriginal;
let administradorId;
let configuracionTocada = false;

function marcadores(cantidad) {
  return Array.from({ length: cantidad }, () => '?').join(', ');
}

async function obtenerDatosExistentes() {
  const codigosUsuario = [
    codigos.administrador,
    codigos.portador,
    codigos.seguridad,
  ];
  const usuarios = await grupoConexiones.query(
    `SELECT id FROM usuarios
     WHERE codigo_institucional IN (${marcadores(codigosUsuario.length)})`,
    codigosUsuario,
  );
  const puntos = await grupoConexiones.query(
    'SELECT id FROM puntos_acceso WHERE codigo = ?',
    [codigos.punto],
  );
  return {
    usuarios: usuarios.map(({ id }) => id),
    puntos: puntos.map(({ id }) => id),
  };
}

async function limpiarDatosPrueba() {
  const { usuarios, puntos } = await obtenerDatosExistentes();

  if (usuarios.length > 0 || puntos.length > 0) {
    const condiciones = [];
    const parametros = [];
    if (usuarios.length > 0) {
      const lista = marcadores(usuarios.length);
    await grupoConexiones.query(`DELETE FROM asignaciones_seguridad WHERE usuario_id IN (${lista}) OR asignado_por IN (${lista})`, [...usuarios, ...usuarios]);
      condiciones.push(`usuario_id IN (${lista})`);
      parametros.push(...usuarios);
      condiciones.push(`usuario_seguridad_id IN (${lista})`);
      parametros.push(...usuarios);
    }
    if (puntos.length > 0) {
      condiciones.push(`punto_acceso_id IN (${marcadores(puntos.length)})`);
      parametros.push(...puntos);
    }
    await grupoConexiones.query(
      `DELETE FROM registros_acceso WHERE ${condiciones.join(' OR ')}`,
      parametros,
    );
  }

  if (usuarios.length > 0) {
    const lista = marcadores(usuarios.length);
    await grupoConexiones.query(`DELETE FROM asignaciones_seguridad WHERE usuario_id IN (${lista}) OR asignado_por IN (${lista})`, [...usuarios, ...usuarios]);
    await grupoConexiones.query(
      `UPDATE configuraciones_sistema SET actualizado_por = NULL
       WHERE actualizado_por IN (${lista})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM registros_auditoria
       WHERE usuario_actor_id IN (${lista})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM credenciales_acceso WHERE usuario_id IN (${lista})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM sesiones WHERE usuario_id IN (${lista})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM intentos_inicio_sesion WHERE usuario_id IN (${lista})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM dispositivos WHERE usuario_id IN (${lista})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM perfiles_academicos WHERE usuario_id IN (${lista})`,
      usuarios,
    );
    await grupoConexiones.query(
      `DELETE FROM usuarios_roles
       WHERE usuario_id IN (${lista}) OR asignado_por IN (${lista})`,
      [...usuarios, ...usuarios],
    );
    await grupoConexiones.query(
      `DELETE FROM usuarios WHERE id IN (${lista})`,
      usuarios,
    );
  }

  if (puntos.length > 0) {
    await grupoConexiones.query(
      `DELETE FROM puntos_acceso WHERE id IN (${marcadores(puntos.length)})`,
      puntos,
    );
  }
}

async function crearAdministrador() {
  const contrasenaHash = await bcrypt.hash(contrasenas.administrador, 12);
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
    ) VALUES (?, ?, ?, 'Administrador', 'Flujo E2E',
      'Administrador del flujo completo', 'ACTIVO', 'AUTORIZADO', TRUE,
      CURRENT_TIMESTAMP(3))`,
    [
      codigos.administrador,
      `flujo-e2e-admin-${sufijoEjecucion.toLowerCase()}@example.invalid`,
      contrasenaHash,
    ],
  );
  await grupoConexiones.query(
    `INSERT INTO usuarios_roles (usuario_id, rol_id)
     SELECT ?, id FROM roles WHERE nombre = 'ADMINISTRADOR'`,
    [resultado.insertId],
  );
  administradorId = resultado.insertId;
}

async function iniciarServidor() {
  const aplicacion = crearAplicacion({ entornoEjecucion: 'test' });
  servidor = aplicacion.listen(0, '127.0.0.1');
  await new Promise((resolver, rechazar) => {
    servidor.once('listening', resolver);
    servidor.once('error', rechazar);
  });
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion === 'object');
  urlRaiz = `http://127.0.0.1:${direccion.port}`;
}

async function cerrarServidor() {
  if (!servidor) return;
  await new Promise((resolver, rechazar) => {
    servidor.close((error) => (error ? rechazar(error) : resolver()));
  });
}

async function solicitar({
  metodo = 'GET',
  ruta,
  idRuta = `${metodo} ${ruta}`,
  token,
  cuerpo,
  estado = 200,
  registrar = true,
}) {
  const respuesta = await fetch(`${urlRaiz}${ruta}`, {
    method: metodo,
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  const texto = await respuesta.text();
  let contenido = null;
  if (texto) {
    try {
      contenido = JSON.parse(texto);
    } catch {
      contenido = texto;
    }
  }
  assert.equal(
    respuesta.status,
    estado,
    `${metodo} ${ruta} devolvió ${respuesta.status}: ${texto}`,
  );
  if (registrar) {
    assert.ok(rutasEsperadas.has(idRuta), `Ruta no catalogada: ${idRuta}`);
    rutasVerificadas.add(idRuta);
    console.log(`[OK] ${idRuta} -> ${estado}`);
  }
  return contenido;
}

function ubicacionActual() {
  return {
    ...ubicacionPrueba,
    precision_metros: 5,
    obtenida_en: new Date().toISOString(),
  };
}

async function iniciarSesion(identificador, contrasena) {
  const respuesta = await solicitar({
    metodo: 'POST',
    ruta: '/api/autenticacion/iniciar-sesion',
    cuerpo: { identificador, contrasena },
    estado: 201,
  });
  assert.equal(respuesta.datos.usuario.codigo_institucional, identificador);
  assert.ok(respuesta.datos.token_acceso);
  assert.ok(respuesta.datos.token_renovacion);
  return respuesta.datos;
}

async function ejecutarClienteDart() {
  console.log('\nEjecutando el mismo flujo móvil con ClienteApi (Dart)...');
  const argumentos = [
    'test',
    '--no-pub',
    '--reporter',
    'expanded',
    `--dart-define=URL_API_INTEGRACION=${urlRaiz}/api`,
    `--dart-define=USUARIO_PORTADOR_INTEGRACION=${codigos.portador}`,
    `--dart-define=CONTRASENA_PORTADOR_INTEGRACION=${contrasenas.portadorFinal}`,
    `--dart-define=USUARIO_SEGURIDAD_INTEGRACION=${codigos.seguridad}`,
    `--dart-define=CONTRASENA_SEGURIDAD_INTEGRACION=${contrasenas.seguridad}`,
    `--dart-define=PUNTO_ACCESO_INTEGRACION=${codigos.punto}`,
    'integracion/flujo_movil_backend_test.dart',
  ];
  const codigoSalida = await new Promise((resolver, rechazar) => {
    const procesoFlutter = spawn('flutter', argumentos, {
      cwd: directorioCliente,
      env: process.env,
      stdio: 'inherit',
    });
    procesoFlutter.once('error', rechazar);
    procesoFlutter.once('exit', (codigo) => resolver(codigo));
  });
  assert.equal(codigoSalida, 0, 'El flujo real ejecutado por ClienteApi falló.');
}

async function ejecutarFlujoHttp() {
  const raiz = await solicitar({ ruta: '/api' });
  assert.equal(raiz.nombre, 'API Entrada UPT');
  const salud = await solicitar({ ruta: '/api/salud' });
  assert.equal(salud.estado, 'correcto');
  const health = await solicitar({ ruta: '/api/health' });
  assert.equal(health.estado, 'correcto');

  const sesionAdministradorInicial = await iniciarSesion(
    codigos.administrador,
    contrasenas.administrador,
  );
  const renovacion = await solicitar({
    metodo: 'POST',
    ruta: '/api/autenticacion/renovar-sesion',
    cuerpo: {
      token_renovacion: sesionAdministradorInicial.token_renovacion,
    },
  });
  const tokenAdministrador = renovacion.datos.token_acceso;
  assert.notEqual(tokenAdministrador, sesionAdministradorInicial.token_acceso);
  await solicitar({
    ruta: '/api/autenticacion/sesion',
    token: sesionAdministradorInicial.token_acceso,
    estado: 401,
    registrar: false,
  });
  const sesionActual = await solicitar({
    ruta: '/api/autenticacion/sesion',
    token: tokenAdministrador,
  });
  assert.equal(
    sesionActual.datos.usuario.codigo_institucional,
    codigos.administrador,
  );

  const roles = await solicitar({
    ruta: '/api/administracion/roles',
    token: tokenAdministrador,
  });
  assert.ok(roles.datos.some(({ nombre }) => nombre === 'ESTUDIANTE'));
  assert.ok(roles.datos.some(({ nombre }) => nombre === 'SEGURIDAD'));

  const portadorCreado = await solicitar({
    metodo: 'POST',
    ruta: '/api/administracion/usuarios',
    token: tokenAdministrador,
    estado: 201,
    cuerpo: {
      codigo_institucional: codigos.portador,
      correo_institucional:
        `flujo-e2e-portador-${sufijoEjecucion.toLowerCase()}@example.invalid`,
      nombres: 'Portador',
      apellidos: 'Flujo E2E',
      nombre_institucional: 'Portador del flujo completo',
      estado: 'ACTIVO',
      estado_autorizacion: 'AUTORIZADO',
      identidad_verificada: true,
      contrasena: contrasenas.portadorInicial,
      roles: ['ESTUDIANTE'],
    },
  });
  const portadorId = portadorCreado.datos.id;

  const seguridadCreado = await solicitar({
    metodo: 'POST',
    ruta: '/api/administracion/usuarios',
    token: tokenAdministrador,
    estado: 201,
    cuerpo: {
      codigo_institucional: codigos.seguridad,
      correo_institucional:
        `flujo-e2e-seguridad-${sufijoEjecucion.toLowerCase()}@example.invalid`,
      nombres: 'Seguridad',
      apellidos: 'Flujo E2E',
      nombre_institucional: 'Verificador del flujo completo',
      estado: 'ACTIVO',
      estado_autorizacion: 'AUTORIZADO',
      identidad_verificada: true,
      contrasena: contrasenas.seguridad,
      roles: ['SEGURIDAD'],
    },
  });
  assert.ok(seguridadCreado.datos.id);

  const usuarios = await solicitar({
    ruta: `/api/administracion/usuarios?buscar=${codigos.portador}&pagina=1&limite=10`,
    idRuta: 'GET /api/administracion/usuarios',
    token: tokenAdministrador,
  });
  assert.equal(usuarios.datos.length, 1);
  assert.equal(usuarios.paginacion.total, 1);

  const usuario = await solicitar({
    ruta: `/api/administracion/usuarios/${portadorId}`,
    idRuta: 'GET /api/administracion/usuarios/:id',
    token: tokenAdministrador,
  });
  assert.equal(usuario.datos.codigo_institucional, codigos.portador);

  const usuarioActualizado = await solicitar({
    metodo: 'PATCH',
    ruta: `/api/administracion/usuarios/${portadorId}`,
    idRuta: 'PATCH /api/administracion/usuarios/:id',
    token: tokenAdministrador,
    cuerpo: { nombre_intranet: 'Portador actualizado por flujo E2E' },
  });
  assert.equal(
    usuarioActualizado.datos.nombre_intranet,
    'Portador actualizado por flujo E2E',
  );

  const estadoUsuario = await solicitar({
    metodo: 'PATCH',
    ruta: `/api/administracion/usuarios/${portadorId}/estado`,
    idRuta: 'PATCH /api/administracion/usuarios/:id/estado',
    token: tokenAdministrador,
    cuerpo: {
      estado: 'ACTIVO',
      estado_autorizacion: 'AUTORIZADO',
      identidad_verificada: true,
    },
  });
  assert.equal(estadoUsuario.datos.identidad_verificada, true);

  const rolesUsuario = await solicitar({
    metodo: 'PUT',
    ruta: `/api/administracion/usuarios/${portadorId}/roles`,
    idRuta: 'PUT /api/administracion/usuarios/:id/roles',
    token: tokenAdministrador,
    cuerpo: { roles: ['ESTUDIANTE', 'DOCENTE'] },
  });
  assert.deepEqual(
    new Set(rolesUsuario.datos.roles),
    new Set(['ESTUDIANTE', 'DOCENTE']),
  );

  await solicitar({
    metodo: 'PUT',
    ruta: `/api/administracion/usuarios/${portadorId}/credencial-local`,
    idRuta: 'PUT /api/administracion/usuarios/:id/credencial-local',
    token: tokenAdministrador,
    cuerpo: { contrasena: contrasenas.portadorFinal },
    estado: 204,
  });

  const puntoCreado = await solicitar({
    metodo: 'POST',
    ruta: '/api/administracion/puntos-acceso',
    token: tokenAdministrador,
    cuerpo: {
      codigo: codigos.punto,
      nombre: 'Punto del flujo E2E',
      descripcion: 'Punto temporal de integración',
      ...ubicacionPrueba,
      radio_permitido_metros: 150,
      estado: 'ACTIVO',
    },
    estado: 201,
  });
  const puntoId = puntoCreado.datos.id;
  await grupoConexiones.query(`INSERT INTO asignaciones_seguridad (usuario_id, punto_acceso_id, asignado_por) SELECT u.id, ?, a.id FROM usuarios u JOIN usuarios a ON a.codigo_institucional = ? WHERE u.codigo_institucional = ?`, [puntoId, codigos.administrador, codigos.seguridad]);
  const puntoActualizado = await solicitar({
    metodo: 'PATCH',
    ruta: `/api/administracion/puntos-acceso/${puntoId}`,
    idRuta: 'PATCH /api/administracion/puntos-acceso/:id',
    token: tokenAdministrador,
    cuerpo: { descripcion: 'Punto validado por el flujo E2E' },
  });
  assert.equal(
    puntoActualizado.datos.descripcion,
    'Punto validado por el flujo E2E',
  );
  const puntos = await solicitar({
    ruta: `/api/administracion/puntos-acceso?buscar=${codigos.punto}&estado=ACTIVO`,
    idRuta: 'GET /api/administracion/puntos-acceso',
    token: tokenAdministrador,
  });
  assert.equal(puntos.datos.length, 1);

  const configuraciones = await solicitar({
    ruta: '/api/administracion/configuraciones',
    token: tokenAdministrador,
  });
  const duracionActual = configuraciones.datos.find(
    ({ clave }) => clave === 'DURACION_QR_SEGUNDOS',
  );
  assert.ok(duracionActual);
  const duracionPrueba = duracionActual.valor;
  // Se marca antes: una desconexión podría ocurrir después del commit del PUT.
  configuracionTocada = true;
  const configuracionActualizada = await solicitar({
    metodo: 'PUT',
    ruta: '/api/administracion/configuraciones/DURACION_QR_SEGUNDOS',
    idRuta: 'PUT /api/administracion/configuraciones/:clave',
    token: tokenAdministrador,
    // Ejercita el PUT sin cambiar el valor operativo que observan otros procesos.
    cuerpo: { valor: duracionPrueba },
  });
  assert.equal(configuracionActualizada.datos.valor, duracionPrueba);

  const sesionPortador = await iniciarSesion(
    codigos.portador,
    contrasenas.portadorFinal,
  );
  const sesionSeguridad = await iniciarSesion(
    codigos.seguridad,
    contrasenas.seguridad,
  );

  const identidad = await solicitar({
    ruta: '/api/identidad-digital',
    token: sesionPortador.token_acceso,
  });
  assert.equal(identidad.datos.codigo_institucional, codigos.portador);
  assert.deepEqual(
    new Set(identidad.datos.roles),
    new Set(['ESTUDIANTE', 'DOCENTE']),
  );

  const qr = await solicitar({
    metodo: 'POST',
    ruta: '/api/codigos-qr',
    token: sesionPortador.token_acceso,
    cuerpo: { ubicacion: ubicacionActual() },
    estado: 201,
  });
  assert.equal(qr.datos.duracion_segundos, duracionPrueba);
  assert.equal(
    Date.parse(qr.datos.expira_en) - Date.parse(qr.datos.emitida_en),
    duracionPrueba * 1000,
    'La vigencia serializada del QR no coincide con la configurada.',
  );
  const segundosRestantes = (Date.parse(qr.datos.expira_en) - Date.now()) / 1000;
  assert.ok(
    segundosRestantes > duracionPrueba - 5
      && segundosRestantes <= duracionPrueba + 1,
    `El QR llegó con una vigencia anómala de ${segundosRestantes}s.`,
  );

  const qrActual = await solicitar({
    ruta: '/api/codigos-qr/actual',
    token: sesionPortador.token_acceso,
  });
  assert.equal(qrActual.datos.estado, 'PENDIENTE');

  const validacion = await solicitar({
    metodo: 'POST',
    ruta: '/api/ingresos/validar',
    token: sesionSeguridad.token_acceso,
    cuerpo: {
      codigo_qr: qr.datos.codigo_qr,
      punto_acceso_codigo: codigos.punto,
      ubicacion: ubicacionActual(),
    },
  });
  assert.equal(validacion.datos.resultado, 'AUTORIZADO');
  assert.equal(
    validacion.datos.identidad.codigo_institucional,
    codigos.portador,
  );

  const reuso = await solicitar({
    metodo: 'POST',
    ruta: '/api/ingresos/validar',
    token: sesionSeguridad.token_acceso,
    cuerpo: {
      codigo_qr: qr.datos.codigo_qr,
      punto_acceso_codigo: codigos.punto,
      ubicacion: ubicacionActual(),
    },
  });
  assert.equal(reuso.datos.resultado, 'DENEGADO');
  assert.equal(reuso.datos.motivo, 'CREDENCIAL_YA_UTILIZADA');

  const recientes = await solicitar({
    ruta: `/api/ingresos/recientes?limite=10&${new URLSearchParams(ubicacionActual())}`,
    idRuta: 'GET /api/ingresos/recientes',
    token: sesionSeguridad.token_acceso,
  });
  assert.ok(recientes.datos.some(({ resultado }) => resultado === 'AUTORIZADO'));
  assert.ok(recientes.datos.some(({ resultado }) => resultado === 'DENEGADO'));

  const accesos = await solicitar({
    ruta: `/api/administracion/accesos?usuario_id=${portadorId}&pagina=1&limite=10`,
    idRuta: 'GET /api/administracion/accesos',
    token: tokenAdministrador,
  });
  assert.ok(accesos.datos.length >= 2);
  const accesoId = accesos.datos[0].id;
  const acceso = await solicitar({
    ruta: `/api/administracion/accesos/${accesoId}`,
    idRuta: 'GET /api/administracion/accesos/:id',
    token: tokenAdministrador,
  });
  assert.equal(acceso.datos.id, accesoId);

  const resumen = await solicitar({
    ruta: '/api/administracion/resumen',
    token: tokenAdministrador,
  });
  assert.ok(Number.isInteger(resumen.datos.usuarios_total));

  const auditoria = await solicitar({
    ruta: `/api/administracion/auditoria?usuario_actor_id=${portadorId}&pagina=1&limite=20`,
    idRuta: 'GET /api/administracion/auditoria',
    token: tokenAdministrador,
  });
  assert.ok(auditoria.datos.some(({ accion }) => accion === 'CODIGO_QR_GENERADO'));

  await solicitar({
    metodo: 'POST',
    ruta: '/api/codigos-qr',
    token: sesionPortador.token_acceso,
    cuerpo: { ubicacion: ubicacionActual() },
    estado: 201,
  });
  await solicitar({
    metodo: 'DELETE',
    ruta: '/api/codigos-qr/actual',
    token: sesionPortador.token_acceso,
    estado: 204,
  });
  const qrRevocado = await solicitar({
    ruta: '/api/codigos-qr/actual',
    token: sesionPortador.token_acceso,
  });
  assert.equal(qrRevocado.datos.estado, 'REVOCADA');

  await ejecutarClienteDart();

  await solicitar({
    metodo: 'POST',
    ruta: '/api/autenticacion/cerrar-sesion',
    token: sesionPortador.token_acceso,
    estado: 204,
  });
  await solicitar({
    metodo: 'POST',
    ruta: '/api/autenticacion/cerrar-sesion',
    token: sesionSeguridad.token_acceso,
    estado: 204,
  });
  await solicitar({
    metodo: 'POST',
    ruta: '/api/autenticacion/cerrar-sesion',
    token: tokenAdministrador,
    estado: 204,
  });

  assert.deepEqual(
    [...rutasVerificadas].sort(),
    [...rutasEsperadas].sort(),
    'El flujo no cubrió exactamente todas las rutas publicadas.',
  );
}

async function preparar() {
  await limpiarDatosPrueba();
  [configuracionOriginal] = await grupoConexiones.query(
    `SELECT valor, actualizado_por, actualizado_en
     FROM configuraciones_sistema WHERE clave = 'DURACION_QR_SEGUNDOS'`,
  );
  assert.ok(configuracionOriginal, 'Falta la configuración DURACION_QR_SEGUNDOS.');
  await crearAdministrador();
  await iniciarServidor();
}

async function restaurar() {
  if (configuracionOriginal && configuracionTocada && administradorId) {
    const restauracion = await grupoConexiones.query(
      `UPDATE configuraciones_sistema
       SET valor = ?, actualizado_por = ?, actualizado_en = ?
       WHERE clave = 'DURACION_QR_SEGUNDOS'
         AND valor = ?
         AND actualizado_por = ?`,
      [
        configuracionOriginal.valor,
        configuracionOriginal.actualizado_por,
        configuracionOriginal.actualizado_en,
        String(configuracionOriginal.valor),
        administradorId,
      ],
    );
    if (restauracion.affectedRows !== 1) {
      console.warn(
        'No se restauró la metainformación de DURACION_QR_SEGUNDOS porque cambió concurrentemente.',
      );
    }
  }
  await limpiarDatosPrueba();
}

let errorPrincipal;
try {
  await preparar();
  await ejecutarFlujoHttp();
  console.log(`\nFlujo completo correcto: ${rutasVerificadas.size} endpoints verificados.`);
} catch (error) {
  errorPrincipal = error;
  console.error('\nFalló el flujo completo:', error);
  process.exitCode = 1;
} finally {
  try {
    await cerrarServidor();
    await restaurar();
  } catch (errorLimpieza) {
    console.error('También falló la limpieza del flujo:', errorLimpieza);
    process.exitCode = 1;
    if (!errorPrincipal) errorPrincipal = errorLimpieza;
  } finally {
    await grupoConexiones.end();
  }
}
