import { ErrorHttp } from './manejo_errores.js';

const metodosConCuerpo = new Set(['POST', 'PUT', 'PATCH']);

export function validarTipoContenidoJson(solicitud, _respuesta, siguiente) {
  const tieneCuerpo = Number(solicitud.get('content-length') ?? 0) > 0;
  const esJson = solicitud.is('application/json');

  if (metodosConCuerpo.has(solicitud.method) && tieneCuerpo && !esJson) {
    siguiente(new ErrorHttp({
      codigo: 'TIPO_CONTENIDO_NO_ADMITIDO',
      mensaje: 'El cuerpo de la solicitud debe usar application/json.',
      estadoHttp: 415,
    }));
    return;
  }

  siguiente();
}
