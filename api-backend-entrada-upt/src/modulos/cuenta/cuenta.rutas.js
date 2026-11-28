import { Router } from 'express';
import { z } from 'zod';
import { validarDatos } from '../../middleware/validar_datos.js';
import { ErrorHttp } from '../../middleware/manejo_errores.js';
import { esquemaVerificarIntranet } from '../registro_estudiante/validacion/registro_estudiante.esquemas.js';

const verificador = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const credencial = z.object({ id: z.uuid(), verificador }).strict();

function limitarSolicitudes() {
  const ventanas = new Map();
  return (req, res, next) => {
    const ahora = Date.now();
    for (const [clave, ventana] of ventanas) if (ventana.hasta <= ahora) ventanas.delete(clave);
    const clave = req.ip;
    const ventana = ventanas.get(clave) ?? { total: 0, hasta: ahora + 60_000 };
    if ((!ventanas.has(clave) && ventanas.size >= 2000) || ++ventana.total > 60) {
      res.set('Retry-After', '60');
      return next(new ErrorHttp({ codigo: 'DEMASIADAS_SOLICITUDES', mensaje: 'Espera un minuto antes de volver a intentarlo.', estadoHttp: 429 }));
    }
    ventanas.set(clave, ventana);
    return next();
  };
}

export function crearRutasCuenta(servicio, { soloIntranet = true } = {}) {
  const rutas = Router();
  rutas.use(limitarSolicitudes());
  rutas.use((_req, res, next) => { res.set('Referrer-Policy', 'no-referrer'); next(); });
  if (soloIntranet) {
    rutas.post('/eliminacion/intranet/captcha', validarDatos({ cuerpo: z.object({}).strict() }), async (_req, res) => {
      res.json({ datos: await servicio.obtenerCaptcha() });
    });
    rutas.post('/eliminacion/intranet/verificar', validarDatos({ cuerpo: esquemaVerificarIntranet.omit({ incluir_datos_estudiante: true }).extend({ verificador }) }), async (req, res) => {
      res.status(201).json({ datos: await servicio.verificar(req.datosValidados.cuerpo) });
    });
  }
  if (!soloIntranet) rutas.post('/eliminacion/iniciar', validarDatos({ cuerpo: z.object({ verificador }).strict() }), async (req, res) => {
    res.status(201).json({ datos: await servicio.iniciar(req.datosValidados.cuerpo.verificador) });
  });
  if (!soloIntranet) rutas.get('/eliminacion/google/callback', async (req, res) => {
    const destino = servicio.paginaRetorno();
    await servicio.procesarRetorno(req.query);
    res.redirect(303, destino);
  });
  rutas.post('/eliminacion/estado', validarDatos({ cuerpo: credencial }), async (req, res) => {
    res.json({ datos: await servicio.consultar(req.datosValidados.cuerpo) });
  });
  rutas.post('/eliminacion/confirmar', validarDatos({ cuerpo: credencial.extend({ confirmacion: z.literal('ELIMINAR') }) }), async (req, res) => {
    res.json({ datos: await servicio.confirmar(req.datosValidados.cuerpo) });
  });
  rutas.post('/eliminacion/cancelar', validarDatos({ cuerpo: credencial }), async (req, res) => {
    res.json({ datos: await servicio.cancelar(req.datosValidados.cuerpo) });
  });
  // No se acepta usuario_id, correo ni un identificador arbitrario del navegador.
  rutas.use((_req, _res, next) => next(new ErrorHttp({ codigo: 'RUTA_CUENTA_NO_ENCONTRADA', mensaje: 'Operación de cuenta no encontrada.', estadoHttp: 404 })));
  return rutas;
}
