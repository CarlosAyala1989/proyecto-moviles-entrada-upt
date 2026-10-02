import { ErrorHttp } from './manejo_errores.js';

export function crearRequerirAutenticacion(servicioAutenticacion) {
  return async (solicitud, _respuesta, siguiente) => {
    try {
      const autorizacion = solicitud.get('authorization') ?? '';
      const coincidencia = autorizacion.match(/^Bearer ([^\s]+)$/i);
      if (!coincidencia) {
        throw new ErrorHttp({
          codigo: 'AUTENTICACION_REQUERIDA',
          mensaje: 'Se requiere un token de acceso Bearer.',
          estadoHttp: 401,
        });
      }

      const sesion = await servicioAutenticacion.autenticarTokenAcceso(
        coincidencia[1],
      );
      solicitud.usuarioAutenticado = sesion.usuario;
      solicitud.sesionAutenticada = { id: sesion.sesionId };
      siguiente();
    } catch (error) {
      siguiente(error);
    }
  };
}
