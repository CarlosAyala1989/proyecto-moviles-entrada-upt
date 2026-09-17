import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

describe('Registro de estudiante: intranet', () => {
  it('entrega un CAPTCHA y verifica solamente datos con el contrato esperado', async () => {
    const verificaciones = [];
    const iniciosGoogle = [];
    const aplicacion = crearAplicacion({
      entornoEjecucion: 'test',
      servicioIntranet: {
        obtenerCaptcha: async () => ({
          transaccion_id: '0664b410-145e-4ef3-8d98-1055d8d57ee9',
          imagen_base64: 'AQID',
          tipo_imagen: 'image/png',
          expira_en: '2026-09-14T12:05:00.000Z',
        }),
        verificarCredenciales: async (datos) => {
          verificaciones.push(datos);
          return {
            codigo: datos.codigo,
            nombre_apellidos: 'AYALA RAMOS, CARLOS DANIEL',
          };
        },
      },
      servicioGoogle: {
        iniciar: async (datos) => {
          iniciosGoogle.push(datos);
          return {
            transaccion_id: '70f998ec-088d-4966-8b7a-dd8a76a07560',
            url_autorizacion: 'https://accounts.google.com/o/oauth2/v2/auth',
            expira_en: '2026-09-14T12:10:00.000Z',
          };
        },
        procesarRetorno: async () => ({ exitosa: true }),
        consultarEstado: () => ({ estado: 'PENDIENTE' }),
      },
    });

    const captcha = await request(aplicacion)
      .get('/api/registro-estudiante/intranet/captcha')
      .expect(200);
    assert.equal(captcha.body.datos.tipo_imagen, 'image/png');

    await request(aplicacion)
      .post('/api/registro-estudiante/intranet/verificar')
      .send({
        transaccion_id: '0664b410-145e-4ef3-8d98-1055d8d57ee9',
        codigo: '2022074266',
        contrasena: '123456',
        captcha: '12345',
      })
      .expect(200)
      .expect(({ body }) => {
        assert.equal(body.datos.codigo, '2022074266');
      });
    assert.deepEqual(verificaciones, [{
      transaccionId: '0664b410-145e-4ef3-8d98-1055d8d57ee9',
      codigo: '2022074266',
      contrasena: '123456',
      captcha: '12345',
    }]);

    await request(aplicacion)
      .post('/api/registro-estudiante/google/iniciar')
      .send({
        verificacion_intranet_id: '8bcdbcea-0682-4c77-a828-21855d6bcdfa',
      })
      .expect(201)
      .expect(({ body }) => {
        assert.match(body.datos.url_autorizacion, /^https:\/\/accounts\.google\.com/);
      });
    assert.deepEqual(iniciosGoogle, [{
      verificacionIntranetId: '8bcdbcea-0682-4c77-a828-21855d6bcdfa',
    }]);

    await request(aplicacion)
      .get('/api/registro-estudiante/google/callback?state=estado&code=codigo')
      .redirects(1)
      .expect(200)
      .expect('content-type', /html/);
    await request(aplicacion)
      .get('/api/registro-estudiante/google/estado/70f998ec-088d-4966-8b7a-dd8a76a07560')
      .expect(200)
      .expect(({ body }) => assert.equal(body.datos.estado, 'PENDIENTE'));

    const invalida = await request(aplicacion)
      .post('/api/registro-estudiante/intranet/verificar')
      .send({ codigo: 'invalido' })
      .expect(400);
    assert.equal(invalida.body.error.codigo, 'DATOS_INVALIDOS');
  });
});

after(async () => {
  await grupoConexiones.end();
});
