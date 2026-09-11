import {
  interpretarConfiguracionCodigosQr,
  validarMomentoYPrecision,
} from '../../codigos_qr/servicios/codigos_qr.servicio.js';
import { interpretarCodigoQr } from '../../../seguridad/codigos_qr.js';

function normalizarResultado(resultado) {
  return {
    resultado: resultado.resultado,
    motivo: resultado.motivo,
    mensaje: resultado.mensaje,
    registrado_en: resultado.registradoEn.toISOString(),
    punto_acceso: resultado.puntoAcceso,
    ...(resultado.identidad ? { identidad: resultado.identidad } : {}),
  };
}

export function crearServicioIngresos(repositorio) {
  return {
    validar: async ({
      codigo_qr: codigoQr,
      punto_acceso_codigo: puntoAccesoCodigo,
      ubicacion,
      usuarioSeguridadId,
    }) => {
      const configuracion = interpretarConfiguracionCodigosQr(
        await repositorio.consultarConfiguracion(),
      );
      validarMomentoYPrecision(ubicacion, configuracion);

      const resultado = await repositorio.validar({
        codigo: interpretarCodigoQr(codigoQr),
        puntoAccesoCodigo,
        ubicacion: {
          ...ubicacion,
          obtenida_en: new Date(ubicacion.obtenida_en),
        },
        usuarioSeguridadId,
        unSoloUso: configuracion.unSoloUso,
      });

      return normalizarResultado(resultado);
    },

    consultarRecientes: ({ usuarioSeguridadId, limite }) => (
      repositorio.consultarRecientes({ usuarioSeguridadId, limite })
    ),
  };
}
