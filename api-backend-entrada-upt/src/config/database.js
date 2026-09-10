import mariadb from 'mariadb';
import { env } from './env.js';

export const pool = mariadb.createPool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  connectionLimit: env.db.connectionLimit,
  acquireTimeout: 10_000,
  insertIdAsNumber: true,
  bigIntAsNumber: true,
});

export async function checkDatabaseConnection() {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1 AS connected');
  } finally {
    connection?.release();
  }
}

