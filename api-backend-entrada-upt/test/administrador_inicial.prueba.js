import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import { crearAdministradorInicial } from '../src/modulos/usuarios/servicios/crear_administrador_inicial.js';
import { esquemaAdministradorInicial } from '../src/modulos/usuarios/validacion/usuarios.esquemas.js';

describe('Administrador inicial', () => {
  it('exige una contraseña robusta', () => {
    const resultado = esquemaAdministradorInicial.safeParse({
      codigo_institucional: 'ADMIN-PRUEBA',
      correo_institucional: 'admin.prueba@example.invalid',
      nombres: 'Administrador',
      apellidos: 'Prueba',
      contrasena: 'debil',
    });

    assert.equal(resultado.success, false);
  });

  it('crea el administrador con contraseña cifrada', async () => {
    let parametrosCreacion;
    const conexion = {
      query: async (sql, parametros) => {
        if (sql.includes('LIMIT 1')) return [];
        if (sql.includes("nombre = 'ADMINISTRADOR'")) return [{ id: 5 }];
        if (sql.includes('INSERT INTO usuarios (')) {
          parametrosCreacion = parametros;
          return { insertId: 99 };
        }
        return { affectedRows: 1 };
      },
    };
    const datos = {
      codigo_institucional: 'ADMIN-TRANSACCIONAL',
      correo_institucional: 'admin.transaccional@example.invalid',
      nombres: 'Administrador',
      apellidos: 'Transaccional',
      contrasena: 'ClaveTemporal!2026',
    };

    const administrador = await crearAdministradorInicial(conexion, datos);

    assert.equal(administrador.id, 99);
    assert.notEqual(parametrosCreacion[2], datos.contrasena);
    assert.equal(await bcrypt.compare(datos.contrasena, parametrosCreacion[2]), true);
  });

  it('se deshabilita cuando ya existe un administrador', async () => {
    const conexion = {
      query: async () => [{ id: 1 }],
    };

    await assert.rejects(
      crearAdministradorInicial(conexion, {
        codigo_institucional: 'ADMIN-SEGUNDO',
        correo_institucional: 'admin.segundo@example.invalid',
        nombres: 'Segundo',
        apellidos: 'Administrador',
        contrasena: 'OtraClaveTemporal!2026',
      }),
      (error) => error.codigo === 'ADMINISTRADOR_INICIAL_YA_EXISTE',
    );
  });
});
