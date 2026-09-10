import mariadb from 'mariadb';
import { entorno } from './env.js';

export const grupoConexiones = mariadb.createPool({
  host: entorno.db.host,
  port: entorno.db.port,
  database: entorno.db.database,
  user: entorno.db.user,
  password: entorno.db.password,
  connectionLimit: entorno.db.connectionLimit,
  acquireTimeout: 10_000,
  insertIdAsNumber: true,
  bigIntAsNumber: true,
});

export async function verificarConexionBaseDatos() {
  let conexion;

  try {
    conexion = await grupoConexiones.getConnection();
    await conexion.query('SELECT 1 AS conectado');
  } finally {
    conexion?.release();
  }
}
