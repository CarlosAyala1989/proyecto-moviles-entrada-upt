import { z } from 'zod';

const estadosUsuario = ['PENDIENTE', 'ACTIVO', 'INACTIVO', 'BLOQUEADO', 'RECHAZADO'];
const estadosAutorizacion = ['PENDIENTE', 'AUTORIZADO', 'DENEGADO'];
const nombresRoles = ['ESTUDIANTE', 'DOCENTE', 'TRABAJADOR', 'SEGURIDAD', 'ADMINISTRADOR'];

const codigoInstitucional = z.string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[A-Za-z0-9._-]+$/)
  .transform((valor) => valor.toUpperCase());

const correoInstitucional = z.string()
  .trim()
  .email()
  .max(254)
  .transform((valor) => valor.toLowerCase());

const textoCorto = z.string().trim().min(1).max(150);
const textoOpcional = z.string().trim().max(255).nullable().optional();

const camposUsuario = {
  codigo_institucional: codigoInstitucional,
  correo_institucional: correoInstitucional,
  nombres: textoCorto.max(100),
  apellidos: textoCorto,
  nombre_institucional: textoOpcional,
  nombre_intranet: textoOpcional,
  foto_url: z.string().trim().url().max(2048).nullable().optional(),
};

export const esquemaCrearUsuario = z.object({
  ...camposUsuario,
  estado: z.enum(estadosUsuario).default('PENDIENTE'),
  estado_autorizacion: z.enum(estadosAutorizacion).default('PENDIENTE'),
  identidad_verificada: z.boolean().default(false),
  roles: z.array(z.enum(nombresRoles)).min(1).max(nombresRoles.length)
    .refine((roles) => new Set(roles).size === roles.length),
}).strict();

export const esquemaActualizarUsuario = z.object(camposUsuario)
  .partial()
  .strict()
  .refine((datos) => Object.keys(datos).length > 0);

export const esquemaActualizarEstado = z.object({
  estado: z.enum(estadosUsuario).optional(),
  estado_autorizacion: z.enum(estadosAutorizacion).optional(),
  identidad_verificada: z.boolean().optional(),
}).strict().refine((datos) => Object.keys(datos).length > 0);

export const esquemaAsignarRoles = z.object({
  roles: z.array(z.enum(nombresRoles)).min(1).max(nombresRoles.length)
    .refine((roles) => new Set(roles).size === roles.length),
}).strict();

export const esquemaIdUsuario = z.object({
  id: z.coerce.number().int().positive(),
}).strict();

export const esquemaConsultarUsuarios = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(100).default(20),
  buscar: z.string().trim().max(150).optional(),
  estado: z.enum(estadosUsuario).optional(),
}).strict();

export const esquemaAdministradorInicial = z.object({
  codigo_institucional: codigoInstitucional,
  correo_institucional: correoInstitucional,
  nombres: textoCorto.max(100),
  apellidos: textoCorto,
  contrasena: z.string()
    .min(14)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
}).strict();
