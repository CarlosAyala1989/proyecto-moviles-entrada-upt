import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { grupoConexiones } from '../src/config/database.js';

after(async () => {
  await grupoConexiones.end();
});

describe('Modelo de datos', () => {
  it('contiene todas las tablas requeridas por la arquitectura', async () => {
    const tablasEsperadas = [
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

    const conexion = await grupoConexiones.getConnection();
    try {
      const filas = await conexion.query(
        'SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME',
      );
      assert.deepEqual(filas.map(({ nombre }) => nombre), tablasEsperadas);
    } finally {
      conexion.release();
    }
  });

  it('carga los roles y configuraciones iniciales', async () => {
    const conexion = await grupoConexiones.getConnection();
    try {
      const [cantidadRoles] = await conexion.query('SELECT COUNT(*) AS total FROM roles');
      const [cantidadConfiguraciones] = await conexion.query(
        'SELECT COUNT(*) AS total FROM configuraciones_sistema',
      );

      assert.equal(cantidadRoles.total, 5);
      assert.equal(cantidadConfiguraciones.total, 8);
    } finally {
      conexion.release();
    }
  });

  it('relaciona los usuarios ficticios con sus roles', async () => {
    const conexion = await grupoConexiones.getConnection();
    try {
      const filas = await conexion.query(
        `SELECT usuarios.codigo_institucional, roles.nombre AS rol
         FROM usuarios
         JOIN usuarios_roles ON usuarios_roles.usuario_id = usuarios.id
         JOIN roles ON roles.id = usuarios_roles.rol_id
         WHERE usuarios.codigo_institucional LIKE 'PRUEBA-%'
         ORDER BY usuarios.codigo_institucional`,
      );

      assert.deepEqual(filas, [
        { codigo_institucional: 'PRUEBA-EST-001', rol: 'ESTUDIANTE' },
        { codigo_institucional: 'PRUEBA-SEG-001', rol: 'SEGURIDAD' },
      ]);
    } finally {
      conexion.release();
    }
  });

  it('impide duplicar identificadores institucionales', async () => {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      await conexion.query(
        `INSERT INTO usuarios
          (codigo_institucional, correo_institucional, nombres, apellidos)
         VALUES (?, ?, ?, ?)`,
        ['PRUEBA-UNICO-001', 'primero@example.invalid', 'Primero', 'Prueba'],
      );

      await assert.rejects(
        conexion.query(
          `INSERT INTO usuarios
            (codigo_institucional, correo_institucional, nombres, apellidos)
           VALUES (?, ?, ?, ?)`,
          ['PRUEBA-UNICO-001', 'segundo@example.invalid', 'Segundo', 'Prueba'],
        ),
        (error) => error.errno === 1062,
      );
    } finally {
      await conexion.rollback();
      conexion.release();
    }
  });

  it('rechaza coordenadas fuera del rango permitido', async () => {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      await assert.rejects(
        conexion.query(
          `INSERT INTO puntos_acceso
            (codigo, nombre, latitud, longitud, radio_permitido_metros)
           VALUES (?, ?, ?, ?, ?)`,
          ['PRUEBA-COORDENADA-INVALIDA', 'Punto inválido', 91, 0, 100],
        ),
        (error) => error.errno === 4025,
      );
    } finally {
      await conexion.rollback();
      conexion.release();
    }
  });

  it('impide asignar un rol a un usuario inexistente', async () => {
    const conexion = await grupoConexiones.getConnection();
    try {
      const [rol] = await conexion.query(
        "SELECT id FROM roles WHERE nombre = 'ESTUDIANTE'",
      );
      const [ultimoUsuario] = await conexion.query(
        'SELECT COALESCE(MAX(id), 0) AS id FROM usuarios',
      );

      await assert.rejects(
        conexion.query(
          'INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES (?, ?)',
          [ultimoUsuario.id + 1000, rol.id],
        ),
        (error) => error.errno === 1452,
      );
    } finally {
      conexion.release();
    }
  });

  it('prepara la trazabilidad de ubicación para cada validación', async () => {
    const columnas = await grupoConexiones.query(
      `SELECT COLUMN_NAME AS nombre
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'registros_acceso'
         AND COLUMN_NAME IN (
           'precision_escaneo_metros',
           'ubicacion_escaneo_obtenida_en',
           'distancia_escaneo_metros'
         )
       ORDER BY COLUMN_NAME`,
    );

    assert.deepEqual(columnas.map(({ nombre }) => nombre), [
      'distancia_escaneo_metros',
      'precision_escaneo_metros',
      'ubicacion_escaneo_obtenida_en',
    ]);
  });

  it('incluye índices para las consultas operativas por fecha y motivo', async () => {
    const indices = await grupoConexiones.query(
      `SELECT DISTINCT INDEX_NAME AS nombre
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND INDEX_NAME IN (
           'idx_registros_fecha',
           'idx_registros_motivo_fecha',
           'idx_auditoria_fecha'
         )
       ORDER BY INDEX_NAME`,
    );

    assert.deepEqual(indices.map(({ nombre }) => nombre), [
      'idx_auditoria_fecha',
      'idx_registros_fecha',
      'idx_registros_motivo_fecha',
    ]);
  });
});
