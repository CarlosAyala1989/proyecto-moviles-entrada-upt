export function crearControladorIngresos(servicio) {
  return {
    consultarHistorialPersonal: async (solicitud, respuesta) => {
      const resultado = await servicio.consultarHistorialPersonal({
        ...solicitud.datosValidados.consulta,
        usuarioId: solicitud.usuarioAutenticado.id,
      });
      respuesta.set('Cache-Control', 'no-store').json({
        datos: resultado.registros,
        paginacion: resultado.paginacion,
      });
    },

    validar: async (solicitud, respuesta) => {
      const resultado = await servicio.validar({
        ...solicitud.datosValidados.cuerpo,
        usuarioSeguridadId: solicitud.usuarioAutenticado.id,
      });
      respuesta.json({ datos: resultado });
    },

    consultarRecientes: async (solicitud, respuesta) => {
      const registros = await servicio.consultarRecientes({
        usuarioSeguridadId: solicitud.usuarioAutenticado.id,
        limite: solicitud.datosValidados.consulta.limite,
        ubicacion: solicitud.datosValidados.consulta,
      });
      respuesta.json({ datos: registros });
    },
  };
}
