import { ErrorHttp } from './manejo_errores.js';

export function limitarSolicitudesIntranet() {
  const ventanas = new Map();
  return (req, res, next) => {
    const ahora = Date.now();
    for (const [ip, ventana] of ventanas) if (ventana.hasta <= ahora) ventanas.delete(ip);
    const ip = req.ip;
    const ventana = ventanas.get(ip) ?? { total: 0, hasta: ahora + 60_000 };
    if ((!ventanas.has(ip) && ventanas.size >= 2000) || ++ventana.total > 60) {
      res.set('Retry-After', '60');
      return next(new ErrorHttp({ codigo: 'DEMASIADAS_SOLICITUDES', mensaje: 'Espera un minuto antes de verificar de nuevo la intranet.', estadoHttp: 429 }));
    }
    ventanas.set(ip, ventana);
    next();
  };
}
