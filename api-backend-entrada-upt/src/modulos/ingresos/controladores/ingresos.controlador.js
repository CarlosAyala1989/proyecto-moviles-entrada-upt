export function crearControladorIngresos(servicio) {
  return {
    validar: async (solicitud, respuesta) => {
      const resultado = await servicio.validar({
        ...solicitud.datosValidados.cuerpo,
        usuarioSeguridadId: solicitud.usuarioAutenticado.id,
      });
      respuesta.json({ datos: resultado });
    },
  };
}
