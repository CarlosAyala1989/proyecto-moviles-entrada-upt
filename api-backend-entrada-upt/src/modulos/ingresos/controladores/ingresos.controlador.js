export function crearControladorIngresos(servicio) {
  return {
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
      });
      respuesta.json({ datos: registros });
    },
  };
}
