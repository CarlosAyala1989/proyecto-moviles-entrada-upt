import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { entorno } from './config/env.js';
import { manejarErrores, rutaNoEncontrada } from './middleware/manejo_errores.js';
import { crearRequerirAutenticacion } from './middleware/requerir_autenticacion.js';
import { validarTipoContenidoJson } from './middleware/validar_solicitud.js';
import { crearEnrutadorAdministracion } from './modulos/administracion/rutas/administracion.rutas.js';
import { RepositorioAutenticacionMariaDb } from './modulos/autenticacion/repositorios/repositorio_autenticacion_mariadb.js';
import { crearEnrutadorAutenticacion } from './modulos/autenticacion/rutas/autenticacion.rutas.js';
import { crearServicioAutenticacion } from './modulos/autenticacion/servicios/autenticacion.servicio.js';
import { crearEnrutadorCodigosQr } from './modulos/codigos_qr/rutas/codigos_qr.rutas.js';
import { crearEnrutadorIdentidadDigital } from './modulos/identidad_digital/rutas/identidad_digital.rutas.js';
import { crearEnrutadorIngresos } from './modulos/ingresos/rutas/ingresos.rutas.js';
import { enrutadorSalud } from './routes/salud.rutas.js';

export function crearAplicacion({
  configuracionAutenticacion = entorno.autenticacion,
  entornoEjecucion = entorno.nodeEnv,
  repositorioAutenticacion,
  repositorioAdministracionOperativa,
  repositorioCodigosQr,
  repositorioIdentidadDigital,
  repositorioIngresos,
  repositorioUsuarios,
  registrarSolicitudes = entornoEjecucion !== 'test',
} = {}) {
  const aplicacion = express();
  const repositorioSesiones = repositorioAutenticacion
    ?? new RepositorioAutenticacionMariaDb();
  const servicioAutenticacion = crearServicioAutenticacion(
    repositorioSesiones,
    configuracionAutenticacion,
  );
  const requerirAutenticacion = crearRequerirAutenticacion(
    servicioAutenticacion,
  );

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
    '/api/autenticacion',
    crearEnrutadorAutenticacion({
      servicio: servicioAutenticacion,
      requerirAutenticacion,
    }),
  );
  aplicacion.use(
    '/api/identidad-digital',
    crearEnrutadorIdentidadDigital({
      requerirAutenticacion,
      repositorio: repositorioIdentidadDigital,
    }),
  );
  aplicacion.use(
    '/api/codigos-qr',
    crearEnrutadorCodigosQr({
      requerirAutenticacion,
      repositorio: repositorioCodigosQr,
    }),
  );
  aplicacion.use(
    '/api/ingresos',
    crearEnrutadorIngresos({
      requerirAutenticacion,
      repositorio: repositorioIngresos,
    }),
  );
  aplicacion.use(
    '/api/administracion',
    crearEnrutadorAdministracion({
      requerirAutenticacion,
      repositorioAdministracionOperativa,
      repositorioUsuarios,
    }),
  );

  aplicacion.use(rutaNoEncontrada);
  aplicacion.use(manejarErrores);

  return aplicacion;
}

export const app = crearAplicacion();
