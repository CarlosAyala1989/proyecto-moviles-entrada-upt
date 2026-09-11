import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

const claveAdministracion = 'clave-administrativa-prueba-1234567890';
const codigoPrueba = 'PRUEBA-HTTP-H3-001';
const cabeceraClave = 'x-clave-administracion-desarrollo';
const aplicacion = crearAplicacion({
  claveAdministracion,
  entornoEjecucion: 'test',
});

async function eliminarUsuarioPrueba() {
  const conexion = await grupoConexiones.getConnection();
  try {
    const [usuario] = await conexion.query(
      'SELECT id FROM usuarios WHERE codigo_institucional = ?',
      [codigoPrueba],
    );
    if (!usuario) return;

    await conexion.query('DELETE FROM usuarios_roles WHERE usuario_id = ?', [usuario.id]);
    await conexion.query(
      "DELETE FROM registros_auditoria WHERE entidad = 'USUARIO' AND entidad_id = ?",
      [String(usuario.id)],
    );
    await conexion.query('DELETE FROM usuarios WHERE id = ?', [usuario.id]);
  } finally {
    conexion.release();
  }
}

before(eliminarUsuarioPrueba);
after(async () => {
  await eliminarUsuarioPrueba();
  await grupoConexiones.end();
});

describe('Administración de usuarios', () => {
  it('rechaza solicitudes sin credencial administrativa', async () => {
    const respuesta = await request(aplicacion)
      .get('/api/administracion/usuarios')
      .expect(401);

    assert.equal(
      respuesta.body.error.codigo,
      'CREDENCIAL_ADMINISTRATIVA_INVALIDA',
    );
  });

  it('mantiene deshabilitada la clave temporal en producción', async () => {
    const aplicacionProduccion = crearAplicacion({
      claveAdministracion,
      entornoEjecucion: 'production',
      registrarSolicitudes: false,
    });
    const respuesta = await request(aplicacionProduccion)
      .get('/api/administracion/usuarios')
      .set(cabeceraClave, claveAdministracion)
      .expect(503);

    assert.equal(
      respuesta.body.error.codigo,
      'AUTENTICACION_ADMINISTRATIVA_NO_DISPONIBLE',
    );
  });

  it('registra, consulta, actualiza y deshabilita un usuario', async () => {
    const creacion = await request(aplicacion)
      .post('/api/administracion/usuarios')
      .set(cabeceraClave, claveAdministracion)
      .send({
        codigo_institucional: codigoPrueba.toLowerCase(),
        correo_institucional: 'usuario.hito3@example.invalid',
        nombres: 'Usuario',
        apellidos: 'Hito Tres',
        estado: 'ACTIVO',
        estado_autorizacion: 'AUTORIZADO',
        identidad_verificada: true,
        roles: ['ESTUDIANTE'],
      })
      .expect(201);

    const usuarioId = creacion.body.datos.id;
    assert.equal(creacion.body.datos.codigo_institucional, codigoPrueba);
    assert.deepEqual(creacion.body.datos.roles, ['ESTUDIANTE']);
    assert.equal(creacion.body.datos.contrasena_hash, undefined);

    const consulta = await request(aplicacion)
      .get(`/api/administracion/usuarios/${usuarioId}`)
      .set(cabeceraClave, claveAdministracion)
      .expect(200);
    assert.equal(consulta.body.datos.correo_institucional, 'usuario.hito3@example.invalid');

    const actualizacion = await request(aplicacion)
      .patch(`/api/administracion/usuarios/${usuarioId}`)
      .set(cabeceraClave, claveAdministracion)
      .send({ nombres: 'Usuario Actualizado' })
      .expect(200);
    assert.equal(actualizacion.body.datos.nombres, 'Usuario Actualizado');

    const roles = await request(aplicacion)
      .put(`/api/administracion/usuarios/${usuarioId}/roles`)
      .set(cabeceraClave, claveAdministracion)
      .send({ roles: ['TRABAJADOR'] })
      .expect(200);
    assert.deepEqual(roles.body.datos.roles, ['TRABAJADOR']);

    const estado = await request(aplicacion)
      .patch(`/api/administracion/usuarios/${usuarioId}/estado`)
      .set(cabeceraClave, claveAdministracion)
      .send({ estado: 'INACTIVO', estado_autorizacion: 'DENEGADO' })
      .expect(200);
    assert.equal(estado.body.datos.estado, 'INACTIVO');
    assert.equal(estado.body.datos.estado_autorizacion, 'DENEGADO');

    const listado = await request(aplicacion)
      .get(`/api/administracion/usuarios?buscar=${codigoPrueba}&pagina=1&limite=10`)
      .set(cabeceraClave, claveAdministracion)
      .expect(200);
    assert.equal(listado.body.datos.length, 1);
    assert.equal(listado.body.paginacion.total, 1);
  });

  it('impide duplicar un identificador institucional', async () => {
    const respuesta = await request(aplicacion)
      .post('/api/administracion/usuarios')
      .set(cabeceraClave, claveAdministracion)
      .send({
        codigo_institucional: codigoPrueba,
        correo_institucional: 'otro.usuario@example.invalid',
        nombres: 'Otro',
        apellidos: 'Usuario',
        roles: ['ESTUDIANTE'],
      })
      .expect(409);

    assert.equal(
      respuesta.body.error.codigo,
      'IDENTIFICADOR_INSTITUCIONAL_DUPLICADO',
    );
  });

  it('rechaza campos y estados no permitidos', async () => {
    const respuesta = await request(aplicacion)
      .post('/api/administracion/usuarios')
      .set(cabeceraClave, claveAdministracion)
      .send({
        codigo_institucional: 'PRUEBA-INVALIDA',
        correo_institucional: 'invalido@example.invalid',
        nombres: 'Inválido',
        apellidos: 'Prueba',
        estado: 'SUPERADMIN',
        roles: ['ESTUDIANTE'],
        contrasena_hash: 'no debe aceptarse',
      })
      .expect(400);

    assert.equal(respuesta.body.error.codigo, 'DATOS_INVALIDOS');
  });
});
