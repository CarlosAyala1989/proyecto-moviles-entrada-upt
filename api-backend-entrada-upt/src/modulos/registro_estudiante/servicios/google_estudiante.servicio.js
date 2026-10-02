import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';
import { conciliarIdentidadEstudiante } from './conciliacion_identidad.servicio.js';

const duracionTransaccionMs = 10 * 60 * 1000;
const maximoTransacciones = 200;

function crearError(codigo, mensaje, estadoHttp) {
  return new ErrorHttp({ codigo, mensaje, estadoHttp });
}

function crearPkce() {
  const verificador = randomBytes(64).toString('base64url');
  return {
    verificador,
    desafio: createHash('sha256').update(verificador).digest('base64url'),
  };
}

function nombreGoogle(payload) {
  const nombre = payload.name?.trim();
  if (nombre) return nombre;
  return [payload.given_name, payload.family_name]
    .filter((parte) => typeof parte === 'string' && parte.trim())
    .join(' ')
    .trim();
}

function mensajeConciliacion(motivo) {
  const mensajes = {
    CORREO_INSTITUCIONAL_INVALIDO:
      'La cuenta Google no tiene el formato institucional esperado.',
    CODIGO_INTRANET_INVALIDO:
      'La intranet no devolvió un código institucional válido.',
    CODIGOS_NO_COINCIDEN:
      'El código de la cuenta Google no coincide con el de la intranet.',
    NOMBRE_INTRANET_INVALIDO:
      'La intranet no devolvió un nombre que se pueda verificar.',
    NOMBRES_NO_COINCIDEN:
      'El nombre de Google no coincide con el nombre de la intranet.',
  };
  return mensajes[motivo] ?? 'Google y la intranet no identifican al mismo estudiante.';
}

export class ServicioGoogleEstudiante {
  #ahora;

  #configuracion;

  #oauth;

  #repositorio;

  #servicioAutenticacion;

  #servicioIntranet;

  #transacciones = new Map();

  #transaccionesPorEstado = new Map();

