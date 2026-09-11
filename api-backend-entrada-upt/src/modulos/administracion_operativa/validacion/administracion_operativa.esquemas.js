import { z } from 'zod';

const resultadosAcceso = ['AUTORIZADO', 'DENEGADO'];
const estadosPuntoAcceso = ['ACTIVO', 'INACTIVO'];
const clavesConfiguracionOperativa = [
  'DURACION_QR_SEGUNDOS',
  'QR_UN_SOLO_USO',
  'ANTIGUEDAD_MAXIMA_UBICACION_SEGUNDOS',
  'DESFASE_FUTURO_UBICACION_SEGUNDOS',
  'PRECISION_MAXIMA_UBICACION_METROS',
];
const fechaIso = z.string().datetime({ offset: true }).transform((valor) => new Date(valor));
const paginacion = {
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(100).default(20),
};

function validarRangoFechas(esquema) {
  return esquema.refine(
    ({ desde, hasta }) => !desde || !hasta || desde <= hasta,
    { message: 'La fecha inicial no puede ser posterior a la fecha final.' },
  );
}

export const esquemaConsultarAccesos = validarRangoFechas(z.object({
  ...paginacion,
  usuario_id: z.coerce.number().int().positive().optional(),
  punto_acceso_id: z.coerce.number().int().positive().optional(),
  usuario_seguridad_id: z.coerce.number().int().positive().optional(),
  resultado: z.enum(resultadosAcceso).optional(),
  motivo: z.string().trim().min(1).max(80).optional(),
  desde: fechaIso.optional(),
  hasta: fechaIso.optional(),
}).strict());

export const esquemaConsultarAuditoria = validarRangoFechas(z.object({
  ...paginacion,
  usuario_actor_id: z.coerce.number().int().positive().optional(),
  accion: z.string().trim().min(1).max(80).optional(),
  entidad: z.string().trim().min(1).max(80).optional(),
  desde: fechaIso.optional(),
  hasta: fechaIso.optional(),
}).strict());

export const esquemaConsultarPuntosAcceso = z.object({
  ...paginacion,
  buscar: z.string().trim().min(1).max(150).optional(),
  estado: z.enum(estadosPuntoAcceso).optional(),
}).strict();

const codigoPuntoAcceso = z.string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
  .transform((valor) => valor.toUpperCase());
const camposPuntoAcceso = {
  codigo: codigoPuntoAcceso,
  nombre: z.string().trim().min(2).max(150),
  descripcion: z.string().trim().max(500).nullable(),
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
  radio_permitido_metros: z.number().positive().max(10_000),
  estado: z.enum(estadosPuntoAcceso),
};

export const esquemaCrearPuntoAcceso = z.object({
  ...camposPuntoAcceso,
  descripcion: camposPuntoAcceso.descripcion.optional().default(null),
  estado: camposPuntoAcceso.estado.optional().default('ACTIVO'),
}).strict();

export const esquemaActualizarPuntoAcceso = z.object(camposPuntoAcceso)
  .partial()
  .strict()
  .refine((datos) => Object.keys(datos).length > 0);

export const esquemaId = z.object({
  id: z.coerce.number().int().positive(),
}).strict();

export const esquemaClaveConfiguracion = z.object({
  clave: z.enum(clavesConfiguracionOperativa),
}).strict();

export const esquemaActualizarConfiguracion = z.object({
  valor: z.union([z.number(), z.boolean()]),
}).strict();

export const esquemaConsultaVacia = z.object({}).strict();
