import { ErrorHttp } from '../../../middleware/manejo_errores.js';

function exigirNotificacion(notificacion) {
  if (!notificacion) {
    throw new ErrorHttp({
      codigo: 'NOTIFICACION_NO_ENCONTRADA',
      mensaje: 'La notificación solicitada no existe.',
      estadoHttp: 404,
    });
  }
  return notificacion;
}

export function crearControladorNotificaciones(repositorio) {
  return {
    consultar: async (solicitud, respuesta) => {
      const resultado = await repositorio.consultar({
        ...solicitud.datosValidados.consulta,
        usuarioId: solicitud.usuarioAutenticado.id,
      });
      respuesta.json({ datos: resultado.registros, paginacion: resultado.paginacion });
    },
    consultarResumen: async (solicitud, respuesta) => {
      respuesta.json({ datos: await repositorio.consultarResumen(solicitud.usuarioAutenticado.id) });
    },
    obtener: async (solicitud, respuesta) => {
      const notificacion = await repositorio.obtener(
        solicitud.usuarioAutenticado.id, solicitud.datosValidados.parametros.id,
      );
      respuesta.json({ datos: exigirNotificacion(notificacion) });
    },
    marcarLeida: async (solicitud, respuesta) => {
      const notificacion = await repositorio.marcarLeida(
        solicitud.usuarioAutenticado.id, solicitud.datosValidados.parametros.id,
      );
      respuesta.json({ datos: exigirNotificacion(notificacion) });
    },
  };
}
