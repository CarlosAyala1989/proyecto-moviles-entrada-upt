import { z } from 'zod';

export const esquemaIniciarSesion = z.object({
  identificador: z.string().trim().min(3).max(254),
  contrasena: z.string().min(1).max(128),
}).strict();

export const esquemaRenovarSesion = z.object({
  token_renovacion: z.string().trim().min(40).max(200),
}).strict();
