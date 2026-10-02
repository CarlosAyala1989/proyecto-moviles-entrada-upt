import { ErrorHttp } from './manejo_errores.js';

export function requerirRoles(...rolesPermitidos) {
  return (solicitud, _respuesta, siguiente) => {
    const rolesUsuario = solicitud.usuarioAutenticado?.roles ?? [];
    if (!rolesPermitidos.some((rol) => rolesUsuario.includes(rol))) {
      siguiente(new ErrorHttp({
        codigo: 'ROL_NO_AUTORIZADO',
        mensaje: 'El usuario no tiene el rol necesario para esta operación.',
        estadoHttp: 403,
      }));
      return;
    }
    siguiente();
  };
}
