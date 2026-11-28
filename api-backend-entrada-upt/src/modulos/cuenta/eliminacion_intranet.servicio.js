import { createHash, randomUUID } from 'node:crypto';
import { claveRestricciones } from '../../seguridad/restricciones_identidad_eliminada.js';
import { consumirPerfilIntranet } from '../registro_estudiante/servicios/acceso_intranet.servicio.js';
import { ErrorHttp } from '../../middleware/manejo_errores.js';

const hash = (valor) => createHash('sha256').update(valor).digest('hex');

export class ServicioEliminacionIntranet {
  constructor({ repositorio, servicioIntranet }) {
    Object.assign(this, { repositorio, servicioIntranet });
  }

  obtenerCaptcha() { return this.servicioIntranet.obtenerCaptcha(); }

  async verificar({ transaccion_id: transaccionId, codigo, contrasena, captcha, verificador }) {
    claveRestricciones();
    const verificacion = await this.servicioIntranet.verificarCredenciales({ transaccionId, codigo, contrasena, captcha });
    const perfil = await consumirPerfilIntranet(this.servicioIntranet, verificacion.verificacion_intranet_id);
    if (perfil.codigo !== codigo) throw new ErrorHttp({ codigo: 'IDENTIDAD_INVALIDA', mensaje: 'La identidad verificada no corresponde a tu código.', estadoHttp: 403 });
    const id = randomUUID();
    await this.repositorio.crearVerificadaIntranet({ id, codigo: perfil.codigo, navegadorHash: hash(verificador), expiraEn: new Date(Date.now() + 600_000) });
    return { id, estado: 'LISTA' };
  }

  consultar({ id, verificador }) { return this.repositorio.consultar(id, hash(verificador)); }
  confirmar({ id, verificador }) { return this.repositorio.confirmar(id, hash(verificador)); }
  cancelar({ id, verificador }) { return this.repositorio.cancelar(id, hash(verificador)); }
}
