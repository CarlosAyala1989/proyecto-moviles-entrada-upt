import { app } from './app.js';
import { grupoConexiones, verificarConexionBaseDatos } from './config/database.js';
import { entorno } from './config/env.js';
import { ejecutarMigraciones } from './base_datos/migraciones.js';
import { asegurarAdministradorInicial } from './base_datos/administrador_inicial.js';

let servidor;
try {
  await ejecutarMigraciones({ grupoConexiones });
  await asegurarAdministradorInicial(grupoConexiones);
  await verificarConexionBaseDatos();
  console.log('Conexión con la base de datos establecida');
  servidor = app.listen(entorno.port, '0.0.0.0', () => {
    console.log(`API disponible en http://localhost:${entorno.port}/api`);
  });
} catch (error) {
  console.error('La API no inició; falló la preparación de la base de datos:', error.message);
  await grupoConexiones.end();
  process.exitCode = 1;
}

async function cerrarServidor(senal) {
  console.log(`\n${senal} recibido. Cerrando la API...`);

  servidor.close(async () => {
    await grupoConexiones.end();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

if (servidor) {
  process.on('SIGINT', () => cerrarServidor('SIGINT'));
  process.on('SIGTERM', () => cerrarServidor('SIGTERM'));
}
