import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ServicioGoogleEstudiante } from '../src/modulos/registro_estudiante/servicios/google_estudiante.servicio.js';

const configuracion = {
  clientId: 'cliente.apps.googleusercontent.com',
  clientSecret: 'secreto-de-prueba',
  redirectUri: 'http://127.0.0.1:3000/api/registro-estudiante/google/callback',
  dominio: 'virtual.upt.pe',
};

function preparar({ payload } = {}) {
  let opcionesAutorizacion;
  let usuarioRegistrado;
  let verificacionConsumida = false;
  const servicio = new ServicioGoogleEstudiante({
    configuracion,
    servicioIntranet: {
      obtenerVerificacion: async () => ({
        codigo: '2022074266',
        nombre_apellidos: 'AYALA RAMOS, CARLOS DANIEL',
      }),
      consumirVerificacion: () => {
        verificacionConsumida = true;
      },
    },
    repositorio: {
      registrarIdentidadVerificada: async (usuario) => {
        usuarioRegistrado = usuario;
        return {
          id: 10,
          codigo_institucional: usuario.codigo,
          correo_institucional: usuario.correoInstitucional,
          nombres: usuario.nombres,
          apellidos: usuario.apellidos,
          estado: 'ACTIVO',
          estado_autorizacion: 'AUTORIZADO',
        };
      },
    },
    servicioAutenticacion: {
      iniciarSesionVerificada: async ({ usuario }) => ({
        tipo_token: 'Bearer',
        token_acceso: 'upt_acceso_prueba',
        token_renovacion: 'upt_renovacion_prueba',
        usuario,
      }),
    },
    oauth: {
      generateAuthUrl: (opciones) => {
        opcionesAutorizacion = opciones;
        return 'https://accounts.google.com/o/oauth2/v2/auth?prueba=1';
      },
      getToken: async ({ code, codeVerifier, redirect_uri: redirectUri }) => {
        assert.equal(code, 'codigo-google');
        assert.ok(codeVerifier);
        assert.equal(redirectUri, configuracion.redirectUri);
        return { tokens: { id_token: 'id-token-firmado' } };
      },
      verifyIdToken: async ({ idToken, audience }) => {
        assert.equal(idToken, 'id-token-firmado');
        assert.equal(audience, configuracion.clientId);
        return {
          getPayload: () => ({
            iss: 'https://accounts.google.com',
            aud: configuracion.clientId,
            sub: 'google-sub-estable',
            email: 'ca2022074266@virtual.upt.pe',
            email_verified: true,
            hd: 'virtual.upt.pe',
            name: 'CARLOS DANIEL AYALA RAMOS',
            given_name: 'CARLOS DANIEL',
            family_name: 'AYALA RAMOS',
            nonce: opcionesAutorizacion.nonce,
            ...payload,
          }),
        };
      },
    },
  });
  return {
    servicio,
    opciones: () => opcionesAutorizacion,
    usuario: () => usuarioRegistrado,
    consumida: () => verificacionConsumida,
  };
}

describe('Registro de estudiante con Google Workspace', () => {
  it('genera con la librería oficial una URL web con callback, state, nonce y PKCE', async () => {
    const servicio = new ServicioGoogleEstudiante({
      configuracion,
      servicioIntranet: { obtenerVerificacion: async () => ({}) },
      repositorio: {},
      servicioAutenticacion: {},
    });
    const inicio = await servicio.iniciar({
      verificacionIntranetId: '0664b410-145e-4ef3-8d98-1055d8d57ee9',
    });
    const url = new URL(inicio.url_autorizacion);
    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('client_id'), configuracion.clientId);
    assert.equal(url.searchParams.get('redirect_uri'), configuracion.redirectUri);
    assert.equal(url.searchParams.get('hd'), 'virtual.upt.pe');
    assert.ok(url.searchParams.get('state'));
    assert.ok(url.searchParams.get('nonce'));
    assert.ok(url.searchParams.get('code_challenge'));
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  });

  it('concilia identidad, registra al estudiante y entrega una sesión una sola vez', async () => {
    const escenario = preparar();
    const inicio = await escenario.servicio.iniciar({
      verificacionIntranetId: '0664b410-145e-4ef3-8d98-1055d8d57ee9',
    });
    assert.equal(inicio.url_autorizacion.startsWith('https://accounts.google.com/'), true);
    assert.equal(escenario.opciones().hd, 'virtual.upt.pe');
    assert.deepEqual(escenario.opciones().scope, ['openid', 'email', 'profile']);
    assert.equal(escenario.opciones().code_challenge_method, 'S256');

    const retorno = await escenario.servicio.procesarRetorno({
      estadoOauth: escenario.opciones().state,
      codigo: 'codigo-google',
    });
    assert.equal(retorno.exitosa, true);
    assert.equal(escenario.usuario().codigo, '2022074266');
    assert.equal(escenario.usuario().googleSub, 'google-sub-estable');
    assert.equal(escenario.usuario().nombres, 'CARLOS DANIEL');
    assert.equal(escenario.usuario().apellidos, 'AYALA RAMOS');
    assert.equal(escenario.consumida(), true);

    const estado = escenario.servicio.consultarEstado(inicio.transaccion_id);
    assert.equal(estado.estado, 'COMPLETA');
    assert.equal(estado.sesion.token_acceso, 'upt_acceso_prueba');
    assert.throws(
      () => escenario.servicio.consultarEstado(inicio.transaccion_id),
      { codigo: 'GOOGLE_OAUTH_EXPIRADO' },
    );
  });

  it('rechaza una cuenta personal aunque el texto del correo parezca institucional', async () => {
    const escenario = preparar({ payload: { hd: undefined } });
    const inicio = await escenario.servicio.iniciar({
      verificacionIntranetId: '0664b410-145e-4ef3-8d98-1055d8d57ee9',
    });
    const retorno = await escenario.servicio.procesarRetorno({
      estadoOauth: escenario.opciones().state,
      codigo: 'codigo-google',
    });
    assert.equal(retorno.exitosa, false);
    const estado = escenario.servicio.consultarEstado(inicio.transaccion_id);
    assert.equal(estado.error.codigo, 'GOOGLE_DOMINIO_NO_AUTORIZADO');
    assert.equal(escenario.usuario(), undefined);
  });

  it('rechaza si el código extraído del correo no coincide con la intranet', async () => {
    const escenario = preparar({
      payload: { email: 'dc2021051033@virtual.upt.pe' },
    });
    const inicio = await escenario.servicio.iniciar({
      verificacionIntranetId: '0664b410-145e-4ef3-8d98-1055d8d57ee9',
    });
    await escenario.servicio.procesarRetorno({
      estadoOauth: escenario.opciones().state,
      codigo: 'codigo-google',
    });
    const estado = escenario.servicio.consultarEstado(inicio.transaccion_id);
    assert.equal(estado.error.codigo, 'CODIGOS_NO_COINCIDEN');
  });
});
