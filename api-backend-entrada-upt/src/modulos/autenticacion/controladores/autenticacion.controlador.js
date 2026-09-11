function obtenerMetadatos(solicitud) {
  return {
    direccionIp: solicitud.ip?.slice(0, 45),
    agenteUsuario: solicitud.get('user-agent')?.slice(0, 512),
  };
}

export function crearControladorAutenticacion(servicio) {
  return {
    iniciarSesion: async (solicitud, respuesta) => {
      const sesion = await servicio.iniciarSesion({
        ...solicitud.datosValidados.cuerpo,
        metadatos: obtenerMetadatos(solicitud),
      });
      respuesta.status(201).json({ datos: sesion });
    },

    renovarSesion: async (solicitud, respuesta) => {
      const sesion = await servicio.renovarSesion(
        solicitud.datosValidados.cuerpo.token_renovacion,
      );
      respuesta.json({ datos: sesion });
    },

    cerrarSesion: async (solicitud, respuesta) => {
      await servicio.cerrarSesion({
        sesionId: solicitud.sesionAutenticada.id,
        usuarioId: solicitud.usuarioAutenticado.id,
      });
      respuesta.status(204).end();
    },

    consultarSesion: async (solicitud, respuesta) => {
      respuesta.json({ datos: { usuario: solicitud.usuarioAutenticado } });
    },
  };
}
