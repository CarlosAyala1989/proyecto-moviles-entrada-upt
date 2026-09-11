import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';

const codigoAdministrador = 'PRUEBA-ADMIN-H4';
const codigoUsuario = 'PRUEBA-HTTP-H4-001';
const contrasenaAdministrador = 'Admin-Hito4-Segura!2026';
const aplicacion = crearAplicacion({ entornoEjecucion: 'test' });
let tokenAdministrador;
let administradorId;

async function eliminarUsuariosPrueba() {
  const codigos = [codigoAdministrador, codigoUsuario];
  const marcadores = codigos.map(() => '?').join(', ');
  const usuarios = await grupoConexiones.query(
    `SELECT id FROM usuarios WHERE codigo_institucional IN (${marcadores})`,
    codigos,
  );
  const ids = usuarios.map(({ id }) => id);
  if (ids.length === 0) return;

  const marcadoresIds = ids.map(() => '?').join(', ');
  await grupoConexiones.query(
    `DELETE FROM registros_auditoria
     WHERE usuario_actor_id IN (${marcadoresIds})
        OR (entidad = 'USUARIO' AND entidad_id IN (${marcadoresIds}))`,
    [...ids, ...ids.map(String)],
  );
  await grupoConexiones.query(
    `DELETE FROM intentos_inicio_sesion WHERE usuario_id IN (${marcadoresIds})`,
    ids,
  );
  await grupoConexiones.query(
    `DELETE FROM sesiones WHERE usuario_id IN (${marcadoresIds})`,
    ids,
  );
  await grupoConexiones.query(
    `DELETE FROM usuarios_roles WHERE usuario_id IN (${marcadoresIds})`,
    ids,
  );
  await grupoConexiones.query(
    `DELETE FROM usuarios WHERE id IN (${marcadoresIds})`,
    ids,
  );
}

async function crearAdministradorPrueba() {
  const contrasenaHash = await bcrypt.hash(contrasenaAdministrador, 12);
  const resultado = await grupoConexiones.query(
    `INSERT INTO usuarios (
      codigo_institucional,
      correo_institucional,
      contrasena_hash,
      nombres,
      apellidos,
      estado,
      estado_autorizacion
    ) VALUES (?, ?, ?, 'Administrador', 'Prueba', 'ACTIVO', 'AUTORIZADO')`,
    [codigoAdministrador, 'admin.h4@example.invalid', contrasenaHash],
  );
  administradorId = resultado.insertId;
  await grupoConexiones.query(
    `INSERT INTO usuarios_roles (usuario_id, rol_id)
     SELECT ?, id FROM roles WHERE nombre = 'ADMINISTRADOR'`,
    [administradorId],
  );
}

before(async () => {
  await eliminarUsuariosPrueba();
  await crearAdministradorPrueba();
  const inicio = await request(aplicacion)
    .post('/api/autenticacion/iniciar-sesion')
    .send({
      identificador: codigoAdministrador,
      contrasena: contrasenaAdministrador,
    })
    .expect(201);
  tokenAdministrador = inicio.body.datos.token_acceso;
});

after(async () => {
  await eliminarUsuariosPrueba();
  await grupoConexiones.end();
});

