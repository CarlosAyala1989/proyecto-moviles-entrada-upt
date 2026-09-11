import { Router } from 'express';
import { requerirRoles } from '../../../middleware/requerir_roles.js';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorIngresos } from '../controladores/ingresos.controlador.js';
import { RepositorioIngresosMariaDb } from '../repositorios/repositorio_ingresos_mariadb.js';
import { crearServicioIngresos } from '../servicios/ingresos.servicio.js';
import { esquemaValidarIngreso } from '../validacion/ingresos.esquemas.js';

export function crearEnrutadorIngresos({
  requerirAutenticacion,
  repositorio = new RepositorioIngresosMariaDb(),
}) {
  const enrutador = Router();
  const servicio = crearServicioIngresos(repositorio);
  const controlador = crearControladorIngresos(servicio);

  enrutador.use(requerirAutenticacion, requerirRoles('SEGURIDAD'));
  enrutador.post(
    '/validar',
    validarDatos({ cuerpo: esquemaValidarIngreso }),
    controlador.validar,
  );

  return enrutador;
}