  constructor({
    configuracion,
    servicioIntranet,
    repositorio,
    servicioAutenticacion,
    oauth,
    ahora = () => Date.now(),
  }) {
    this.#configuracion = configuracion;
    this.#servicioIntranet = servicioIntranet;
    this.#repositorio = repositorio;
    this.#servicioAutenticacion = servicioAutenticacion;
    this.#ahora = ahora;
    this.#oauth = oauth ?? (
      configuracion?.clientId && configuracion?.clientSecret && configuracion?.redirectUri
        ? new OAuth2Client(
          configuracion.clientId,
          configuracion.clientSecret,
          configuracion.redirectUri,
        )
        : null
    );
  }

  #asegurarConfiguracion() {
    if (
      !this.#oauth
      || !this.#configuracion?.clientId
      || !this.#configuracion?.clientSecret
      || !this.#configuracion?.redirectUri
    ) {
      throw crearError(
        'GOOGLE_OAUTH_NO_CONFIGURADO',
        'El acceso con Google todavía no está configurado en el servidor.',
        503,
      );
    }
  }

  #eliminarTransaccion(id) {
    const transaccion = this.#transacciones.get(id);
    if (transaccion) this.#transaccionesPorEstado.delete(transaccion.estadoOauth);
    this.#transacciones.delete(id);
  }

  #limpiarExpiradas() {
    for (const [id, transaccion] of this.#transacciones) {
      if (transaccion.expiraEn <= this.#ahora()) this.#eliminarTransaccion(id);
    }
  }

  async iniciar({ verificacionIntranetId }) {
    this.#asegurarConfiguracion();
    this.#limpiarExpiradas();
    if (this.#transacciones.size >= maximoTransacciones) {
      throw crearError(
        'GOOGLE_OAUTH_SATURADO',
        'Hay demasiadas verificaciones con Google en curso. Intenta nuevamente.',
        429,
      );
    }

    await this.#servicioIntranet.obtenerVerificacion(verificacionIntranetId);
    const transaccionId = randomUUID();
    const estadoOauth = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const pkce = crearPkce();
    const expiraEn = this.#ahora() + duracionTransaccionMs;
    const urlAutorizacion = this.#oauth.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state: estadoOauth,
      nonce,
      hd: this.#configuracion.dominio,
      prompt: 'select_account',
      code_challenge: pkce.desafio,
      code_challenge_method: 'S256',
    });
    this.#transacciones.set(transaccionId, {
      id: transaccionId,
      estadoOauth,
      nonce,
      verificadorPkce: pkce.verificador,
      verificacionIntranetId,
      expiraEn,
      estado: 'PENDIENTE',
    });
    this.#transaccionesPorEstado.set(estadoOauth, transaccionId);

    return {
      transaccion_id: transaccionId,
      url_autorizacion: urlAutorizacion,
      expira_en: new Date(expiraEn).toISOString(),
    };
  }

  async procesarRetorno({ estadoOauth, codigo, errorOauth, metadatos = {} }) {
    this.#asegurarConfiguracion();
    this.#limpiarExpiradas();
    const transaccionId = typeof estadoOauth === 'string'
      ? this.#transaccionesPorEstado.get(estadoOauth)
      : null;
    const transaccion = transaccionId
      ? this.#transacciones.get(transaccionId)
      : null;
    if (!transaccion || transaccion.estadoOauth !== estadoOauth) {
      return { exitosa: false, mensaje: 'La solicitud de Google no es válida o expiró.' };
    }
    if (transaccion.estado !== 'PENDIENTE') {
      return { exitosa: false, mensaje: 'Esta solicitud de Google ya fue procesada.' };
    }
    transaccion.estado = 'PROCESANDO';

    try {
      if (errorOauth) {
        throw crearError(
          'GOOGLE_OAUTH_CANCELADO',
          'El acceso con Google fue cancelado o rechazado.',
          401,
        );
      }
      if (typeof codigo !== 'string' || !codigo) {
        throw crearError(
          'GOOGLE_OAUTH_RESPUESTA_INVALIDA',
          'Google no devolvió un código de autorización válido.',
          400,
        );
      }

      const { tokens } = await this.#oauth.getToken({
        code: codigo,
        codeVerifier: transaccion.verificadorPkce,
        redirect_uri: this.#configuracion.redirectUri,
      });
      if (!tokens.id_token) {
        throw crearError(
          'GOOGLE_ID_TOKEN_AUSENTE',
          'Google no devolvió la identidad necesaria para continuar.',
          401,
        );
      }
      const ticket = await this.#oauth.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.#configuracion.clientId,
      });
      const payload = ticket.getPayload();
      const dominio = this.#configuracion.dominio.toLowerCase();
      if (!payload || payload.nonce !== transaccion.nonce) {
        throw crearError(
          'GOOGLE_ID_TOKEN_INVALIDO',
          'La respuesta de identidad de Google no pertenece a esta solicitud.',
          401,
        );
      }
      if (payload.email_verified !== true) {
        throw crearError(
          'GOOGLE_CORREO_NO_VERIFICADO',
          'La cuenta Google no tiene un correo verificado.',
          403,
        );
      }
      if (payload.hd?.toLowerCase() !== dominio) {
        throw crearError(
          'GOOGLE_DOMINIO_NO_AUTORIZADO',
          `Sólo se admiten cuentas Google Workspace de ${dominio}.`,
          403,
        );
      }
      const correo = payload.email?.trim().toLowerCase();
      if (!correo?.endsWith(`@${dominio}`)) {
        throw crearError(
          'GOOGLE_CORREO_NO_AUTORIZADO',
          `Sólo se admiten correos @${dominio}.`,
          403,
        );
      }
      const nombre = nombreGoogle(payload);
      const nombresGoogle = payload.given_name?.trim();
      const apellidosGoogle = payload.family_name?.trim();
      if (!payload.sub || !nombre || !nombresGoogle || !apellidosGoogle) {
        throw crearError(
          'GOOGLE_PERFIL_INCOMPLETO',
          'Google no devolvió el identificador, nombres y apellidos completos.',
          422,
        );
      }

      const perfilIntranet = await this.#servicioIntranet.obtenerVerificacion(
        transaccion.verificacionIntranetId,
      );
      const identidad = conciliarIdentidadEstudiante({
        correoGoogle: correo,
        nombreGoogle: nombre,
        codigoIntranet: perfilIntranet.codigo,
        nombreApellidosIntranet: perfilIntranet.nombre_apellidos,
      });
      if (!identidad.valida) {
        throw crearError(
          identidad.motivo,
          mensajeConciliacion(identidad.motivo),
          422,
        );
      }

      const usuario = await this.#repositorio.registrarIdentidadVerificada({
        ...identidad,
        nombres: nombresGoogle,
        apellidos: apellidosGoogle,
        googleSub: payload.sub,
        fotoUrl: typeof payload.picture === 'string' ? payload.picture : null,
      });
      const sesion = await this.#servicioAutenticacion.iniciarSesionVerificada({
        usuario,
        metadatos,
      });
      this.#servicioIntranet.consumirVerificacion(
        transaccion.verificacionIntranetId,
      );
      transaccion.estado = 'COMPLETA';
      transaccion.sesion = sesion;
      return { exitosa: true, mensaje: 'Identidad verificada correctamente.' };
    } catch (error) {
      transaccion.estado = 'ERROR';
      transaccion.codigoError = error instanceof ErrorHttp
        ? error.codigo
        : 'GOOGLE_OAUTH_NO_COMPLETADO';
      transaccion.mensajeError = error instanceof ErrorHttp && error.estadoHttp < 500
        ? error.message
        : 'No fue posible completar la verificación con Google.';
      return { exitosa: false, mensaje: transaccion.mensajeError };
    }
  }

  consultarEstado(transaccionId) {
    this.#limpiarExpiradas();
    const transaccion = this.#transacciones.get(transaccionId);
    if (!transaccion) {
      throw crearError(
        'GOOGLE_OAUTH_EXPIRADO',
        'La verificación con Google venció. Inicia nuevamente el proceso.',
        410,
      );
    }
    if (transaccion.estado === 'COMPLETA') {
      const respuesta = { estado: 'COMPLETA', sesion: transaccion.sesion };
      this.#eliminarTransaccion(transaccionId);
      return respuesta;
    }
    if (transaccion.estado === 'ERROR') {
      return {
        estado: 'ERROR',
        error: {
          codigo: transaccion.codigoError,
          mensaje: transaccion.mensajeError,
        },
      };
    }
    return { estado: transaccion.estado };
  }
}