describe('Administración de usuarios protegida por rol', { concurrency: false }, () => {
  it('rechaza solicitudes sin token de acceso', async () => {
    const respuesta = await request(aplicacion)
      .get('/api/administracion/usuarios')
      .set('x-clave-administracion-desarrollo', 'clave-anterior-sin-validez')
      .expect(401);

    assert.equal(respuesta.body.error.codigo, 'AUTENTICACION_REQUERIDA');
  });

  it('registra, consulta, actualiza y deshabilita un usuario', async () => {
    const creacion = await request(aplicacion)
      .post('/api/administracion/usuarios')
      .set('authorization', `Bearer ${tokenAdministrador}`)
      .send({
        codigo_institucional: codigoUsuario.toLowerCase(),
        correo_institucional: 'usuario.hito4@example.invalid',
        contrasena: 'Usuario-Hito4-Seguro!2026',
        nombres: 'Usuario',
        apellidos: 'Hito Cuatro',
        estado: 'ACTIVO',
        estado_autorizacion: 'AUTORIZADO',
        identidad_verificada: true,
        roles: ['ESTUDIANTE'],
      })
      .expect(201);

    const usuarioId = creacion.body.datos.id;
    assert.equal(creacion.body.datos.codigo_institucional, codigoUsuario);
    assert.deepEqual(creacion.body.datos.roles, ['ESTUDIANTE']);
    assert.equal(creacion.body.datos.contrasena_hash, undefined);

    const [fila] = await grupoConexiones.query(
      'SELECT contrasena_hash FROM usuarios WHERE id = ?',
      [usuarioId],
    );
    assert.equal(await bcrypt.compare('Usuario-Hito4-Seguro!2026', fila.contrasena_hash), true);

    const consulta = await request(aplicacion)
      .get(`/api/administracion/usuarios/${usuarioId}`)
      .set('authorization', `Bearer ${tokenAdministrador}`)
      .expect(200);
    assert.equal(consulta.body.datos.correo_institucional, 'usuario.hito4@example.invalid');

    const actualizacion = await request(aplicacion)
      .patch(`/api/administracion/usuarios/${usuarioId}`)
      .set('authorization', `Bearer ${tokenAdministrador}`)
      .send({ nombres: 'Usuario Actualizado' })
      .expect(200);
    assert.equal(actualizacion.body.datos.nombres, 'Usuario Actualizado');

    const roles = await request(aplicacion)
      .put(`/api/administracion/usuarios/${usuarioId}/roles`)
      .set('authorization', `Bearer ${tokenAdministrador}`)
      .send({ roles: ['TRABAJADOR'] })
      .expect(200);
    assert.deepEqual(roles.body.datos.roles, ['TRABAJADOR']);

    await request(aplicacion)
      .put(`/api/administracion/usuarios/${usuarioId}/credencial-local`)
      .set('authorization', `Bearer ${tokenAdministrador}`)
      .send({ contrasena: 'Nueva-Clave-Hito4!2026' })
      .expect(204);

    const estado = await request(aplicacion)
      .patch(`/api/administracion/usuarios/${usuarioId}/estado`)
      .set('authorization', `Bearer ${tokenAdministrador}`)
      .send({ estado: 'INACTIVO', estado_autorizacion: 'DENEGADO' })
      .expect(200);
    assert.equal(estado.body.datos.estado, 'INACTIVO');

    const listado = await request(aplicacion)
      .get(`/api/administracion/usuarios?buscar=${codigoUsuario}&pagina=1&limite=10`)
      .set('authorization', `Bearer ${tokenAdministrador}`)
      .expect(200);
    assert.equal(listado.body.datos.length, 1);
    assert.equal(listado.body.paginacion.total, 1);
  });

  it('impide que el administrador se deshabilite o pierda su propio rol', async () => {
    const estado = await request(aplicacion)
      .patch(`/api/administracion/usuarios/${administradorId}/estado`)
      .set('authorization', `Bearer ${tokenAdministrador}`)
      .send({ estado: 'INACTIVO' })
      .expect(409);
    assert.equal(
      estado.body.error.codigo,
      'ADMINISTRADOR_NO_PUEDE_DESHABILITARSE',
    );

    const roles = await request(aplicacion)
      .put(`/api/administracion/usuarios/${administradorId}/roles`)
      .set('authorization', `Bearer ${tokenAdministrador}`)
      .send({ roles: ['ESTUDIANTE'] })
      .expect(409);
    assert.equal(
      roles.body.error.codigo,
      'ADMINISTRADOR_NO_PUEDE_QUITARSE_ROL',
    );
  });

  it('impide duplicar un identificador institucional', async () => {
    const respuesta = await request(aplicacion)
      .post('/api/administracion/usuarios')
      .set('authorization', `Bearer ${tokenAdministrador}`)
      .send({
        codigo_institucional: codigoUsuario,
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
      .set('authorization', `Bearer ${tokenAdministrador}`)
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
