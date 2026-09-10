import { app } from './app.js';
import { grupoConexiones, verificarConexionBaseDatos } from './config/database.js';
import { entorno } from './config/env.js';

const servidor = app.listen(entorno.port, '0.0.0.0', async () => {
  console.log(`API disponible en http://localhost:${entorno.port}/api`);

  try {
    await verificarConexionBaseDatos();
    console.log('Conexión con MariaDB establecida');
  } catch (error) {
    console.error('La API inició, pero MariaDB no está disponible:', error.message);
  }
});

async function cerrarServidor(senal) {
  console.log(`\n${senal} recibido. Cerrando la API...`);

  servidor.close(async () => {
    await grupoConexiones.end();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => cerrarServidor('SIGINT'));
process.on('SIGTERM', () => cerrarServidor('SIGTERM'));
