import { grupoConexiones } from '../src/config/database.js';
import { entorno } from '../src/config/env.js';

const tablasRequeridas = [
  'configuraciones_sistema',
  'credenciales_acceso',
  'dispositivos',
  'intentos_inicio_sesion',
  'migraciones_aplicadas',
  'perfiles_academicos',
  'puntos_acceso',
  'registros_acceso',
  'registros_auditoria',
  'roles',
  'sesiones',
  'usuarios',
  'usuarios_roles',
];

try {
  const [servidor] = await grupoConexiones.query(
    'SELECT DATABASE() AS base_datos, VERSION() AS version',
  );
  const tablas = await grupoConexiones.query('SHOW TABLES');
  const nombres = new Set(tablas.map((tabla) => Object.values(tabla)[0]));
  const faltantes = tablasRequeridas.filter((nombre) => !nombres.has(nombre));

  console.log(`Conexión correcta: ${entorno.db.host}:${entorno.db.port}`);
  console.log(`Base de datos: ${servidor.base_datos}; servidor: ${servidor.version}`);
  if (faltantes.length > 0) {
    console.error(`Faltan tablas requeridas: ${faltantes.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('Las 13 tablas requeridas están disponibles.');
  }
} catch (error) {
  const codigo = error.cause?.code ?? error.code ?? 'ERROR_CONEXION';
  console.error(`No se pudo conectar a la base de datos (${codigo}).`);
  console.error('Revisa las variables DB_ de la API y la red compartida con MySQL.');
  process.exitCode = 1;
} finally {
  await grupoConexiones.end();
}
