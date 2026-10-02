import { z } from 'zod';

export const esquemaVerificarIntranet = z.object({
  transaccion_id: z.uuid(),
  codigo: z.string().regex(/^\d{10}$/, 'El código institucional debe tener diez dígitos.'),
  contrasena: z.string().regex(/^\d{1,6}$/, 'La contraseña de intranet debe ser numérica.'),
  captcha: z.string().regex(/^\d{1,5}$/, 'El CAPTCHA debe ser numérico.'),
}).strict();

export const esquemaIniciarGoogle = z.object({
  verificacion_intranet_id: z.uuid(),
}).strict();

export const esquemaTransaccionGoogle = z.object({
  transaccion_id: z.uuid(),
}).strict();
