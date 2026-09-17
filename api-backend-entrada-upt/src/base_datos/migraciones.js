import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ejecutarArchivoSql } from './archivo_sql.js';

const directorioPredeterminado = fileURLToPath(new URL('../../migraciones/', import.meta.url));

export async function ejecutarMigraciones({
  grupoConexiones,
  directorioMigraciones = directorioPredeterminado,
  registrar = console.log,
  esperaBloqueoSegundos = 60,
}) {
  const nombres = await readdir(directorioMigraciones);
  const migraciones = nombres
    .filter((nombre) => /^\d+_.+\.sql$/.test(nombre))
    .sort((primero, segundo) => Number.parseInt(primero, 10) - Number.parseInt(segundo, 10));

  if (migraciones[0] !== '001_control_migraciones.sql') {
    throw new Error('Debe existir la migración inicial 001_control_migraciones.sql.');
  }
  const numeros = migraciones.map((archivo) => Number.parseInt(archivo, 10));
  if (new Set(numeros).size !== numeros.length) {
    throw new Error('Cada migración debe tener un número diferente.');
  }

  const conexion = await grupoConexiones.getConnection();
  let nombreBloqueo;
  let bloqueoAdquirido = false;
  const pendientesAplicadas = [];
  try {
    const [base] = await conexion.query('SELECT DATABASE() AS nombre');
    if (!base.nombre) throw new Error('Debe seleccionarse una base de datos para migrar.');
    nombreBloqueo = `upt:migraciones:${createHash('sha256').update(base.nombre).digest('hex').slice(0, 40)}`;
    const [bloqueo] = await conexion.query(
      'SELECT GET_LOCK(?, ?) AS obtenido',
      [nombreBloqueo, esperaBloqueoSegundos],
    );
    if (Number(bloqueo.obtenido) !== 1) {
      throw new Error('No se pudo obtener el bloqueo de migraciones. Otro despliegue puede estar migrando.');
    }
    bloqueoAdquirido = true;

    // La colación de las migraciones originales sólo existe en MariaDB.
    // MySQL usa la alternativa común, sin cambiar los archivos históricos.
    const colaciones = await conexion.query(
      "SHOW COLLATION WHERE Collation = 'utf8mb4_uca1400_ai_ci'",
    );
    const opcionesSql = {
      transformarSentencia: colaciones.length > 0
        ? (sentencia) => sentencia
        : (sentencia) => sentencia.replace(
          /\bCOLLATE\s*=?\s*utf8mb4_uca1400_ai_ci\b/giu,
          'COLLATE=utf8mb4_unicode_ci',
        ),
    };

    const [tablaControl] = await conexion.query("SHOW TABLES LIKE 'migraciones_aplicadas'");
    if (!tablaControl) {
      await ejecutarArchivoSql(
        conexion,
        path.join(directorioMigraciones, migraciones[0]),
        opcionesSql,
      );
    }
    const aplicadas = await conexion.query('SELECT archivo FROM migraciones_aplicadas');
    const archivosAplicados = new Set(aplicadas.map(({ archivo }) => archivo));

    for (const archivo of migraciones) {
      if (archivosAplicados.has(archivo)) continue;
      await conexion.beginTransaction();
      try {
        await ejecutarArchivoSql(conexion, path.join(directorioMigraciones, archivo), opcionesSql);
        await conexion.query('INSERT INTO migraciones_aplicadas (archivo) VALUES (?)', [archivo]);
        await conexion.commit();
      } catch (error) {
        await conexion.rollback();
        // MySQL/MariaDB confirman DDL implícitamente: rollback no deshace ALTER/CREATE.
        throw new Error(`Falló la migración ${archivo}: ${error.message}`, { cause: error });
      }
      pendientesAplicadas.push(archivo);
      registrar(`Migración aplicada: ${archivo}`);
    }
    registrar(`Migraciones al día (${pendientesAplicadas.length} nuevas).`);
    return pendientesAplicadas;
  } finally {
    try {
      if (bloqueoAdquirido) {
        await conexion.query('SELECT RELEASE_LOCK(?)', [nombreBloqueo]);
      }
    } finally {
      conexion.release();
    }
  }
}
