import { crearAdministradorInicial } from '../modulos/usuarios/servicios/crear_administrador_inicial.js';
import { esquemaAdministradorInicial } from '../modulos/usuarios/validacion/usuarios.esquemas.js';

export async function asegurarAdministradorInicial(grupoConexiones) {
  const variables = ['CODIGO', 'CORREO', 'NOMBRES', 'APELLIDOS', 'CONTRASENA'];
  if (!variables.some((campo) => process.env[`ADMIN_INICIAL_${campo}`])) return;
  const datos = esquemaAdministradorInicial.parse({
    codigo_institucional: process.env.ADMIN_INICIAL_CODIGO,
    correo_institucional: process.env.ADMIN_INICIAL_CORREO,
    nombres: process.env.ADMIN_INICIAL_NOMBRES,
    apellidos: process.env.ADMIN_INICIAL_APELLIDOS,
    contrasena: process.env.ADMIN_INICIAL_CONTRASENA,
  });
  const conexion = await grupoConexiones.getConnection();
  let nombreBloqueo;
  let adquirido = false;
  try {
    const [base] = await conexion.query('SELECT DATABASE() AS nombre');
    nombreBloqueo = `upt:admin:${base.nombre}`.slice(0, 64);
    const [bloqueo] = await conexion.query('SELECT GET_LOCK(?, 60) AS obtenido', [nombreBloqueo]);
    if (Number(bloqueo.obtenido) !== 1) throw new Error('No se pudo bloquear la creación del administrador inicial.');
    adquirido = true;
    await conexion.beginTransaction();
    try {
      await crearAdministradorInicial(conexion, datos, { metodo: 'ARRANQUE' });
      await conexion.commit();
      console.log('Administrador inicial creado.');
    } catch (error) {
      await conexion.rollback();
      if (error.codigo !== 'ADMINISTRADOR_INICIAL_YA_EXISTE') throw error;
      console.log('Administrador existente conservado.');
    }
  } finally {
    try {
      if (adquirido) await conexion.query('SELECT RELEASE_LOCK(?)', [nombreBloqueo]);
    } finally {
      conexion.release();
    }
  }
}
