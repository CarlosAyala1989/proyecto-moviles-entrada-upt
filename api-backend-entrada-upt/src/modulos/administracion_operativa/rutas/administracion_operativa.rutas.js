import { Router } from 'express';
import { requerirRoles } from '../../../middleware/requerir_roles.js';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorAdministracionOperativa } from '../controladores/administracion_operativa.controlador.js';
import { RepositorioAdministracionOperativaMariaDb } from '../repositorios/repositorio_administracion_operativa_mariadb.js';
import {
  esquemaActualizarConfiguracion,
  esquemaActualizarPuntoAcceso,
  esquemaClaveConfiguracion,
  esquemaConsultaVacia,
  esquemaConsultarAccesos,
  esquemaConsultarAuditoria,
  esquemaConsultarPuntosAcceso,
  esquemaCrearPuntoAcceso,
  esquemaId,
} from '../validacion/administracion_operativa.esquemas.js';

export function crearEnrutadorAdministracionOperativa({
  requerirAutenticacion,
  repositorio = new RepositorioAdministracionOperativaMariaDb(),
  protegerRutas = true,
}) {
  const enrutador = Router();
  const controlador = crearControladorAdministracionOperativa(repositorio);

  if (protegerRutas) {
    enrutador.use(requerirAutenticacion, requerirRoles('ADMINISTRADOR'));
  }
  enrutador.get(
    '/resumen',
    validarDatos({ consulta: esquemaConsultaVacia }),
    controlador.consultarResumen,
  );
  enrutador.get(
    '/accesos',
    validarDatos({ consulta: esquemaConsultarAccesos }),
    controlador.consultarAccesos,
  );
  enrutador.get(
    '/accesos/:id',
    validarDatos({ parametros: esquemaId, consulta: esquemaConsultaVacia }),
    controlador.obtenerAcceso,
  );
  enrutador.get(
    '/puntos-acceso',
    validarDatos({ consulta: esquemaConsultarPuntosAcceso }),
    controlador.consultarPuntosAcceso,
  );
  enrutador.post(
    '/puntos-acceso',
    validarDatos({ cuerpo: esquemaCrearPuntoAcceso }),
    controlador.crearPuntoAcceso,
  );
  enrutador.patch(
    '/puntos-acceso/:id',
    validarDatos({ parametros: esquemaId, cuerpo: esquemaActualizarPuntoAcceso }),
    controlador.actualizarPuntoAcceso,
  );
  enrutador.get(
    '/auditoria',
    validarDatos({ consulta: esquemaConsultarAuditoria }),
    controlador.consultarAuditoria,
  );
  enrutador.get(
    '/configuraciones',
    validarDatos({ consulta: esquemaConsultaVacia }),
    controlador.consultarConfiguraciones,
  );
  enrutador.put(
    '/configuraciones/:clave',
    validarDatos({
      parametros: esquemaClaveConfiguracion,
      cuerpo: esquemaActualizarConfiguracion,
    }),
    controlador.actualizarConfiguracion,
  );

  return enrutador;
}
