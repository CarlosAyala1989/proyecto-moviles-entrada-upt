import { ErrorHttp } from '../../../middleware/manejo_errores.js';
import { separarNombreIntranet } from './conciliacion_identidad.servicio.js';

export async function consumirPerfilIntranet(servicio, id) {
  const perfil = await servicio.obtenerVerificacion(id);
  if (!servicio.consumirVerificacion(id)) {
    throw new ErrorHttp({ codigo: 'VERIFICACION_INTRANET_EXPIRADA', mensaje: 'La verificación ya se utilizó o venció. Solicita otro CAPTCHA.', estadoHttp: 410 });
  }
  if (!/^\d{10}$/.test(perfil.codigo)) {
    throw new ErrorHttp({ codigo: 'CODIGO_INTRANET_INVALIDO', mensaje: 'La intranet no devolvió un código válido.', estadoHttp: 422 });
  }
  return perfil;
}

export class ServicioAccesoIntranet {
  constructor({ servicioIntranet, repositorio, servicioAutenticacion }) {
    Object.assign(this, { servicioIntranet, repositorio, servicioAutenticacion });
  }

  async iniciar(perfilVerificado, metadatos) {
    const perfil = await consumirPerfilIntranet(this.servicioIntranet, perfilVerificado.verificacion_intranet_id);
    const nombre = separarNombreIntranet(perfil.nombre_apellidos);
    if (!nombre) throw new ErrorHttp({ codigo: 'NOMBRE_INTRANET_INVALIDO', mensaje: 'La intranet no devolvió un nombre completo válido.', estadoHttp: 422 });
    const usuario = await this.repositorio.registrarIdentidadIntranet({
      codigo: perfil.codigo, nombres: nombre.nombres, apellidos: nombre.apellidos,
      nombreIntranet: perfil.nombre_apellidos, escuelaProfesional: perfil.escuela_profesional,
    });
    return this.servicioAutenticacion.iniciarSesionVerificada({ usuario, metadatos, proveedor: 'INTRANET' });
  }
}
