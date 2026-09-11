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
