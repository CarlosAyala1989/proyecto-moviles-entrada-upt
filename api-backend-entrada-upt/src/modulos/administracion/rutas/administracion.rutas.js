import { Router } from 'express';
import { requerirRoles } from '../../../middleware/requerir_roles.js';
import { crearEnrutadorAdministracionOperativa } from '../../administracion_operativa/rutas/administracion_operativa.rutas.js';
import { crearEnrutadorAdministracionUsuarios } from '../../usuarios/rutas/administracion_usuarios.rutas.js';

export function crearEnrutadorAdministracion({
  requerirAutenticacion,
  repositorioAdministracionOperativa,
  repositorioUsuarios,
}) {
  const enrutador = Router();
  enrutador.use(requerirAutenticacion, requerirRoles('ADMINISTRADOR'));
  enrutador.use(crearEnrutadorAdministracionUsuarios({
    requerirAutenticacion,
    repositorio: repositorioUsuarios,
    protegerRutas: false,
  }));
  enrutador.use(crearEnrutadorAdministracionOperativa({
    requerirAutenticacion,
    repositorio: repositorioAdministracionOperativa,
    protegerRutas: false,
  }));
  return enrutador;
}
