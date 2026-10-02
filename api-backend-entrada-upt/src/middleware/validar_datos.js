import { ErrorHttp } from './manejo_errores.js';

export function validarDatos({ cuerpo, parametros, consulta } = {}) {
  return (solicitud, _respuesta, siguiente) => {
    const resultado = {};
    const validaciones = [
      ['cuerpo', cuerpo, solicitud.body],
      ['parametros', parametros, solicitud.params],
      ['consulta', consulta, solicitud.query],
    ];

    for (const [nombre, esquema, datos] of validaciones) {
      if (!esquema) continue;
      const validacion = esquema.safeParse(datos);
      if (!validacion.success) {
        siguiente(new ErrorHttp({
          codigo: 'DATOS_INVALIDOS',
          mensaje: `Los datos de ${nombre} no son válidos.`,
          estadoHttp: 400,
        }));
        return;
      }
      resultado[nombre] = validacion.data;
    }

    solicitud.datosValidados = resultado;
    siguiente();
  };
}
