import { Router } from 'express';
import { verificarConexionBaseDatos } from '../config/database.js';

export const enrutadorSalud = Router();

enrutadorSalud.get('/', async (_solicitud, respuesta) => {
  try {
    await verificarConexionBaseDatos();

    respuesta.json({
      estado: 'correcto',
      base_datos: 'conectada',
      fecha: new Date().toISOString(),
    });
  } catch (_error) {
    respuesta.status(503).json({
      estado: 'error',
      base_datos: 'desconectada',
      mensaje: 'No se pudo establecer conexión con la base de datos.',
      fecha: new Date().toISOString(),
    });
  }
});
