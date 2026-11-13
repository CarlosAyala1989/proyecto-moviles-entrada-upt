import {
  interpretarConfiguracionCodigosQr,
  validarMomentoYPrecision,
} from '../../codigos_qr/servicios/codigos_qr.servicio.js';
import { interpretarCodigoQr } from '../../../seguridad/codigos_qr.js';
import { interpretarCodigoOffline } from '../../../seguridad/codigos_qr_offline.js';
import { comprobarUbicacionSeguridad } from '../../seguridad_operativa/seguridad_operativa.js';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';

const acciones = {
  ACCESO_AUTORIZADO: 'Verifica visualmente la fotografía y los datos antes de permitir el paso.',
  TOKEN_INVALIDO: 'Solicita un QR nuevo desde la aplicación del titular.',
  INTEGRIDAD_CREDENCIAL_INVALIDA: 'Solicita un QR nuevo; si se repite, registra una incidencia.',
  CREDENCIAL_EXPIRADA: 'Solicita el código vigente que aparece en la pantalla del titular.',
  CREDENCIAL_REVOCADA: 'Solicita un nuevo código desde una sesión vigente.',
  CREDENCIAL_YA_UTILIZADA: 'Espera la siguiente rotación y escanea el nuevo código.',
  SESION_USUARIO_INVALIDA: 'Pide al titular iniciar sesión de nuevo con conexión.',
  PUNTO_ACCESO_INACTIVO: 'Contacta al administrador para revisar la puerta asignada.',
  PUNTO_ACCESO_NO_COINCIDE: 'Solicita un código válido para esta puerta.',
  UBICACION_ESCANEO_FUERA_DE_ZONA: 'Acércate a tu puerta asignada y comprueba tu ubicación.',
  DISPOSITIVO_NO_VINCULADO: 'Pide al titular vincular su dispositivo con conexión.',
  CODIGO_OFFLINE_NO_VIGENTE: 'Pide al titular sincronizar la hora y mostrar el código actual.',
  FUERA_HORARIO_PERMITIDO: 'Indica al titular que consulte su horario de acceso autorizado.',
};

function normalizarResultado(resultado) {
  const completa = Boolean(resultado.identidad?.nombre_completo?.trim()
    && resultado.identidad?.codigo_institucional?.trim()
    && resultado.identidad?.tipo_usuario?.length);
  if (resultado.resultado === 'AUTORIZADO' && !completa) {
    throw new ErrorHttp({ codigo: 'RESPUESTA_VALIDACION_INCOMPLETA', mensaje: 'No se pudo confirmar una identidad completa.', estadoHttp: 502 });
  }
  return {
    registro_id: resultado.registroId,
    turno_id: resultado.turnoId ?? null,
    puede_confirmar: resultado.resultado === 'AUTORIZADO' && completa,
    resultado: resultado.resultado,
    motivo: resultado.motivo,
    mensaje: resultado.mensaje,
    accion_sugerida: acciones[resultado.motivo] ?? 'Indica al titular que contacte con administración; registra una incidencia si corresponde.',
    registrado_en: resultado.registradoEn.toISOString(),
    punto_acceso: resultado.puntoAcceso,
    ...(resultado.resultado === 'AUTORIZADO' && completa ? { identidad: {
      foto_url: resultado.identidad.foto_url ?? null,
      nombre_completo: resultado.identidad.nombre_completo,
      codigo_institucional: resultado.identidad.codigo_institucional,
      tipo_usuario: resultado.identidad.tipo_usuario,
    } } : {}),
  };
}

export function crearServicioIngresos(repositorio) {
  return {
    consultarHistorialPersonal: (consulta) => repositorio.consultarHistorialPersonal(consulta),

    validar: async ({
      codigo_qr: codigoQr,
      punto_acceso_codigo: puntoAccesoCodigo,
      ubicacion,
      usuarioSeguridadId,
    }) => {
      await comprobarUbicacionSeguridad(usuarioSeguridadId, ubicacion, puntoAccesoCodigo);
      const configuracion = interpretarConfiguracionCodigosQr(
        await repositorio.consultarConfiguracion(),
      );
      validarMomentoYPrecision(ubicacion, configuracion);

      const codigoOffline = interpretarCodigoOffline(codigoQr);
      const resultado = await (codigoOffline ? repositorio.validarOffline({
        codigo: { ...codigoOffline, huellaToken: interpretarCodigoQr(codigoQr).huellaToken },
        puntoAccesoCodigo,
        ubicacion: { ...ubicacion, obtenida_en: new Date(ubicacion.obtenida_en) },
        usuarioSeguridadId,
      }) : repositorio.validar({
        codigo: interpretarCodigoQr(codigoQr),
        puntoAccesoCodigo,
        ubicacion: {
          ...ubicacion,
          obtenida_en: new Date(ubicacion.obtenida_en),
        },
        usuarioSeguridadId,
      }));

      return normalizarResultado(resultado);
    },

    consultarRecientes: async ({ usuarioSeguridadId, ubicacion, ...consulta }) => {
      const asignacion = await comprobarUbicacionSeguridad(usuarioSeguridadId, ubicacion, consulta.punto_acceso_codigo);
      return repositorio.consultarRecientes({ usuarioSeguridadId, ...consulta, puntoId: asignacion.punto_acceso.id });
    },
  };
}
