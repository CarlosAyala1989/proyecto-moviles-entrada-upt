import { Router } from 'express';
import { requerirClaveAdministracion } from '../../../middleware/requerir_clave_administracion.js';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorUsuarios } from '../controladores/usuarios.controlador.js';
import { RepositorioUsuariosMariaDb } from '../repositorios/repositorio_usuarios_mariadb.js';
import {
  esquemaActualizarEstado,
  esquemaActualizarUsuario,
  esquemaAsignarRoles,
  esquemaConsultarUsuarios,
  esquemaCrearUsuario,
  esquemaIdUsuario,
} from '../validacion/usuarios.esquemas.js';

export function crearEnrutadorAdministracionUsuarios({
  claveAdministracion,
  entornoEjecucion,
  repositorio = new RepositorioUsuariosMariaDb(),
}) {
  const enrutador = Router();
  const controlador = crearControladorUsuarios(repositorio);

  enrutador.use(requerirClaveAdministracion({
    clave: claveAdministracion,
    entornoEjecucion,
  }));

  enrutador.get('/roles', controlador.consultarRoles);
  enrutador.get(
    '/usuarios',
    validarDatos({ consulta: esquemaConsultarUsuarios }),
    controlador.consultar,
  );
  enrutador.post(
    '/usuarios',
    validarDatos({ cuerpo: esquemaCrearUsuario }),
    controlador.crear,
  );
  enrutador.get(
    '/usuarios/:id',
    validarDatos({ parametros: esquemaIdUsuario }),
    controlador.obtener,
  );
  enrutador.patch(
    '/usuarios/:id',
    validarDatos({ parametros: esquemaIdUsuario, cuerpo: esquemaActualizarUsuario }),
    controlador.actualizar,
  );
  enrutador.patch(
    '/usuarios/:id/estado',
    validarDatos({ parametros: esquemaIdUsuario, cuerpo: esquemaActualizarEstado }),
    controlador.actualizarEstado,
  );
  enrutador.put(
    '/usuarios/:id/roles',
    validarDatos({ parametros: esquemaIdUsuario, cuerpo: esquemaAsignarRoles }),
    controlador.asignarRoles,
  );

  return enrutador;
}
