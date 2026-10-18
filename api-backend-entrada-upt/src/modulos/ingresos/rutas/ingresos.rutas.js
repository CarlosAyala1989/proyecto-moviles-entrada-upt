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
  repositorio = new RepositorioIngresosMariaDb(),
}) {
  const enrutador = Router();
  const servicio = crearServicioIngresos(repositorio);
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
    validarDatos({ cuerpo: esquemaValidarIngreso }),
    controlador.validar,
  );
  enrutador.get(
    '/recientes',
    validarDatos({ consulta: esquemaConsultarIngresosRecientes }),
    controlador.consultarRecientes,
  );

  return enrutador;
}
