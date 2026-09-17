import { grupoConexiones } from '../src/config/database.js';
import { ejecutarMigraciones } from '../src/base_datos/migraciones.js';

try {
  await ejecutarMigraciones({ grupoConexiones });
} catch (error) {
  console.error('No se pudieron ejecutar las migraciones:', error.message);
  process.exitCode = 1;
} finally {
  await grupoConexiones.end();
}
