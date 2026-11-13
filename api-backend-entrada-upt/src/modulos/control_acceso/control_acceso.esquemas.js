import { z } from 'zod';
import { esquemaValidarIngreso } from '../ingresos/validacion/ingresos.esquemas.js';

export const id = z.object({ id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();
export const vacio = z.object({}).strict();
export const paginacion = z.object({
  pagina: z.coerce.number().int().positive().max(100000).default(1),
  limite: z.coerce.number().int().positive().max(50).default(20),
}).strict();
export const ubicacion = esquemaValidarIngreso.shape.ubicacion;
export const esquemaTurno = z.object({ ubicacion }).strict();
export const esquemaBusqueda = z.object({
  codigo: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9._-]+$/).optional(),
  correo: z.string().trim().email().max(254).optional(),
  motivo: z.string().trim().min(10).max(500),
  ubicacion,
}).strict().refine((datos) => Boolean(datos.codigo) !== Boolean(datos.correo));
export const esquemaIncidencia = z.object({
  tipo: z.enum(['DOCUMENTO_NO_COINCIDE', 'SUPLANTACION', 'PROBLEMA_QR', 'OTRA']),
  observacion: z.string().trim().min(10).max(1000),
  clave_idempotencia: z.uuid(),
}).strict();
export const esquemaBloqueo = z.object({
  motivo: z.string().trim().min(10).max(500),
  vigente_hasta: z.string().datetime({ offset: true }).nullable().default(null),
  confirmacion: z.literal(true),
}).strict().refine((datos) => !datos.vigente_hasta || Date.parse(datos.vigente_hasta) > Date.now());
export const esquemaRehabilitar = z.object({
  motivo: z.string().trim().min(10).max(500),
  confirmacion: z.literal(true),
}).strict();
export const idBloqueo = z.object({
  id: id.shape.id,
  bloqueo_id: id.shape.id,
}).strict();
const hora = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const esquemaRegla = z.object({
  nombre: z.string().trim().min(3).max(100),
  rol: z.enum(['ESTUDIANTE', 'DOCENTE', 'TRABAJADOR']),
  estado_usuario: z.enum(['ACTIVO', 'PENDIENTE', 'BLOQUEADO', 'INACTIVO', 'RECHAZADO']),
  accion: z.enum(['PERMITIR', 'DENEGAR']),
  punto_acceso_id: z.number().int().positive().nullable().default(null),
  dias_semana: z.array(z.number().int().min(1).max(7)).min(1).max(7)
    .refine((dias) => new Set(dias).size === dias.length),
  hora_inicio: hora,
  hora_fin: hora,
  vigente_desde: z.string().datetime({ offset: true }),
  vigente_hasta: z.string().datetime({ offset: true }).nullable().default(null),
  activo: z.boolean().default(true),
}).strict().refine((datos) => !datos.vigente_hasta
  || Date.parse(datos.vigente_hasta) > Date.parse(datos.vigente_desde));
