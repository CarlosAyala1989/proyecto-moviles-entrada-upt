import { ErrorHttp } from '../../../middleware/manejo_errores.js';
import { generarCodigoQrOpaco } from '../../../seguridad/codigos_qr.js';

function errorConfiguracion() {
  return new ErrorHttp({
    codigo: 'CONFIGURACION_CODIGO_QR_INVALIDA',
    mensaje: 'La generación de códigos QR no está configurada correctamente.',
    estadoHttp: 503,
  });
}

function numeroPositivo(configuracion, clave, { entero = false } = {}) {
  const valor = Number(configuracion[clave]);
  if (!Number.isFinite(valor) || valor <= 0 || (entero && !Number.isInteger(valor))) {
    throw errorConfiguracion();
  }
  return valor;
}

function interpretarConfiguracion(configuracion) {
  const valorUnSoloUso = configuracion.QR_UN_SOLO_USO;
  if (valorUnSoloUso !== 'true' && valorUnSoloUso !== 'false') {
    throw errorConfiguracion();
  }

  return {
    duracionSegundos: numeroPositivo(configuracion, 'DURACION_QR_SEGUNDOS', {
      entero: true,
    }),
    antiguedadMaximaSegundos: numeroPositivo(
      configuracion,
      'ANTIGUEDAD_MAXIMA_UBICACION_SEGUNDOS',
      { entero: true },
    ),
    desfaseFuturoSegundos: numeroPositivo(
      configuracion,
      'DESFASE_FUTURO_UBICACION_SEGUNDOS',
      { entero: true },
    ),
    precisionMaximaMetros: numeroPositivo(
      configuracion,
      'PRECISION_MAXIMA_UBICACION_METROS',
    ),
    unSoloUso: valorUnSoloUso === 'true',
  };
}

function validarMomentoYPrecision(ubicacion, configuracion) {
  const momentoUbicacion = new Date(ubicacion.obtenida_en).getTime();
  const antiguedadSegundos = (Date.now() - momentoUbicacion) / 1000;

  if (antiguedadSegundos > configuracion.antiguedadMaximaSegundos) {
    throw new ErrorHttp({
      codigo: 'UBICACION_DESACTUALIZADA',
      mensaje: 'La ubicación fue obtenida hace demasiado tiempo.',
      estadoHttp: 422,
    });
  }
  if (antiguedadSegundos < -configuracion.desfaseFuturoSegundos) {
    throw new ErrorHttp({
      codigo: 'MOMENTO_UBICACION_INVALIDO',
      mensaje: 'El momento informado para la ubicación no es válido.',
      estadoHttp: 422,
    });
  }
  if (ubicacion.precision_metros > configuracion.precisionMaximaMetros) {
    throw new ErrorHttp({
      codigo: 'PRECISION_UBICACION_INSUFICIENTE',
      mensaje: 'La precisión informada no permite validar la zona de acceso.',
      estadoHttp: 422,
    });
  }
}

function normalizarEstadoActual(credencial) {
  if (!credencial) return null;
  return {
    ...credencial,
    emitida_en: credencial.emitida_en.toISOString(),
    expira_en: credencial.expira_en.toISOString(),
    revocada_en: credencial.revocada_en?.toISOString() ?? null,
  };
}

export function crearServicioCodigosQr(repositorio) {
  return {
    generar: async ({ usuarioId, sesionId, ubicacion }) => {
      const configuracion = interpretarConfiguracion(
        await repositorio.consultarConfiguracion(),
      );
      validarMomentoYPrecision(ubicacion, configuracion);

      const codigo = generarCodigoQrOpaco();
      const credencial = await repositorio.generar({
        usuarioId,
        sesionId,
        ubicacion: {
          ...ubicacion,
          obtenida_en: new Date(ubicacion.obtenida_en),
        },
        duracionSegundos: configuracion.duracionSegundos,
        tokenHash: codigo.tokenHash,
        otpHash: codigo.otpHash,
        nonceHash: codigo.nonceHash,
      });

      return {
        codigo_qr: codigo.codigoQr,
        formato: 'UPT_QR_V1',
        estado: 'PENDIENTE',
        emitida_en: credencial.emitida_en.toISOString(),
        expira_en: credencial.expira_en.toISOString(),
        duracion_segundos: configuracion.duracionSegundos,
        un_solo_uso: configuracion.unSoloUso,
        ubicacion: {
          resultado: 'DENTRO_DE_ZONA_CONFIGURADA',
          precision_reportada_metros: ubicacion.precision_metros,
          distancia_calculada_metros: Number(
            credencial.punto_acceso.distancia_metros.toFixed(2),
          ),
          punto_acceso: {
            codigo: credencial.punto_acceso.codigo,
            nombre: credencial.punto_acceso.nombre,
          },
        },
      };
    },

    consultarActual: async (usuarioId) => normalizarEstadoActual(
      await repositorio.consultarActual(usuarioId),
    ),

    revocarActual: (usuarioId) => repositorio.revocarActual(usuarioId),
  };
}
