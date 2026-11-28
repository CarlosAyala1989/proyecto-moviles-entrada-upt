import { grupoConexiones } from '../src/config/database.js';
import { entorno } from '../src/config/env.js';
import { ejecutarMigraciones } from '../src/base_datos/migraciones.js';
import { asegurarAccesoGlobal } from '../src/base_datos/variante_sin_google.js';
import { asegurarAdministradorInicial } from '../src/base_datos/administrador_inicial.js';

try {
  if (entorno.db.database !== 'respaldoseguridad') throw new Error('Este comando solo prepara la base respaldoseguridad.');
  await ejecutarMigraciones({ grupoConexiones });
  await asegurarAdministradorInicial(grupoConexiones);
  await asegurarAccesoGlobal(grupoConexiones);
  const [resumen] = await grupoConexiones.query(`SELECT
    (SELECT COUNT(*) FROM migraciones_aplicadas) AS migraciones,
    (SELECT COUNT(*) FROM roles) AS roles,
    (SELECT COUNT(*) FROM configuraciones_sistema) AS configuraciones,
    (SELECT COUNT(*) FROM usuarios) AS usuarios,
    (SELECT COUNT(*) FROM puntos_acceso WHERE estado = 'ACTIVO') AS puntos_activos`);
  console.log(JSON.stringify(resumen));
} catch (error) {
  console.error('No se completó la preparación de la variante:', error.code ?? error.message);
  process.exitCode = 1;
} finally { await grupoConexiones.end(); }
