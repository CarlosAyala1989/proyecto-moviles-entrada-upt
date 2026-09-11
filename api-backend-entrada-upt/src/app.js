import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { entorno } from './config/env.js';
import { manejarErrores, rutaNoEncontrada } from './middleware/manejo_errores.js';
import { validarTipoContenidoJson } from './middleware/validar_solicitud.js';
import { crearEnrutadorAdministracionUsuarios } from './modulos/usuarios/rutas/administracion_usuarios.rutas.js';
import { enrutadorSalud } from './routes/salud.rutas.js';

export function crearAplicacion({
  claveAdministracion = entorno.claveAdministracionDesarrollo,
  entornoEjecucion = entorno.nodeEnv,
  repositorioUsuarios,
  registrarSolicitudes = entornoEjecucion !== 'test',
} = {}) {
  const aplicacion = express();

  aplicacion.disable('x-powered-by');
  aplicacion.use(helmet());
  aplicacion.use(cors({ origin: entorno.corsOrigin }));
  aplicacion.use(validarTipoContenidoJson);
  aplicacion.use(express.json({ limit: '1mb' }));
  aplicacion.use(express.urlencoded({ extended: false }));

  if (registrarSolicitudes) {
    aplicacion.use(morgan(entornoEjecucion === 'production' ? 'combined' : 'dev'));
  }

  aplicacion.get('/api', (_solicitud, respuesta) => {
    respuesta.json({
      nombre: 'API Entrada UPT',
      version: '1.0.0',
    });
  });

  aplicacion.use('/api/salud', enrutadorSalud);
  // Se conserva temporalmente mientras los clientes migran a la ruta en español.
  aplicacion.use('/api/health', enrutadorSalud);
  aplicacion.use(
    '/api/administracion',
    crearEnrutadorAdministracionUsuarios({
      claveAdministracion,
      entornoEjecucion,
      repositorio: repositorioUsuarios,
    }),
  );

  aplicacion.use(rutaNoEncontrada);
  aplicacion.use(manejarErrores);

  return aplicacion;
}

export const app = crearAplicacion();
