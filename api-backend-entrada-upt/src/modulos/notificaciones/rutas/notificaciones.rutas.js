import { Router } from 'express';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorNotificaciones } from '../controladores/notificaciones.controlador.js';
import { RepositorioNotificacionesMariaDb } from '../repositorios/repositorio_notificaciones_mariadb.js';
import {
  esquemaConsultarNotificaciones, esquemaConsultaVacia, esquemaCuerpoLectura,
  esquemaIdNotificacion,
} from '../validacion/notificaciones.esquemas.js';

export function crearEnrutadorNotificaciones({
  requerirAutenticacion,
  repositorio = new RepositorioNotificacionesMariaDb(),
}) {
  const enrutador = Router();
  const controlador = crearControladorNotificaciones(repositorio);
  enrutador.use(requerirAutenticacion, (_solicitud, respuesta, siguiente) => {
    respuesta.set('Cache-Control', 'no-store');
    siguiente();
  });
  enrutador.get('/', validarDatos({ consulta: esquemaConsultarNotificaciones }), controlador.consultar);
  enrutador.get('/resumen', validarDatos({ consulta: esquemaConsultaVacia }), controlador.consultarResumen);
  enrutador.get('/:id', validarDatos({ parametros: esquemaIdNotificacion, consulta: esquemaConsultaVacia }), controlador.obtener);
  enrutador.patch('/:id/leida', validarDatos({
    parametros: esquemaIdNotificacion, consulta: esquemaConsultaVacia, cuerpo: esquemaCuerpoLectura,
  }), controlador.marcarLeida);
  return enrutador;
}
