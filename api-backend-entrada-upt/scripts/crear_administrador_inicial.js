import { grupoConexiones } from '../src/config/database.js';
import { entorno } from '../src/config/env.js';
import { crearAdministradorInicial } from '../src/modulos/usuarios/servicios/crear_administrador_inicial.js';
import { esquemaAdministradorInicial } from '../src/modulos/usuarios/validacion/usuarios.esquemas.js';

async function ejecutarCreacion() {
  if (entorno.nodeEnv === 'production') {
    throw new Error('El administrador inicial solo puede crearse en desarrollo local.');
  }

  const validacion = esquemaAdministradorInicial.safeParse({
    codigo_institucional: process.env.ADMIN_INICIAL_CODIGO,
    correo_institucional: process.env.ADMIN_INICIAL_CORREO,
    nombres: process.env.ADMIN_INICIAL_NOMBRES,
    apellidos: process.env.ADMIN_INICIAL_APELLIDOS,
    contrasena: process.env.ADMIN_INICIAL_CONTRASENA,
  });

  if (!validacion.success) {
    throw new Error(
      'Las variables ADMIN_INICIAL_* están incompletas o la contraseña no cumple los requisitos.',
    );
  }

  const conexion = await grupoConexiones.getConnection();
  try {
    await conexion.beginTransaction();
    const administrador = await crearAdministradorInicial(conexion, validacion.data);
    await conexion.commit();
    console.log(
      `Administrador inicial creado con el código ${administrador.codigo_institucional}.`,
    );
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
    await grupoConexiones.end();
  }
}

ejecutarCreacion().catch((error) => {
  console.error('No se pudo crear el administrador inicial:', error.message);
  process.exitCode = 1;
});
