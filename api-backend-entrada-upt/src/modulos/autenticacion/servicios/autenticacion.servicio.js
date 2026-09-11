import bcrypt from 'bcryptjs';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';
import {
  calcularHashIdentificador,
  calcularHashToken,
  generarTokenOpaco,
} from '../../../seguridad/tokens.js';

const hashComparacionFicticio = bcrypt.hashSync(
  'Credencial-ficticia-para-comparacion-1!',
  12,
);

function respuestaSesion(resultado, tokens) {
  return {
    tipo_token: 'Bearer',
    token_acceso: tokens.tokenAcceso,
    token_renovacion: tokens.tokenRenovacion,
    token_acceso_expira_en: resultado.accesoExpiraEn.toISOString(),
    token_renovacion_expira_en: resultado.renovacionExpiraEn.toISOString(),
    usuario: resultado.usuario,
  };
}

function generarTokens() {
  return {
    tokenAcceso: generarTokenOpaco('acceso'),
    tokenRenovacion: generarTokenOpaco('renovacion'),
  };
}

function errorCredencialesInvalidas() {
  return new ErrorHttp({
    codigo: 'CREDENCIALES_INVALIDAS',
    mensaje: 'El identificador o la contraseña no son válidos.',
    estadoHttp: 401,
  });
}

function errorUsuarioNoHabilitado() {
  return new ErrorHttp({
    codigo: 'USUARIO_NO_HABILITADO',
    mensaje: 'El usuario no está habilitado para utilizar el sistema.',
    estadoHttp: 403,
  });
}

export function crearServicioAutenticacion(repositorio, configuracion) {
  if (
    configuracion.duracionTokenRenovacionDias * 24 * 60
    <= configuracion.duracionTokenAccesoMinutos
  ) {
    throw new Error(
      'La duración del token de renovación debe superar a la del token de acceso.',
    );
  }

  return {
    iniciarSesion: async ({ identificador, contrasena, metadatos }) => {
      const usuario = await repositorio.buscarUsuarioPorIdentificador(identificador);
      const identificadorHash = calcularHashIdentificador(identificador);

      if (usuario?.bloqueo_vigente) {
        await bcrypt.compare(contrasena, usuario.contrasena_hash ?? hashComparacionFicticio);
        await repositorio.registrarIntentoRechazado({
          usuario,
          identificadorHash,
          motivo: 'BLOQUEO_TEMPORAL_VIGENTE',
          ...metadatos,
        });
        throw new ErrorHttp({
          codigo: 'INICIO_SESION_BLOQUEADO',
          mensaje: 'El inicio de sesión está bloqueado temporalmente.',
          estadoHttp: 429,
        });
      }

      const contrasenaValida = await bcrypt.compare(
        contrasena,
        usuario?.contrasena_hash ?? hashComparacionFicticio,
      );
      if (!usuario || !usuario.contrasena_hash || !contrasenaValida) {
        await repositorio.registrarFalloInicioSesion({
          usuario,
          identificadorHash,
          maxIntentos: configuracion.maxIntentosInicioSesion,
          duracionBloqueoMinutos: configuracion.duracionBloqueoMinutos,
          ...metadatos,
        });
        throw errorCredencialesInvalidas();
      }

      if (usuario.estado !== 'ACTIVO' || usuario.estado_autorizacion !== 'AUTORIZADO') {
        await repositorio.registrarIntentoRechazado({
          usuario,
          identificadorHash,
          motivo: 'USUARIO_NO_HABILITADO',
          ...metadatos,
        });
        throw errorUsuarioNoHabilitado();
      }

      const tokens = generarTokens();
      const resultado = await repositorio.crearSesion({
        usuario,
        identificadorHash,
        tokenAccesoHash: calcularHashToken(tokens.tokenAcceso),
        tokenRenovacionHash: calcularHashToken(tokens.tokenRenovacion),
        duracionTokenAccesoMinutos: configuracion.duracionTokenAccesoMinutos,
        duracionTokenRenovacionDias: configuracion.duracionTokenRenovacionDias,
        ...metadatos,
      });
      return respuestaSesion(resultado, tokens);
    },

    autenticarTokenAcceso: (token) => repositorio.obtenerSesionPorTokenAcceso(
      calcularHashToken(token),
    ),

    renovarSesion: async (tokenRenovacion) => {
      const tokens = generarTokens();
      const resultado = await repositorio.renovarSesion({
        tokenRenovacionHashActual: calcularHashToken(tokenRenovacion),
        tokenAccesoHashNuevo: calcularHashToken(tokens.tokenAcceso),
        tokenRenovacionHashNuevo: calcularHashToken(tokens.tokenRenovacion),
        duracionTokenAccesoMinutos: configuracion.duracionTokenAccesoMinutos,
        duracionTokenRenovacionDias: configuracion.duracionTokenRenovacionDias,
      });
      return respuestaSesion(resultado, tokens);
    },

    cerrarSesion: ({ sesionId, usuarioId }) => repositorio.revocarSesion(
      sesionId,
      usuarioId,
    ),
  };
}
