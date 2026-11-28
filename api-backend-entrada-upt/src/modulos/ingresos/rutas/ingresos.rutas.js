import { Router } from 'express';
import { requerirRoles } from '../../../middleware/requerir_roles.js';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorIngresos } from '../controladores/ingresos.controlador.js';
import { RepositorioIngresosMariaDb } from '../repositorios/repositorio_ingresos_mariadb.js';
import { crearServicioIngresos } from '../servicios/ingresos.servicio.js';
import {
  esquemaConsultarHistorialPersonal,
  esquemaConsultarIngresosRecientes,
  esquemaValidarIngreso,
} from '../validacion/ingresos.esquemas.js';

export function crearEnrutadorIngresos({
  requerirAutenticacion,
  sinGeocerca = false,
  repositorio = new RepositorioIngresosMariaDb({ sinGeocerca }),
}) {
  const enrutador = Router();
  const servicio = crearServicioIngresos(repositorio, { sinGeocerca });
  const controlador = crearControladorIngresos(servicio);

  enrutador.use(requerirAutenticacion);
  enrutador.get(
    '/historial',
    validarDatos({ consulta: esquemaConsultarHistorialPersonal }),
    controlador.consultarHistorialPersonal,
  );
  enrutador.use(requerirRoles('SEGURIDAD'));
  enrutador.post(
    '/validar',
    validarDatos({ cuerpo: sinGeocerca ? esquemaValidarIngreso.extend({ ubicacion: esquemaValidarIngreso.shape.ubicacion.optional() }) : esquemaValidarIngreso }),
    controlador.validar,
  );
  enrutador.get(
    '/recientes',
    validarDatos({ consulta: sinGeocerca ? esquemaConsultarIngresosRecientes.safeExtend({ latitud: esquemaConsultarIngresosRecientes.shape.latitud.optional(), longitud: esquemaConsultarIngresosRecientes.shape.longitud.optional(), precision_metros: esquemaConsultarIngresosRecientes.shape.precision_metros.optional(), obtenida_en: esquemaConsultarIngresosRecientes.shape.obtenida_en.optional() }) : esquemaConsultarIngresosRecientes }),
    controlador.consultarRecientes,
  );

  return enrutador;
}
