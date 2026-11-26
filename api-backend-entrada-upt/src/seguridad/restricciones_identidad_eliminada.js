import { createHash, createHmac } from 'node:crypto';
import { ErrorHttp } from '../middleware/manejo_errores.js';

function errorConfiguracion() {
  return new ErrorHttp({ codigo: 'RESTRICCIONES_NO_CONFIGURADAS', mensaje: 'La verificación de las restricciones institucionales no está disponible temporalmente.', estadoHttp: 503 });
}

export function claveRestricciones() {
  const texto = process.env.CLAVE_RESTRICCIONES_IDENTIDAD ?? '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(texto)) throw errorConfiguracion();
  const clave = Buffer.from(texto, 'base64url');
  if (clave.length !== 32) throw errorConfiguracion();
  return clave;
}

const firmaClave = (clave) => createHash('sha256').update(clave).digest('hex');
const referencia = (codigo, clave) => createHmac('sha256', clave).update(`upt:restriccion:codigo:${String(codigo).trim().toUpperCase()}`).digest('hex');

async function exigirMismaClave(conexion, clave) {
  const [fila] = await conexion.query(
    'SELECT COUNT(*) AS total FROM restricciones_identidad_eliminada WHERE expira_en > CURRENT_TIMESTAMP(3) AND clave_firma <> ?', [firmaClave(clave)],
  );
  // Una rotación accidental no debe permitir eludir restricciones existentes.
  if (fila.total) throw errorConfiguracion();
}

export async function conservarRestriccionAlEliminar(conexion, usuario) {
  const clave = claveRestricciones();
  await exigirMismaClave(conexion, clave);
  const identidadHash = referencia(usuario.codigo_institucional, clave);
  const [bloqueos] = await conexion.query(
    `SELECT COUNT(*) AS total,
       MAX(COALESCE(vigente_hasta, TIMESTAMPADD(DAY, 30, CURRENT_TIMESTAMP(3)))) AS hasta
     FROM bloqueos_identidad WHERE usuario_id = ? AND rehabilitado_en IS NULL
       AND vigente_desde <= CURRENT_TIMESTAMP(3)
       AND (vigente_hasta IS NULL OR vigente_hasta > CURRENT_TIMESTAMP(3))`, [usuario.id],
  );
  const denegada = ['BLOQUEADO', 'RECHAZADO', 'INACTIVO'].includes(usuario.estado) || usuario.estado_autorizacion === 'DENEGADO';
  if (!denegada && !bloqueos.total) {
    await conexion.query('DELETE FROM restricciones_identidad_eliminada WHERE identidad_hash = ?', [identidadHash]);
    return;
  }
  await conexion.query(
    `INSERT INTO restricciones_identidad_eliminada (identidad_hash, clave_firma, expira_en)
     VALUES (?, ?, LEAST(TIMESTAMPADD(DAY, 30, CURRENT_TIMESTAMP(3)), COALESCE(?, TIMESTAMPADD(DAY, 30, CURRENT_TIMESTAMP(3)))))
     ON DUPLICATE KEY UPDATE expira_en = GREATEST(expira_en, VALUES(expira_en))`,
    [identidadHash, firmaClave(clave), denegada ? null : bloqueos.hasta],
  );
}

export async function exigirRegistroSinRestriccion(conexion, codigo) {
  const [total] = await conexion.query('SELECT COUNT(*) AS total FROM restricciones_identidad_eliminada WHERE expira_en > CURRENT_TIMESTAMP(3)');
  // Preserva el registro existente cuando aún no se ha utilizado este módulo.
  if (!total.total) return;
  const clave = claveRestricciones();
  await exigirMismaClave(conexion, clave);
  const [restriccion] = await conexion.query(
    'SELECT 1 AS vigente FROM restricciones_identidad_eliminada WHERE identidad_hash = ? AND expira_en > CURRENT_TIMESTAMP(3)', [referencia(codigo, clave)],
  );
  if (restriccion) {
    throw new ErrorHttp({ codigo: 'RESTRICCION_INSTITUCIONAL_VIGENTE', mensaje: 'La identidad mantiene una restricción institucional de ingreso. Eliminar la cuenta de la aplicación no levanta esa restricción.', estadoHttp: 403 });
  }
}
