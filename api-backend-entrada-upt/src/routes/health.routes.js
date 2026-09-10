import { Router } from 'express';
import { checkDatabaseConnection } from '../config/database.js';

export const healthRouter = Router();

healthRouter.get('/', async (_request, response) => {
  try {
    await checkDatabaseConnection();

    response.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    response.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: 'No se pudo establecer conexión con la base de datos',
      timestamp: new Date().toISOString(),
    });
  }
});

