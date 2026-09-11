import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { grupoConexiones } from '../src/config/database.js';
import { entorno } from '../src/config/env.js';
import { crearAdministradorInicial } from '../src/modulos/usuarios/servicios/crear_administrador_inicial.js';
import { esquemaAdministradorInicial } from '../src/modulos/usuarios/validacion/usuarios.esquemas.js';

const directorioActual = path.dirname(fileURLToPath(import.meta.url));
const rutaCredenciales = path.resolve(
  directorioActual,
  '../credenciales_administrador_local.txt',
);

function generarCredenciales() {
  return {
    ADMIN_INICIAL_CODIGO: 'ADMIN-DESARROLLO',
    ADMIN_INICIAL_CORREO: 'administrador.desarrollo@example.invalid',
    ADMIN_INICIAL_NOMBRES: 'Administrador',
    ADMIN_INICIAL_APELLIDOS: 'De Desarrollo',
    ADMIN_INICIAL_CONTRASENA: `Aa1!${randomBytes(24).toString('base64url')}`,
  };
}

async function obtenerCredencialesLocales() {
  try {
    return dotenv.parse(await readFile(rutaCredenciales));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;

    const credenciales = generarCredenciales();
    const contenido = Object.entries(credenciales)
      .map(([clave, valor]) => `${clave}=${valor}`)
      .join('\n');
    await writeFile(rutaCredenciales, `${contenido}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    return credenciales;
  }
}

async function ejecutarCreacion() {
  if (entorno.nodeEnv === 'production') {
    throw new Error('El administrador de desarrollo no puede crearse en producción.');
  }

  const credenciales = await obtenerCredencialesLocales();
  const validacion = esquemaAdministradorInicial.safeParse({
    codigo_institucional: credenciales.ADMIN_INICIAL_CODIGO,
    correo_institucional: credenciales.ADMIN_INICIAL_CORREO,
    nombres: credenciales.ADMIN_INICIAL_NOMBRES,
    apellidos: credenciales.ADMIN_INICIAL_APELLIDOS,
    contrasena: credenciales.ADMIN_INICIAL_CONTRASENA,
  });
  if (!validacion.success) {
    throw new Error('El archivo local del administrador contiene datos inválidos.');
  }

  const conexion = await grupoConexiones.getConnection();
  try {
    await conexion.beginTransaction();
    const administrador = await crearAdministradorInicial(conexion, validacion.data);
    await conexion.commit();
    console.log(
      `Administrador de desarrollo creado con el código ${administrador.codigo_institucional}.`,
    );
    console.log('Credenciales guardadas localmente con permisos restringidos.');
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
    await grupoConexiones.end();
  }
}

ejecutarCreacion().catch((error) => {
  console.error('No se pudo crear el administrador de desarrollo:', error.message);
  process.exitCode = 1;
});
