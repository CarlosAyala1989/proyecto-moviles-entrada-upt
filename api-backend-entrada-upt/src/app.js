import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { entorno } from './config/env.js';
import { manejarErrores, rutaNoEncontrada } from './middleware/manejo_errores.js';
import { validarTipoContenidoJson } from './middleware/validar_solicitud.js';
import { enrutadorSalud } from './routes/salud.rutas.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: entorno.corsOrigin }));
app.use(validarTipoContenidoJson);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

if (entorno.nodeEnv !== 'test') {
  app.use(morgan(entorno.nodeEnv === 'production' ? 'combined' : 'dev'));
}

app.get('/api', (_request, response) => {
  response.json({
    name: 'API Entrada UPT',
    version: '1.0.0',
  });
});

app.use('/api/salud', enrutadorSalud);
// Se conserva temporalmente mientras los clientes migran a la ruta en español.
app.use('/api/health', enrutadorSalud);

app.use(rutaNoEncontrada);
app.use(manejarErrores);
