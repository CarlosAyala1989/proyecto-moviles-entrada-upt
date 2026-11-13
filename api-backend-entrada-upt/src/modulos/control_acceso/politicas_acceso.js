import { ErrorHttp } from '../../middleware/manejo_errores.js';

export async function tieneBloqueoIdentidad(conexion, usuarioId) {
  const [fila] = await conexion.query(
    `SELECT id FROM bloqueos_identidad WHERE usuario_id = ? AND rehabilitado_en IS NULL
     AND vigente_desde <= CURRENT_TIMESTAMP(3)
     AND (vigente_hasta IS NULL OR vigente_hasta > CURRENT_TIMESTAMP(3)) LIMIT 1`,
    [usuarioId],
  );
  return Boolean(fila);
}

export async function exigirIdentidadSinBloqueo(conexion, usuarioId) {
  if (await tieneBloqueoIdentidad(conexion, usuarioId)) {
    throw new ErrorHttp({ codigo: 'IDENTIDAD_BLOQUEADA', mensaje: 'La identidad tiene una restricción de acceso vigente.', estadoHttp: 403 });
  }
}

export function coincideHorario(regla, ahora) {
  // Conversión explícita a Lima, sin depender de la zona del proceso ni de tablas TZ SQL.
  const lima = new Date(ahora.getTime() - 5 * 60 * 60 * 1000);
  const dia = lima.getUTCDay() || 7;
  const minuto = lima.getUTCHours() * 60 + lima.getUTCMinutes();
  const convertir = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
  const inicio = convertir(regla.hora_inicio);
  const fin = convertir(regla.hora_fin);
  const dias = typeof regla.dias_semana === 'string' ? JSON.parse(regla.dias_semana) : regla.dias_semana;
  if (inicio === fin) return dias.includes(dia); // Día completo.
  if (inicio < fin) return dias.includes(dia) && minuto >= inicio && minuto < fin;
  return (minuto >= inicio && dias.includes(dia))
    || (minuto < fin && dias.includes(dia === 1 ? 7 : dia - 1));
}

export async function motivoRestriccionAcceso(conexion, usuario, roles, puntoId) {
  if (await tieneBloqueoIdentidad(conexion, usuario.id)) return 'IDENTIDAD_BLOQUEADA';
  const reglas = await conexion.query(
    `SELECT * FROM reglas_acceso WHERE activo = TRUE AND estado_usuario = ?
     AND (punto_acceso_id IS NULL OR punto_acceso_id = ?)
     AND vigente_desde <= CURRENT_TIMESTAMP(3)
     AND (vigente_hasta IS NULL OR vigente_hasta > CURRENT_TIMESTAMP(3))
     LOCK IN SHARE MODE`, [usuario.estado, puntoId],
  );
  const aplicables = reglas.filter((regla) => roles.includes(regla.rol));
  const [reloj] = await conexion.query('SELECT CURRENT_TIMESTAMP(3) AS ahora');
  if (aplicables.some((regla) => regla.accion === 'DENEGAR' && coincideHorario(regla, reloj.ahora))) {
    return 'REGLA_ACCESO_DENEGADA';
  }
  const permisos = aplicables.filter((regla) => regla.accion === 'PERMITIR');
  return permisos.length && !permisos.some((regla) => coincideHorario(regla, reloj.ahora))
    ? 'FUERA_HORARIO_PERMITIDO' : null;
}
