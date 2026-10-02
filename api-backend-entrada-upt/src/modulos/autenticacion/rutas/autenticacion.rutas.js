import { Router } from 'express';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorAutenticacion } from '../controladores/autenticacion.controlador.js';
import {
  esquemaIniciarSesion,
  esquemaRenovarSesion,
} from '../validacion/autenticacion.esquemas.js';

export function crearEnrutadorAutenticacion({ servicio, requerirAutenticacion }) {
  const enrutador = Router();
  const controlador = crearControladorAutenticacion(servicio);

  enrutador.post(
    '/iniciar-sesion',
    validarDatos({ cuerpo: esquemaIniciarSesion }),
    controlador.iniciarSesion,
  );
  enrutador.post(
    '/renovar-sesion',
    validarDatos({ cuerpo: esquemaRenovarSesion }),
    controlador.renovarSesion,
  );
  enrutador.get('/sesion', requerirAutenticacion, controlador.consultarSesion);
  enrutador.post('/cerrar-sesion', requerirAutenticacion, controlador.cerrarSesion);

  return enrutador;
}
