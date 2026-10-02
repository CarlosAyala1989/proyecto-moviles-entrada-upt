export function crearControladorCodigosQr(servicio) {
  return {
    generar: async (solicitud, respuesta) => {
      const credencial = await servicio.generar({
        usuarioId: solicitud.usuarioAutenticado.id,
        sesionId: solicitud.sesionAutenticada.id,
        ubicacion: solicitud.datosValidados.cuerpo.ubicacion,
      });
      respuesta.status(201).json({ datos: credencial });
    },

    prepararOffline: async (solicitud, respuesta) => {
      const lote = await servicio.prepararOffline({
        usuarioId: solicitud.usuarioAutenticado.id,
        sesionId: solicitud.sesionAutenticada.id,
        ...solicitud.datosValidados.cuerpo,
      });
      respuesta.status(201).json({ datos: lote });
    },

    consultarActual: async (solicitud, respuesta) => {
      const credencial = await servicio.consultarActual(
        solicitud.usuarioAutenticado.id,
      );
      respuesta.json({ datos: credencial });
    },

    revocarActual: async (solicitud, respuesta) => {
      await servicio.revocarActual(solicitud.usuarioAutenticado.id);
      respuesta.status(204).end();
    },
  };
}
