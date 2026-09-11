export function crearControladorIdentidadDigital(servicio) {
  return {
    consultarPropia: async (solicitud, respuesta) => {
      const identidad = await servicio.consultarPropia(
        solicitud.usuarioAutenticado.id,
      );
      respuesta.json({ datos: identidad });
    },
  };
}
