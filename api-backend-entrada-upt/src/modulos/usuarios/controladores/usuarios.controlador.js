import bcrypt from 'bcryptjs';
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
      const datos = { ...solicitud.datosValidados.cuerpo };
      if (datos.contrasena) {
        datos.contrasena_hash = await bcrypt.hash(datos.contrasena, 12);
        delete datos.contrasena;
      }
      const usuario = await repositorio.crear(
        datos,
        solicitud.usuarioAutenticado.id,
      );
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
        solicitud.usuarioAutenticado.id,
      );
      respuesta.json({ datos: usuario });
    },

    actualizarEstado: async (solicitud, respuesta) => {
      const usuarioId = solicitud.datosValidados.parametros.id;
      const datos = solicitud.datosValidados.cuerpo;
      if (
        usuarioId === solicitud.usuarioAutenticado.id
        && (datos.estado === 'INACTIVO'
          || datos.estado === 'BLOQUEADO'
          || datos.estado === 'RECHAZADO'
          || datos.estado_autorizacion === 'DENEGADO')
      ) {
        throw new ErrorHttp({
          codigo: 'ADMINISTRADOR_NO_PUEDE_DESHABILITARSE',
          mensaje: 'Un administrador no puede deshabilitar su propia cuenta.',
          estadoHttp: 409,
        });
      }
      const usuario = await repositorio.actualizarEstado(
        usuarioId,
        datos,
        solicitud.usuarioAutenticado.id,
      );
      respuesta.json({ datos: usuario });
    },

    asignarRoles: async (solicitud, respuesta) => {
      const usuarioId = solicitud.datosValidados.parametros.id;
      const roles = solicitud.datosValidados.cuerpo.roles;
      if (
        usuarioId === solicitud.usuarioAutenticado.id
        && !roles.includes('ADMINISTRADOR')
      ) {
        throw new ErrorHttp({
          codigo: 'ADMINISTRADOR_NO_PUEDE_QUITARSE_ROL',
          mensaje: 'Un administrador no puede quitarse su propio rol administrativo.',
          estadoHttp: 409,
        });
      }
      const usuario = await repositorio.asignarRoles(
        usuarioId,
        roles,
        solicitud.usuarioAutenticado.id,
      );
      respuesta.json({ datos: usuario });
    },

    cambiarContrasena: async (solicitud, respuesta) => {
      const contrasenaHash = await bcrypt.hash(
        solicitud.datosValidados.cuerpo.contrasena,
        12,
      );
      await repositorio.cambiarContrasena(
        solicitud.datosValidados.parametros.id,
        contrasenaHash,
        solicitud.usuarioAutenticado.id,
      );
      respuesta.status(204).end();
    },

    consultarRoles: async (_solicitud, respuesta) => {
      const roles = await repositorio.consultarRoles();
      respuesta.json({ datos: roles });
    },
  };
}
