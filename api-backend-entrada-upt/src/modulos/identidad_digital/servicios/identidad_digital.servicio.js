import { ErrorHttp } from '../../../middleware/manejo_errores.js';

const rolesPortadores = new Set(['ESTUDIANTE', 'DOCENTE', 'TRABAJADOR']);

function errorUsuarioNoHabilitado() {
  return new ErrorHttp({
    codigo: 'USUARIO_NO_HABILITADO',
    mensaje: 'El usuario no está habilitado para utilizar el sistema.',
    estadoHttp: 403,
  });
}

function prepararCodigoQr(identidad) {
  const tieneRolPortador = identidad.roles.some((rol) => rolesPortadores.has(rol));
  const requisitos = {
    usuario_activo: identidad.estado === 'ACTIVO',
    acceso_autorizado: identidad.estado_autorizacion === 'AUTORIZADO',
    identidad_verificada: identidad.identidad_verificada,
    rol_portador: tieneRolPortador,
  };

  return {
    puede_solicitar: Object.values(requisitos).every(Boolean),
    requisitos,
  };
}

export function crearServicioIdentidadDigital(repositorio) {
  return {
    consultarPropia: async (usuarioId) => {
      const identidad = await repositorio.consultarPorUsuarioId(usuarioId);
      if (!identidad) {
        throw new ErrorHttp({
          codigo: 'IDENTIDAD_DIGITAL_NO_ENCONTRADA',
          mensaje: 'No se encontró la identidad digital solicitada.',
          estadoHttp: 404,
        });
      }
      if (
        identidad.estado !== 'ACTIVO'
        || identidad.estado_autorizacion !== 'AUTORIZADO'
      ) {
        throw errorUsuarioNoHabilitado();
      }

      return {
        id: identidad.id,
        codigo_institucional: identidad.codigo_institucional,
        correo_institucional: identidad.correo_institucional,
        nombres: identidad.nombres,
        apellidos: identidad.apellidos,
        nombre_completo: identidad.nombre_completo,
        foto_url: identidad.foto_url,
        roles: identidad.roles,
        verificacion: {
          estado: identidad.identidad_verificada ? 'VERIFICADA' : 'PENDIENTE',
          verificada_en: identidad.identidad_verificada_en,
        },
        acceso: {
          estado_usuario: identidad.estado,
          estado_autorizacion: identidad.estado_autorizacion,
        },
        perfil_academico: identidad.perfil_academico,
        preparacion_codigo_qr: prepararCodigoQr(identidad),
        actualizado_en: identidad.actualizado_en,
      };
    },
  };
}
