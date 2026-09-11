import { Router } from 'express';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorIdentidadDigital } from '../controladores/identidad_digital.controlador.js';
import { RepositorioIdentidadDigitalMariaDb } from '../repositorios/repositorio_identidad_digital_mariadb.js';
import { crearServicioIdentidadDigital } from '../servicios/identidad_digital.servicio.js';
import { esquemaConsultaIdentidadPropia } from '../validacion/identidad_digital.esquemas.js';

export function crearEnrutadorIdentidadDigital({
  requerirAutenticacion,
  repositorio = new RepositorioIdentidadDigitalMariaDb(),
}) {
  const enrutador = Router();
  const servicio = crearServicioIdentidadDigital(repositorio);
  const controlador = crearControladorIdentidadDigital(servicio);

  enrutador.get(
    '/',
    requerirAutenticacion,
    validarDatos({ consulta: esquemaConsultaIdentidadPropia }),
    controlador.consultarPropia,
  );

  return enrutador;
}
