import bcrypt from 'bcryptjs';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';

export async function crearAdministradorInicial(conexion, datos, { metodo = 'COMANDO_LOCAL' } = {}) {
  const [administradorExistente] = await conexion.query(
    `SELECT usuarios.id
     FROM usuarios
     JOIN usuarios_roles ON usuarios_roles.usuario_id = usuarios.id
     JOIN roles ON roles.id = usuarios_roles.rol_id
     WHERE roles.nombre = 'ADMINISTRADOR'
     LIMIT 1`,
  );

  if (administradorExistente) {
    throw new ErrorHttp({
      codigo: 'ADMINISTRADOR_INICIAL_YA_EXISTE',
      mensaje: 'Ya existe un administrador. El procedimiento inicial fue deshabilitado.',
      estadoHttp: 409,
    });
  }

  const [rolAdministrador] = await conexion.query(
    "SELECT id FROM roles WHERE nombre = 'ADMINISTRADOR' AND activo = TRUE",
  );
  if (!rolAdministrador) {
    throw new Error('El rol ADMINISTRADOR no está disponible.');
  }

  const contrasenaHash = await bcrypt.hash(datos.contrasena, 12);
  const resultado = await conexion.query(
    `INSERT INTO usuarios (
      codigo_institucional,
      correo_institucional,
      contrasena_hash,
      nombres,
      apellidos,
      estado,
      estado_autorizacion,
      identidad_verificada,
      identidad_verificada_en
    ) VALUES (?, ?, ?, ?, ?, 'ACTIVO', 'AUTORIZADO', TRUE, CURRENT_TIMESTAMP(3))`,
    [
      datos.codigo_institucional,
      datos.correo_institucional,
      contrasenaHash,
      datos.nombres,
      datos.apellidos,
    ],
  );

  await conexion.query(
    'INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES (?, ?)',
    [resultado.insertId, rolAdministrador.id],
  );
  await conexion.query(
    `INSERT INTO registros_auditoria
      (usuario_actor_id, accion, entidad, entidad_id, detalle)
     VALUES (?, 'ADMINISTRADOR_INICIAL_CREADO', 'USUARIO', ?, ?)`,
    [
      resultado.insertId,
      String(resultado.insertId),
      JSON.stringify({ metodo }),
    ],
  );

  return {
    id: resultado.insertId,
    codigo_institucional: datos.codigo_institucional,
    correo_institucional: datos.correo_institucional,
    roles: ['ADMINISTRADOR'],
  };
}
