import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

after(async () => {
  await grupoConexiones.end();
});

describe('API de control de acceso', () => {
  it('expone la información básica de la API', async () => {
    const respuesta = await request(app).get('/api').expect(200);

    assert.equal(respuesta.body.nombre, 'API Entrada UPT');
    assert.equal(respuesta.body.version, '1.0.0');
  });

  it('informa que MariaDB está disponible', async () => {
    const respuesta = await request(app).get('/api/salud').expect(200);

    assert.equal(respuesta.body.estado, 'correcto');
    assert.equal(respuesta.body.base_datos, 'conectada');
  });

  it('rechaza JSON malformado sin revelar detalles internos', async () => {
    const respuesta = await request(app)
      .post('/api')
      .set('content-type', 'application/json')
      .send('{')
      .expect(400);

    assert.deepEqual(respuesta.body, {
      error: {
        codigo: 'JSON_INVALIDO',
        mensaje: 'El cuerpo de la solicitud debe ser un JSON válido.',
      },
    });
  });

  it('exige application/json para solicitudes con cuerpo', async () => {
    const respuesta = await request(app)
      .post('/api')
      .type('text')
      .send('contenido no JSON')
      .expect(415);

    assert.equal(respuesta.body.error.codigo, 'TIPO_CONTENIDO_NO_ADMITIDO');
  });

  it('responde JSON para una ruta desconocida', async () => {
    const respuesta = await request(app).get('/api/desconocida').expect(404);

    assert.equal(respuesta.body.error.codigo, 'RUTA_NO_ENCONTRADA');
  });
});
