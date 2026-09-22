import { z } from 'zod';

export const esquemaGenerarCodigoQr = z.object({
  ubicacion: z.object({
    latitud: z.number().min(-90).max(90),
    longitud: z.number().min(-180).max(180),
    precision_metros: z.number().nonnegative().max(10_000),
    obtenida_en: z.string().datetime({ offset: true }),
  }).strict(),
}).strict();

export const esquemaConsultaCodigoQrActual = z.object({}).strict();

export const esquemaPrepararCodigosOffline = z.object({
  identificador_dispositivo: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  plataforma: z.enum(['ANDROID', 'IOS', 'WEB', 'OTRA']),
}).strict();
