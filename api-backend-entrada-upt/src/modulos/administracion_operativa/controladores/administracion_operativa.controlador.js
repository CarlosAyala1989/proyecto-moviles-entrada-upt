import { ErrorHttp } from '../../../middleware/manejo_errores.js';

const reglasConfiguracion = {
  DURACION_QR_SEGUNDOS: {
    tipo: 'ENTERO',
    minimo: 15,
    maximo: 300,
    editable: true,
  },
  QR_UN_SOLO_USO: {
    tipo: 'BOOLEANO',
    editable: false,
  },
  ANTIGUEDAD_MAXIMA_UBICACION_SEGUNDOS: {
    tipo: 'ENTERO',
    minimo: 5,
    maximo: 120,
    editable: true,
  },
  DESFASE_FUTURO_UBICACION_SEGUNDOS: {
    tipo: 'ENTERO',
    minimo: 1,
    maximo: 30,
    editable: true,
  },
  PRECISION_MAXIMA_UBICACION_METROS: {
    tipo: 'DECIMAL',
    minimo: 5,
    maximo: 500,
    editable: true,
  },
};

function interpretarValor(valor, tipo) {
  if (tipo === 'BOOLEANO') return valor === 'true';
  return Number(valor);
}

function prepararConfiguracion(configuracion) {
  const regla = reglasConfiguracion[configuracion.clave];
  return {
    clave: configuracion.clave,
    valor: interpretarValor(configuracion.valor, configuracion.tipo),
    tipo: configuracion.tipo,
    descripcion: configuracion.descripcion,
    editable: Boolean(regla?.editable),
    actualizado_en: configuracion.actualizado_en,
  };
}

function validarNuevoValor(clave, valor) {
  const regla = reglasConfiguracion[clave];
  if (!regla?.editable) {
    throw new ErrorHttp({
      codigo: 'CONFIGURACION_NO_EDITABLE',
      mensaje: 'La configuración solicitada no puede modificarse mediante la API.',
      estadoHttp: 403,
    });
  }
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ErrorHttp({
      codigo: 'VALOR_CONFIGURACION_INVALIDO',
      mensaje: 'El valor de la configuración no es válido.',
      estadoHttp: 400,
    });
  }
  if (
    (regla.tipo === 'ENTERO' && !Number.isInteger(valor))
    || valor < regla.minimo
    || valor > regla.maximo
  ) {
    throw new ErrorHttp({
      codigo: 'VALOR_CONFIGURACION_FUERA_DE_RANGO',
      mensaje: `El valor debe estar entre ${regla.minimo} y ${regla.maximo}.`,
      estadoHttp: 400,
    });
  }
  return String(valor);
}

export function crearControladorAdministracionOperativa(repositorio) {
  return {
    consultarResumen: async (_solicitud, respuesta) => {
      respuesta.json({ datos: await repositorio.consultarResumen() });
    },

    consultarAccesos: async (solicitud, respuesta) => {
      const resultado = await repositorio.consultarAccesos(
        solicitud.datosValidados.consulta,
      );
      respuesta.json({ datos: resultado.registros, paginacion: resultado.paginacion });
    },

    obtenerAcceso: async (solicitud, respuesta) => {
      const registro = await repositorio.obtenerAcceso(
        solicitud.datosValidados.parametros.id,
      );
      if (!registro) {
        throw new ErrorHttp({
          codigo: 'REGISTRO_ACCESO_NO_ENCONTRADO',
          mensaje: 'El registro de acceso solicitado no existe.',
          estadoHttp: 404,
        });
      }
      respuesta.json({ datos: registro });
    },

    consultarPuntosAcceso: async (solicitud, respuesta) => {
      const resultado = await repositorio.consultarPuntosAcceso(
        solicitud.datosValidados.consulta,
      );
      respuesta.json({ datos: resultado.puntos, paginacion: resultado.paginacion });
    },

    crearPuntoAcceso: async (solicitud, respuesta) => {
      const punto = await repositorio.crearPuntoAcceso(
        solicitud.datosValidados.cuerpo,
        solicitud.usuarioAutenticado.id,
      );
      respuesta.status(201).json({ datos: punto });
    },

    actualizarPuntoAcceso: async (solicitud, respuesta) => {
      const punto = await repositorio.actualizarPuntoAcceso(
        solicitud.datosValidados.parametros.id,
        solicitud.datosValidados.cuerpo,
        solicitud.usuarioAutenticado.id,
      );
      respuesta.json({ datos: punto });
    },

    consultarAuditoria: async (solicitud, respuesta) => {
      const resultado = await repositorio.consultarAuditoria(
        solicitud.datosValidados.consulta,
      );
      respuesta.json({ datos: resultado.registros, paginacion: resultado.paginacion });
    },

    consultarConfiguraciones: async (_solicitud, respuesta) => {
      const configuraciones = await repositorio.consultarConfiguraciones(
        Object.keys(reglasConfiguracion),
      );
      respuesta.json({ datos: configuraciones.map(prepararConfiguracion) });
    },

    actualizarConfiguracion: async (solicitud, respuesta) => {
      const { clave } = solicitud.datosValidados.parametros;
      const valor = validarNuevoValor(
        clave,
        solicitud.datosValidados.cuerpo.valor,
      );
      const configuracion = await repositorio.actualizarConfiguracion(
        clave,
        valor,
        solicitud.usuarioAutenticado.id,
      );
      respuesta.json({ datos: prepararConfiguracion(configuracion) });
    },
  };
}
