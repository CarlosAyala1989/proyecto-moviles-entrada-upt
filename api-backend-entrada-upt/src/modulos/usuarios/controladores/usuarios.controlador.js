import { ErrorHttp } from '../../../middleware/manejo_errores.js';

function exigirUsuario(usuario) {
  if (!usuario) {
    throw new ErrorHttp({
      codigo: 'USUARIO_NO_ENCONTRADO',
      mensaje: 'El usuario solicitado no existe.',
      estadoHttp: 404,
    });
  }
  return usuario;
}

export function crearControladorUsuarios(repositorio) {
  return {
    crear: async (solicitud, respuesta) => {
      const usuario = await repositorio.crear(solicitud.datosValidados.cuerpo);
      respuesta.status(201).json({ datos: usuario });
    },

    consultar: async (solicitud, respuesta) => {
      const resultado = await repositorio.consultar(
        solicitud.datosValidados.consulta,
      );
      respuesta.json({
        datos: resultado.usuarios,
        paginacion: resultado.paginacion,
      });
    },

    obtener: async (solicitud, respuesta) => {
      const usuario = exigirUsuario(await repositorio.obtenerPorId(
        solicitud.datosValidados.parametros.id,
      ));
      respuesta.json({ datos: usuario });
    },

    actualizar: async (solicitud, respuesta) => {
      const usuario = await repositorio.actualizar(
        solicitud.datosValidados.parametros.id,
        solicitud.datosValidados.cuerpo,
      );
      respuesta.json({ datos: usuario });
    },

    actualizarEstado: async (solicitud, respuesta) => {
      const usuario = await repositorio.actualizarEstado(
        solicitud.datosValidados.parametros.id,
        solicitud.datosValidados.cuerpo,
      );
      respuesta.json({ datos: usuario });
    },

    asignarRoles: async (solicitud, respuesta) => {
      const usuario = await repositorio.asignarRoles(
        solicitud.datosValidados.parametros.id,
        solicitud.datosValidados.cuerpo.roles,
      );
      respuesta.json({ datos: usuario });
    },

    consultarRoles: async (_solicitud, respuesta) => {
      const roles = await repositorio.consultarRoles();
      respuesta.json({ datos: roles });
    },
  };
}
