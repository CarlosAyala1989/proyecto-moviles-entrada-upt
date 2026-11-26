import { grupoConexiones } from '../src/config/database.js';
import { depurarDatosEstudiantes } from '../src/modulos/cuenta/retencion.js';

try {
  await depurarDatosEstudiantes();
  console.log('Depuración de privacidad completada (registros de estudiantes de más de 30 días).');
} catch {
  console.error('No se pudo completar la depuración. Verifica las migraciones y la conexión.');
  process.exitCode = 1;
} finally { await grupoConexiones.end(); }
