import { createHash, timingSafeEqual } from 'node:crypto';
import { ErrorHttp } from './manejo_errores.js';

function resumenCriptografico(valor) {
  return createHash('sha256').update(valor).digest();
}

export function requerirClaveAdministracion({ clave, entornoEjecucion }) {
  return (solicitud, _respuesta, siguiente) => {
    if (entornoEjecucion === 'production') {
      siguiente(new ErrorHttp({
        codigo: 'AUTENTICACION_ADMINISTRATIVA_NO_DISPONIBLE',
        mensaje: 'La autenticación administrativa temporal no está disponible.',
        estadoHttp: 503,
      }));
      return;
    }

    if (!clave || clave.length < 32) {
      siguiente(new ErrorHttp({
        codigo: 'CONFIGURACION_ADMINISTRATIVA_INCOMPLETA',
        mensaje: 'La administración local todavía no está configurada.',
        estadoHttp: 503,
      }));
      return;
    }

    const claveRecibida = solicitud.get('x-clave-administracion-desarrollo') ?? '';
    const esValida = timingSafeEqual(
      resumenCriptografico(claveRecibida),
      resumenCriptografico(clave),
    );

    if (!esValida) {
      siguiente(new ErrorHttp({
        codigo: 'CREDENCIAL_ADMINISTRATIVA_INVALIDA',
        mensaje: 'La credencial administrativa no es válida.',
        estadoHttp: 401,
      }));
      return;
    }

    siguiente();
  };
}
