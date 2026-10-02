function obtenerMetadatos(solicitud) {
  return {
    direccionIp: solicitud.ip?.slice(0, 45),
    agenteUsuario: solicitud.get('user-agent')?.slice(0, 512),
  };
}

function paginaRetornoGoogle(exitosa) {
  const titulo = exitosa ? 'Identidad verificada' : 'No se completó la verificación';
  const mensaje = exitosa
    ? 'Puedes cerrar esta pestaña y volver a la aplicación UPT.'
    : 'Vuelve a la aplicación UPT para revisar el motivo o intentarlo nuevamente.';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head><body><main><h1>${titulo}</h1><p>${mensaje}</p></main></body></html>`;
}

export function crearControladorRegistroEstudiante(servicioIntranet, servicioGoogle) {
  return {
    obtenerCaptchaIntranet: async (_solicitud, respuesta) => {
      respuesta.json({ datos: await servicioIntranet.obtenerCaptcha() });
    },
    verificarIntranet: async (solicitud, respuesta) => {
      const perfil = await servicioIntranet.verificarCredenciales({
        transaccionId: solicitud.datosValidados.cuerpo.transaccion_id,
        codigo: solicitud.datosValidados.cuerpo.codigo,
        contrasena: solicitud.datosValidados.cuerpo.contrasena,
        captcha: solicitud.datosValidados.cuerpo.captcha,
      });
      respuesta.json({ datos: perfil });
    },
    iniciarGoogle: async (solicitud, respuesta) => {
      const datos = await servicioGoogle.iniciar({
        verificacionIntranetId:
          solicitud.datosValidados.cuerpo.verificacion_intranet_id,
      });
      respuesta.status(201).json({ datos });
    },
    retornarGoogle: async (solicitud, respuesta) => {
      const resultado = await servicioGoogle.procesarRetorno({
        estadoOauth: solicitud.query.state,
        codigo: solicitud.query.code,
        errorOauth: solicitud.query.error,
        metadatos: obtenerMetadatos(solicitud),
      });
      respuesta.redirect(
        303,
        `/api/registro-estudiante/google/resultado?estado=${resultado.exitosa ? 'correcto' : 'error'}`,
      );
    },
    mostrarResultadoGoogle: (solicitud, respuesta) => {
      respuesta
        .set('cache-control', 'no-store')
        .set('referrer-policy', 'no-referrer')
        .type('html')
        .send(paginaRetornoGoogle(solicitud.query.estado === 'correcto'));
    },
    consultarEstadoGoogle: async (solicitud, respuesta) => {
      const datos = servicioGoogle.consultarEstado(
        solicitud.datosValidados.parametros.transaccion_id,
      );
      respuesta.json({ datos });
    },
  };
}
