export class ErrorHttp extends Error {
  constructor({ codigo, mensaje, estadoHttp = 500 }) {
    super(mensaje);
    this.codigo = codigo;
    this.estadoHttp = estadoHttp;
  }
}

export function rutaNoEncontrada(solicitud, respuesta) {
  respuesta.status(404).json({
    error: {
      codigo: 'RUTA_NO_ENCONTRADA',
      mensaje: `Ruta no encontrada: ${solicitud.method} ${solicitud.originalUrl}`,
    },
  });
}

export function manejarErrores(error, _solicitud, respuesta, _siguiente) {
  const esJsonInvalido = error instanceof SyntaxError && error.status === 400;
  const estadoHttp = esJsonInvalido ? 400 : (error.estadoHttp ?? 500);
  const codigo = esJsonInvalido ? 'JSON_INVALIDO' : (error.codigo ?? 'ERROR_INTERNO');
  const mensaje = esJsonInvalido
    ? 'El cuerpo de la solicitud debe ser un JSON válido.'
    : (estadoHttp >= 500 ? 'Ocurrió un error interno en el servidor.' : error.message);

  if (estadoHttp >= 500 && !(error instanceof ErrorHttp)) {
    console.error(error);
  }

  respuesta.status(estadoHttp).json({ error: { codigo, mensaje } });
}
