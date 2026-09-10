import { app } from './app.js';
import { checkDatabaseConnection, pool } from './config/database.js';
import { env } from './config/env.js';

const server = app.listen(env.port, '0.0.0.0', async () => {
  console.log(`API disponible en http://localhost:${env.port}/api`);

  try {
    await checkDatabaseConnection();
    console.log('Conexión con MariaDB establecida');
  } catch (error) {
    console.error('La API inició, pero MariaDB no está disponible:', error.message);
  }
});

async function shutdown(signal) {
  console.log(`\n${signal} recibido. Cerrando la API...`);

  server.close(async () => {
    await pool.end();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

