import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { ErrorHttp } from '../../middleware/manejo_errores.js';
import { claveRestricciones } from '../../seguridad/restricciones_identidad_eliminada.js';

const hash = (valor) => createHash('sha256').update(valor).digest('hex');
const error = (codigo, mensaje, estadoHttp) => new ErrorHttp({ codigo, mensaje, estadoHttp });

export class ServicioEliminacionCuenta {
  constructor({ repositorio, configuracion, oauth, ahora = () => Date.now() }) {
    this.repositorio = repositorio;
    this.configuracion = configuracion;
    this.ahora = ahora;
    this.oauth = oauth ?? (configuracion.clientId && configuracion.clientSecret && configuracion.redirectUri
      ? new OAuth2Client(configuracion.clientId, configuracion.clientSecret, configuracion.redirectUri) : null);
  }

  asegurarConfiguracion() {
    claveRestricciones();
    const config = this.configuracion;
    let publica;
    let retorno;
    try { publica = new URL(config.sitioPublico); retorno = new URL(config.redirectUri); } catch { /* configuración incompleta */ }
    const valido = (url) => url && !url.username && !url.password && (url.protocol === 'https:'
      || (config.permitirLocal && ['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol === 'http:'));
    if (!this.oauth || !config.clientId || !config.clientSecret || !valido(publica) || !valido(retorno)) {
      throw error('ELIMINACION_NO_CONFIGURADA', 'La eliminación no está disponible temporalmente. Inténtalo más tarde.', 503);
    }
  }

  paginaRetorno() {
    this.asegurarConfiguracion();
    return new URL('/eliminar-cuenta', this.configuracion.sitioPublico).href;
  }

  async iniciar(verificador) {
    this.asegurarConfiguracion();
    const estado = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const pkce = randomBytes(64).toString('base64url');
    const id = randomUUID();
    await this.repositorio.crear({
      id, estadoHash: hash(estado), nonceHash: hash(nonce), pkce,
      navegadorHash: hash(verificador), expiraEn: new Date(this.ahora() + 10 * 60 * 1000),
    });
    return {
      id,
      url_autorizacion: this.oauth.generateAuthUrl({
        access_type: 'online', scope: ['openid', 'email'], state: estado, nonce,
        hd: this.configuracion.dominio, prompt: 'select_account',
        code_challenge: createHash('sha256').update(pkce).digest('base64url'), code_challenge_method: 'S256',
      }),
    };
  }

  async procesarRetorno({ state, code, error: errorOauth }) {
    this.asegurarConfiguracion();
    if (typeof state !== 'string' || state.length > 200) return;
    const solicitud = await this.repositorio.reclamarRetorno(hash(state));
    if (!solicitud) return;
    try {
      if (errorOauth || typeof code !== 'string' || !code || code.length > 4096) {
        throw error('GOOGLE_CANCELADO', 'La verificación fue cancelada.', 401);
      }
      const { tokens } = await this.oauth.getToken({ code, codeVerifier: solicitud.verificador_pkce, redirect_uri: this.configuracion.redirectUri });
      if (!tokens.id_token) throw error('IDENTIDAD_INVALIDA', 'No se pudo verificar la identidad.', 401);
      const ticket = await this.oauth.verifyIdToken({ idToken: tokens.id_token, audience: this.configuracion.clientId });
      const datos = ticket.getPayload();
      const dominio = this.configuracion.dominio.toLowerCase();
      if (!datos?.nonce || hash(datos.nonce) !== solicitud.nonce_hash || !datos.sub
          || datos.email_verified !== true || datos.hd?.toLowerCase() !== dominio
          || typeof datos.email !== 'string' || !datos.email.toLowerCase().endsWith(`@${dominio}`)) {
        throw error('IDENTIDAD_INVALIDA', 'Utiliza la cuenta institucional vinculada a tu identidad digital.', 403);
      }
      await this.repositorio.preparar(solicitud.id, datos.sub);
      // No se solicitan refresh tokens ni se conservan tokens del proveedor.
    } catch (fallo) {
      await this.repositorio.marcarError(solicitud.id, fallo instanceof ErrorHttp ? fallo.codigo : 'GOOGLE_NO_COMPLETADO');
    }
  }

  consultar({ id, verificador }) { return this.repositorio.consultar(id, hash(verificador)); }
  confirmar({ id, verificador }) { return this.repositorio.confirmar(id, hash(verificador)); }
  cancelar({ id, verificador }) { return this.repositorio.cancelar(id, hash(verificador)); }
}
