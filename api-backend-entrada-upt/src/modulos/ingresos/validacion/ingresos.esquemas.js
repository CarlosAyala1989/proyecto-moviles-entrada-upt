import { z } from 'zod';

const fechaHistorial = z.string().datetime({ offset: true })
  .transform((valor) => new Date(valor));

export const esquemaConsultarHistorialPersonal = z.object({
  pagina: z.coerce.number().int().positive().max(1_000_000).default(1),
  limite: z.coerce.number().int().positive().max(100).default(20),
  resultado: z.enum(['AUTORIZADO', 'DENEGADO']).optional(),
  desde: fechaHistorial.optional(),
  hasta: fechaHistorial.optional(),
}).strict().refine(
  ({ desde, hasta }) => !desde || !hasta || desde <= hasta,
  { message: 'La fecha inicial no puede ser posterior a la fecha final.' },
);

export const esquemaValidarIngreso = z.object({
  codigo_qr: z.string().min(1).max(512),
  punto_acceso_codigo: z.string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/)
    .transform((codigo) => codigo.toUpperCase()),
  ubicacion: z.object({
    latitud: z.number().min(-90).max(90),
    longitud: z.number().min(-180).max(180),
    precision_metros: z.number().nonnegative().max(10_000),
    obtenida_en: z.string().datetime({ offset: true }),
  }).strict(),
}).strict();

export const esquemaConsultarIngresosRecientes = z.object({
  limite: z.coerce.number().int().positive().max(50).default(20),
  latitud: z.coerce.number().min(-90).max(90),
  longitud: z.coerce.number().min(-180).max(180),
  precision_metros: z.coerce.number().nonnegative().max(10_000),
  obtenida_en: z.string().datetime({ offset: true }),
}).strict();
