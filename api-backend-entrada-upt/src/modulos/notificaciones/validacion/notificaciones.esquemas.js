import { z } from 'zod';

const fecha = z.string().datetime({ offset: true }).transform((valor) => new Date(valor));

export const esquemaConsultarNotificaciones = z.object({
  pagina: z.coerce.number().int().positive().max(1_000_000).default(1),
  limite: z.coerce.number().int().positive().max(100).default(20),
  tipo: z.enum(['DENEGACION_ACCESO', 'INTENTO_SOSPECHOSO']).optional(),
  estado: z.enum(['NO_LEIDA', 'LEIDA']).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
}).strict().refine(
  ({ desde, hasta }) => !desde || !hasta || desde <= hasta,
  { message: 'La fecha inicial no puede ser posterior a la fecha final.' },
);

export const esquemaIdNotificacion = z.object({
  id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();

export const esquemaConsultaVacia = z.object({}).strict();
export const esquemaCuerpoLectura = z.object({}).strict().optional();
