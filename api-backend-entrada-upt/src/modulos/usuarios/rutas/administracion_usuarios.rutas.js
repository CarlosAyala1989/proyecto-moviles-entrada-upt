import { Router } from 'express';
import { requerirRoles } from '../../../middleware/requerir_roles.js';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorUsuarios } from '../controladores/usuarios.controlador.js';
import { RepositorioUsuariosMariaDb } from '../repositorios/repositorio_usuarios_mariadb.js';
import {
  esquemaActualizarEstado,
  esquemaActualizarUsuario,
  esquemaAsignarRoles,
  esquemaCambiarContrasena,
  esquemaConsultarUsuarios,
  esquemaCrearUsuario,
  esquemaIdUsuario,
} from '../validacion/usuarios.esquemas.js';

export function crearEnrutadorAdministracionUsuarios({
  requerirAutenticacion,
  repositorio = new RepositorioUsuariosMariaDb(),
}) {
  const enrutador = Router();
  const controlador = crearControladorUsuarios(repositorio);

  enrutador.use(requerirAutenticacion, requerirRoles('ADMINISTRADOR'));

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
  enrutador.put(
    '/usuarios/:id/credencial-local',
    validarDatos({ parametros: esquemaIdUsuario, cuerpo: esquemaCambiarContrasena }),
    controlador.cambiarContrasena,
  );

  return enrutador;
}
