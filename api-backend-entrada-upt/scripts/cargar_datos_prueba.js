import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutarArchivoSql } from '../src/base_datos/archivo_sql.js';
import { grupoConexiones } from '../src/config/database.js';
import { entorno } from '../src/config/env.js';

const directorioActual = path.dirname(fileURLToPath(import.meta.url));
const rutaSemilla = path.resolve(directorioActual, '../semillas/datos_prueba.sql');

async function cargarDatosPrueba() {
  if (entorno.nodeEnv === 'production') {
    throw new Error('No se permite cargar datos de prueba en producción.');
  }

  const conexion = await grupoConexiones.getConnection();
  try {
    await conexion.beginTransaction();
    await ejecutarArchivoSql(conexion, rutaSemilla);
    await conexion.commit();
    console.log('Datos ficticios de prueba cargados correctamente.');
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
    await grupoConexiones.end();
  }
}

cargarDatosPrueba().catch((error) => {
  console.error('No se pudieron cargar los datos de prueba:', error.message);
  process.exitCode = 1;
});
