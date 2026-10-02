import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import { manejarErrores } from '../src/middleware/manejo_errores.js';
import { crearEnrutadorMapaGoogle } from '../src/modulos/mapas_google/rutas/mapas_google.rutas.js';

function crearAplicacionMapa(opciones) {
  const aplicacion = express();
  aplicacion.use('/mapa', crearEnrutadorMapaGoogle(opciones));
  aplicacion.use(manejarErrores);
  return aplicacion;
}

describe('Mapa de Google para administración', () => {
  it('informa claramente cuando falta la clave de Google Maps', async () => {
    const respuesta = await request(crearAplicacionMapa({ apiKey: '' }))
      .get('/mapa/estatico')
      .query({ latitud: -18.006, longitud: -70.226, zoom: 18 })
      .expect(503);

    assert.equal(respuesta.body.error.codigo, 'GOOGLE_MAPS_NO_CONFIGURADO');
  });

  it('solicita una imagen marcada sin exponer la clave en la respuesta', async () => {
    let urlSolicitada;
    const imagen = Uint8Array.from([137, 80, 78, 71]);
    const aplicacion = crearAplicacionMapa({
      apiKey: 'clave-servidor-prueba',
      solicitarMapa: async (url) => {
        urlSolicitada = url;
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'image/png' }),
          arrayBuffer: async () => imagen.buffer,
        };
      },
    });

    const respuesta = await request(aplicacion)
      .get('/mapa/estatico')
      .query({
        latitud: -18.0060535,
        longitud: -70.2266368,
        zoom: 18,
        ancho: 600,
        alto: 340,
      })
      .expect('content-type', /image\/png/)
      .expect(200);

    assert.deepEqual(respuesta.body, Buffer.from(imagen));
    assert.equal(urlSolicitada.hostname, 'maps.googleapis.com');
    assert.equal(urlSolicitada.searchParams.get('center'), '-18.0060535,-70.2266368');
    assert.equal(urlSolicitada.searchParams.get('markers'), 'color:0x1565C0|-18.0060535,-70.2266368');
    assert.equal(urlSolicitada.searchParams.get('key'), 'clave-servidor-prueba');
    assert.doesNotMatch(JSON.stringify(respuesta.headers), /clave-servidor-prueba/);
  });

  it('rechaza coordenadas y tamaños fuera de rango antes de llamar a Google', async () => {
    let solicitudes = 0;
    const aplicacion = crearAplicacionMapa({
      apiKey: 'clave-servidor-prueba',
      solicitarMapa: async () => {
        solicitudes += 1;
      },
    });

    await request(aplicacion)
      .get('/mapa/estatico')
      .query({ latitud: 91, longitud: -70, ancho: 2000 })
      .expect(400);
    assert.equal(solicitudes, 0);
  });
});
