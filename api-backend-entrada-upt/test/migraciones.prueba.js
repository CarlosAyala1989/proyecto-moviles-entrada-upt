import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, beforeEach, describe, it } from 'node:test';
import { grupoConexiones } from '../src/config/database.js';
import { ejecutarMigraciones } from '../src/base_datos/migraciones.js';

describe('Migraciones automáticas', () => {
  let prefijo;
  let grupoPrueba;
  let directorioMigraciones;

  beforeEach(async () => {
    prefijo = `prueba_migraciones_${randomBytes(8).toString('hex')}`;
    // Tablas aisladas en la base de desarrollo: el usuario de pruebas no
    // necesita permisos globales para crear bases de datos.
    const aislarSql = (sql) => sql
      .replace(/\bmigraciones_aplicadas\b/gu, `${prefijo}_control`)
      .replace(/\bprueba\b/gu, `${prefijo}_datos`);
    grupoPrueba = {
      query: (sql, parametros) => grupoConexiones.query(aislarSql(sql), parametros),
      getConnection: async () => {
        const conexion = await grupoConexiones.getConnection();
        return {
          query: (sql, parametros) => conexion.query(aislarSql(sql), parametros),
          beginTransaction: () => conexion.beginTransaction(),
          commit: () => conexion.commit(),
          rollback: () => conexion.rollback(),
          release: () => conexion.release(),
        };
      },
    };
    directorioMigraciones = await mkdtemp(path.join(tmpdir(), 'upt-migraciones-'));
    await copyFile(
      new URL('../migraciones/001_control_migraciones.sql', import.meta.url),
      path.join(directorioMigraciones, '001_control_migraciones.sql'),
    );
    await writeFile(path.join(directorioMigraciones, '002_tabla_prueba.sql'), `
      CREATE TABLE prueba (id INT PRIMARY KEY, valor INT NOT NULL) ENGINE=InnoDB;
      INSERT INTO prueba (id, valor) VALUES (1, 10);
    `);
  });

  afterEach(async () => {
    if (prefijo) {
      await grupoConexiones.query(`DROP TABLE IF EXISTS \`${prefijo}_datos\`, \`${prefijo}_control\``);
    }
    if (directorioMigraciones) await rm(directorioMigraciones, { recursive: true, force: true });
  });

  after(async () => grupoConexiones.end());

  function migrar() {
    return ejecutarMigraciones({
      grupoConexiones: grupoPrueba,
      directorioMigraciones,
      registrar: () => {},
    });
  }

  it('aplica sólo archivos pendientes y conserva datos entre despliegues', async () => {
    assert.deepEqual(await migrar(), ['001_control_migraciones.sql', '002_tabla_prueba.sql']);
    await grupoPrueba.query('UPDATE prueba SET valor = 25 WHERE id = 1');
    assert.deepEqual(await migrar(), []);
    await writeFile(path.join(directorioMigraciones, '003_columna_prueba.sql'),
      'ALTER TABLE prueba ADD COLUMN descripcion VARCHAR(80) NULL;');
    assert.deepEqual(await migrar(), ['003_columna_prueba.sql']);
    const [fila] = await grupoPrueba.query('SELECT valor, descripcion FROM prueba WHERE id = 1');
    assert.deepEqual(fila, { valor: 25, descripcion: null });
    const [control] = await grupoPrueba.query('SELECT COUNT(*) AS total FROM migraciones_aplicadas');
    assert.equal(control.total, 3);
  });

  it('serializa dos despliegues simultáneos sin ejecutar una migración dos veces', async () => {
    const resultados = await Promise.all([migrar(), migrar()]);
    assert.deepEqual(resultados.map((archivos) => archivos.length).sort(), [0, 2]);
    const [control] = await grupoPrueba.query('SELECT COUNT(*) AS total FROM migraciones_aplicadas');
    assert.equal(control.total, 2);
    const [datos] = await grupoPrueba.query('SELECT COUNT(*) AS total FROM prueba');
    assert.equal(datos.total, 1);
  });

  it('detiene el lote ante un error, revierte DML y libera el bloqueo para reintentar', async () => {
    await migrar();
    const fallida = path.join(directorioMigraciones, '003_actualizacion_prueba.sql');
    await writeFile(fallida, 'UPDATE prueba SET valor = 99;\nSQL_INVALIDO;');
    await writeFile(path.join(directorioMigraciones, '004_siguiente_prueba.sql'),
      'INSERT INTO prueba (id, valor) VALUES (2, 20);');
    await assert.rejects(migrar(), /Falló la migración 003_actualizacion_prueba.sql/u);
    const [fila] = await grupoPrueba.query('SELECT valor FROM prueba WHERE id = 1');
    assert.equal(fila.valor, 10);
    const control = await grupoPrueba.query('SELECT archivo FROM migraciones_aplicadas ORDER BY archivo');
    assert.deepEqual(control.map(({ archivo }) => archivo),
      ['001_control_migraciones.sql', '002_tabla_prueba.sql']);
    await writeFile(fallida, 'UPDATE prueba SET valor = 99;');
    assert.deepEqual(await migrar(), ['003_actualizacion_prueba.sql', '004_siguiente_prueba.sql']);
    const [datos] = await grupoPrueba.query('SELECT COUNT(*) AS total FROM prueba');
    assert.equal(datos.total, 2);
  });
});
