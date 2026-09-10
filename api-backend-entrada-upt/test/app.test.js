import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/config/database.js';

after(async () => {
  await pool.end();
});

describe('API', () => {
  it('responde con la información básica', async () => {
    const response = await request(app).get('/api').expect(200);

    assert.equal(response.body.name, 'API Entrada UPT');
    assert.equal(response.body.version, '1.0.0');
  });

  it('responde 404 con JSON para una ruta desconocida', async () => {
    const response = await request(app).get('/api/desconocida').expect(404);

    assert.equal(response.body.status, 'error');
  });
});

