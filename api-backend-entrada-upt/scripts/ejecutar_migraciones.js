import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { grupoConexiones } from '../src/config/database.js';
import { ejecutarArchivoSql } from '../src/base_datos/archivo_sql.js';

const directorioActual = path.dirname(fileURLToPath(import.meta.url));
const directorioMigraciones = path.resolve(directorioActual, '../migraciones');

async function leerMigraciones() {
  const nombres = await readdir(directorioMigraciones);
  return nombres
    .filter((nombre) => /^\d+_.+\.sql$/.test(nombre))
    .sort((primerNombre, segundoNombre) => primerNombre.localeCompare(segundoNombre));
}

async function ejecutarMigraciones() {
  const migraciones = await leerMigraciones();
  if (migraciones.length === 0 || migraciones[0] !== '001_control_migraciones.sql') {
    throw new Error('Debe existir la migración inicial 001_control_migraciones.sql.');
  }

  const conexion = await grupoConexiones.getConnection();
  try {
    const [tablaControl] = await conexion.query(
      "SHOW TABLES LIKE 'migraciones_aplicadas'",
    );

    if (!tablaControl) {
      await ejecutarArchivoSql(
        conexion,
        path.join(directorioMigraciones, migraciones[0]),
      );
    }

    const aplicadas = await conexion.query(
      'SELECT archivo FROM migraciones_aplicadas',
    );
    const archivosAplicados = new Set(aplicadas.map(({ archivo }) => archivo));

    for (const archivo of migraciones) {
      if (archivosAplicados.has(archivo)) continue;

      await conexion.beginTransaction();
      try {
        await ejecutarArchivoSql(conexion, path.join(directorioMigraciones, archivo));
        await conexion.query(
          'INSERT INTO migraciones_aplicadas (archivo) VALUES (?)',
          [archivo],
        );
        await conexion.commit();
        console.log(`Migración aplicada: ${archivo}`);
      } catch (error) {
        await conexion.rollback();
        throw error;
      }
    }
  } finally {
    conexion.release();
    await grupoConexiones.end();
  }
}

ejecutarMigraciones().catch((error) => {
  console.error('No se pudieron ejecutar las migraciones:', error.message);
  process.exitCode = 1;
});
