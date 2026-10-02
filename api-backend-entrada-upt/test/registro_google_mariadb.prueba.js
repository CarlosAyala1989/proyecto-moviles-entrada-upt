import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { grupoConexiones } from '../src/config/database.js';
import { RepositorioAutenticacionMariaDb } from '../src/modulos/autenticacion/repositorios/repositorio_autenticacion_mariadb.js';
import { crearServicioAutenticacion } from '../src/modulos/autenticacion/servicios/autenticacion.servicio.js';
import { RepositorioRegistroEstudianteMariaDb } from '../src/modulos/registro_estudiante/repositorios/repositorio_registro_estudiante_mariadb.js';
import { ServicioGoogleEstudiante } from '../src/modulos/registro_estudiante/servicios/google_estudiante.servicio.js';

const codigo = '2022999999';
const correo = `zz${codigo}@virtual.upt.pe`;
const googleSub = 'google-sub-integracion-prueba';

async function eliminarPrueba() {
  const [usuario] = await grupoConexiones.query(
    'SELECT id FROM usuarios WHERE codigo_institucional = ?',
    [codigo],
  );
  if (!usuario) return;
  await grupoConexiones.query(
    'DELETE FROM registros_auditoria WHERE usuario_actor_id = ?',
    [usuario.id],
  );
  await grupoConexiones.query(
    'DELETE FROM intentos_inicio_sesion WHERE usuario_id = ?',
    [usuario.id],
  );
  await grupoConexiones.query('DELETE FROM sesiones WHERE usuario_id = ?', [usuario.id]);
  await grupoConexiones.query(
    'DELETE FROM usuarios_roles WHERE usuario_id = ?',
    [usuario.id],
  );
  await grupoConexiones.query('DELETE FROM usuarios WHERE id = ?', [usuario.id]);
}

before(eliminarPrueba);

after(async () => {
  await eliminarPrueba();
  await grupoConexiones.end();
});

describe('Persistencia del registro Google', () => {
  it('crea la identidad dual, asigna ESTUDIANTE y emite tokens opacos', async () => {
    let opciones;
    const servicio = new ServicioGoogleEstudiante({
      configuracion: {
        clientId: 'cliente.apps.googleusercontent.com',
        clientSecret: 'secreto-prueba',
        redirectUri:
          'http://127.0.0.1:3000/api/registro-estudiante/google/callback',
        dominio: 'virtual.upt.pe',
      },
      servicioIntranet: {
        obtenerVerificacion: async () => ({
          codigo,
          nombre_apellidos: 'PRUEBA GOOGLE, ZETA ZETA',
        }),
        consumirVerificacion: () => true,
      },
      repositorio: new RepositorioRegistroEstudianteMariaDb(),
      servicioAutenticacion: crearServicioAutenticacion(
        new RepositorioAutenticacionMariaDb(),
        {
          duracionTokenAccesoMinutos: 15,
          duracionTokenRenovacionDias: 7,
          maxIntentosInicioSesion: 5,
          duracionBloqueoMinutos: 15,
        },
      ),
      oauth: {
        generateAuthUrl: (valores) => {
          opciones = valores;
          return 'https://accounts.google.com/o/oauth2/v2/auth';
        },
        getToken: async () => ({ tokens: { id_token: 'token-prueba' } }),
        verifyIdToken: async () => ({
          getPayload: () => ({
            sub: googleSub,
            email: correo,
            email_verified: true,
            hd: 'virtual.upt.pe',
            name: 'ZETA ZETA PRUEBA GOOGLE',
            given_name: 'ZETA ZETA',
            family_name: 'PRUEBA GOOGLE',
            nonce: opciones.nonce,
          }),
        }),
      },
    });

    const inicio = await servicio.iniciar({
      verificacionIntranetId: '8bcdbcea-0682-4c77-a828-21855d6bcdfa',
    });
    const retorno = await servicio.procesarRetorno({
      estadoOauth: opciones.state,
      codigo: 'codigo-autorizacion',
      metadatos: { direccionIp: '127.0.0.1', agenteUsuario: 'prueba' },
    });
    assert.equal(retorno.exitosa, true);

    const resultado = servicio.consultarEstado(inicio.transaccion_id);
    assert.match(resultado.sesion.token_acceso, /^upt_acceso_/);
    assert.deepEqual(resultado.sesion.usuario.roles, ['ESTUDIANTE']);
    const [usuario] = await grupoConexiones.query(
      `SELECT google_sub, contrasena_hash, identidad_verificada, estado,
              estado_autorizacion
       FROM usuarios WHERE codigo_institucional = ?`,
      [codigo],
    );
    assert.equal(usuario.google_sub, googleSub);
    assert.equal(usuario.contrasena_hash, null);
    assert.equal(usuario.identidad_verificada, 1);
    assert.equal(usuario.estado, 'ACTIVO');
    assert.equal(usuario.estado_autorizacion, 'AUTORIZADO');

    const segundoInicio = await servicio.iniciar({
      verificacionIntranetId: '3832890c-62e9-4714-b17b-68f2a90bce18',
    });
    assert.equal((await servicio.procesarRetorno({
      estadoOauth: opciones.state,
      codigo: 'segundo-codigo-autorizacion',
    })).exitosa, true);
    const segundoResultado = servicio.consultarEstado(
      segundoInicio.transaccion_id,
    );
    assert.equal(segundoResultado.sesion.usuario.id, resultado.sesion.usuario.id);
    const [cantidades] = await grupoConexiones.query(
      `SELECT
         COUNT(DISTINCT usuarios.id) AS usuarios,
         COUNT(sesiones.id) AS sesiones
       FROM usuarios
       LEFT JOIN sesiones ON sesiones.usuario_id = usuarios.id
       WHERE usuarios.codigo_institucional = ?`,
      [codigo],
    );
    assert.equal(cantidades.usuarios, 1);
    assert.equal(cantidades.sesiones, 2);
  });
});
