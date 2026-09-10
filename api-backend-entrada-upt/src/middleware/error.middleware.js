export function notFoundHandler(request, response) {
  response.status(404).json({
    status: 'error',
    message: `Ruta no encontrada: ${request.method} ${request.originalUrl}`,
  });
}

export function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode ?? error.status ?? 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json({
    status: 'error',
    message:
      statusCode >= 500 ? 'Error interno del servidor' : error.message,
  });
}

