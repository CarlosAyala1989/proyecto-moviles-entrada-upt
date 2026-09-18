import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { grupoConexiones } from '../../config/database.js';
import { ErrorHttp } from '../../middleware/manejo_errores.js';
import { requerirRoles } from '../../middleware/requerir_roles.js';
import { validarDatos } from '../../middleware/validar_datos.js';
import { esquemaValidarIngreso } from '../ingresos/validacion/ingresos.esquemas.js';
import { interpretarConfiguracionCodigosQr, validarMomentoYPrecision } from '../codigos_qr/servicios/codigos_qr.servicio.js';

function fallo(codigo, mensaje, estadoHttp = 403) {
  return new ErrorHttp({ codigo, mensaje, estadoHttp });
}

export const esquemaUbicacionSeguridad = z.object({
  ubicacion: esquemaValidarIngreso.shape.ubicacion,
}).strict();
const contrasena = z.string().min(14).max(128)
  .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/);
const camposGuardia = {
  usuario: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9._-]+$/)
    .transform((valor) => valor.toUpperCase()),
  nombres: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(150),
  punto_acceso_id: z.number().int().positive(),
  activo: z.boolean().default(true),
};
const esquemaGuardia = z.object({ ...camposGuardia, contrasena }).strict();
const esquemaEditarGuardia = z.object({ ...camposGuardia, contrasena: contrasena.optional() }).strict();
const esquemaId = z.object({ id: z.coerce.number().int().positive() }).strict();

export async function obtenerAsignacionSeguridad(usuarioId) {
  const [punto] = await grupoConexiones.query(
    `SELECT p.id, p.codigo, p.nombre, p.latitud, p.longitud,
            p.radio_permitido_metros, p.estado
     FROM asignaciones_seguridad a JOIN puntos_acceso p ON p.id = a.punto_acceso_id
     WHERE a.usuario_id = ?`, [usuarioId],
  );
  if (!punto) throw fallo('SEGURIDAD_SIN_ASIGNACION', 'Antes de usar la aplicación, el administrador debe asignarte a una puerta de la universidad.');
  if (punto.estado !== 'ACTIVO') throw fallo('PUNTO_ACCESO_INACTIVO', 'Tu puerta asignada está inactiva. Pide ayuda al administrador.');
  return {
    ...punto,
    latitud: Number(punto.latitud), longitud: Number(punto.longitud),
    radio_permitido_metros: Number(punto.radio_permitido_metros),
  };
}

export async function comprobarUbicacionSeguridad(usuarioId, ubicacion, codigoPunto) {
  const configuracion = await grupoConexiones.query('SELECT clave, valor FROM configuraciones_sistema');
  validarMomentoYPrecision(ubicacion, interpretarConfiguracionCodigosQr(Object.fromEntries(configuracion.map(({ clave, valor }) => [clave, valor]))));
  const punto = await obtenerAsignacionSeguridad(usuarioId);
  if (codigoPunto && codigoPunto !== punto.codigo) {
    throw fallo('SEGURIDAD_PUNTO_NO_ASIGNADO', 'Sólo puedes operar en la puerta asignada por el administrador.');
  }
  const radianes = (valor) => valor * Math.PI / 180;
  const diferenciaLatitud = radianes(ubicacion.latitud - punto.latitud);
  const diferenciaLongitud = radianes(ubicacion.longitud - punto.longitud);
  const a = Math.sin(diferenciaLatitud / 2) ** 2
    + Math.cos(radianes(punto.latitud)) * Math.cos(radianes(ubicacion.latitud))
    * Math.sin(diferenciaLongitud / 2) ** 2;
  const distancia = 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  if (distancia + ubicacion.precision_metros > punto.radio_permitido_metros) {
    throw fallo('SEGURIDAD_FUERA_DE_ZONA', `Debes estar dentro del radio de ${punto.radio_permitido_metros} metros de ${punto.nombre}. Acércate a tu puerta asignada y vuelve a comprobar la ubicación.`);
  }
  return { punto_acceso: punto, distancia_metros: Math.round(distancia), habilitado: true };
}

async function consultarGuardias() {
  return grupoConexiones.query(
    `SELECT u.id, u.codigo_institucional AS usuario, u.nombres, u.apellidos, u.estado,
            a.punto_acceso_id, p.nombre AS punto_acceso_nombre
     FROM usuarios u JOIN usuarios_roles ur ON ur.usuario_id = u.id
     JOIN roles r ON r.id = ur.rol_id AND r.nombre = 'SEGURIDAD'
     LEFT JOIN asignaciones_seguridad a ON a.usuario_id = u.id
     LEFT JOIN puntos_acceso p ON p.id = a.punto_acceso_id
     ORDER BY u.apellidos, u.nombres`,
  );
}

async function guardarGuardia(datos, actorId, id) {
  const hash = datos.contrasena ? await bcrypt.hash(datos.contrasena, 12) : null;
  const conexion = await grupoConexiones.getConnection();
  try {
    await conexion.beginTransaction();
    const [punto] = await conexion.query("SELECT id FROM puntos_acceso WHERE id = ? AND estado = 'ACTIVO' FOR UPDATE", [datos.punto_acceso_id]);
    if (!punto) throw fallo('PUNTO_ACCESO_NO_ENCONTRADO', 'Selecciona una puerta activa.', 400);
    if (id) {
      const roles = await conexion.query(
        'SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = ?', [id],
      );
      if (roles.length !== 1 || roles[0].nombre !== 'SEGURIDAD') {
        throw fallo('GUARDIA_NO_ENCONTRADO', 'Este usuario no es una cuenta exclusiva de seguridad.', 404);
      }
      await conexion.query(
        `UPDATE usuarios SET codigo_institucional = ?,
         correo_institucional = CASE WHEN correo_institucional LIKE '%@seguridad.example.invalid' THEN ? ELSE correo_institucional END,
         nombres = ?, apellidos = ?, identidad_verificada = TRUE,
         identidad_verificada_en = COALESCE(identidad_verificada_en, CURRENT_TIMESTAMP(3)),
         estado = ?, estado_autorizacion = 'AUTORIZADO',
         contrasena_hash = COALESCE(?, contrasena_hash),
         intentos_fallidos_inicio_sesion = 0, bloqueado_hasta = NULL WHERE id = ?`,
        [datos.usuario, `${datos.usuario.toLowerCase()}@seguridad.example.invalid`, datos.nombres, datos.apellidos, datos.activo ? 'ACTIVO' : 'INACTIVO', hash, id],
      );
      await conexion.query(
        "UPDATE sesiones SET estado = 'REVOCADA', revocada_en = CURRENT_TIMESTAMP(3), motivo_revocacion = 'GUARDIA_ACTUALIZADO' WHERE usuario_id = ? AND estado = 'ACTIVA'", [id],
      );
    } else {
      const resultado = await conexion.query(
        `INSERT INTO usuarios (codigo_institucional, correo_institucional, contrasena_hash,
         nombres, apellidos, estado, estado_autorizacion, identidad_verificada, identidad_verificada_en)
         VALUES (?, ?, ?, ?, ?, ?, 'AUTORIZADO', TRUE, CURRENT_TIMESTAMP(3))`,
        [datos.usuario, `${datos.usuario.toLowerCase()}@seguridad.example.invalid`, hash,
          datos.nombres, datos.apellidos, datos.activo ? 'ACTIVO' : 'INACTIVO'],
      );
      id = resultado.insertId;
      const asignacionRol = await conexion.query(
        "INSERT INTO usuarios_roles (usuario_id, rol_id, asignado_por) SELECT ?, id, ? FROM roles WHERE nombre = 'SEGURIDAD' AND activo = TRUE", [id, actorId],
      );
      if (asignacionRol.affectedRows !== 1) throw fallo('ROL_INVALIDO', 'El rol de seguridad no está activo.', 400);
    }
    await conexion.query(
      `INSERT INTO asignaciones_seguridad (usuario_id, punto_acceso_id, asignado_por)
       VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE punto_acceso_id = VALUES(punto_acceso_id), asignado_por = VALUES(asignado_por)`,
      [id, datos.punto_acceso_id, actorId],
    );
    await conexion.query(
      "INSERT INTO registros_auditoria (usuario_actor_id, accion, entidad, entidad_id, detalle) VALUES (?, 'GUARDIA_ASIGNADO', 'USUARIO', ?, ?)",
      [actorId, String(id), JSON.stringify({ punto_acceso_id: datos.punto_acceso_id })],
    );
    await conexion.commit();
    return { id };
  } catch (error) {
    await conexion.rollback();
    if (error.errno === 1062) throw fallo('IDENTIFICADOR_INSTITUCIONAL_DUPLICADO', 'Ese usuario ya existe.', 409);
    throw error;
  } finally {
    conexion.release();
  }
}

export function crearEnrutadorGuardias() {
  const enrutador = Router();
  enrutador.get('/guardias', async (_solicitud, respuesta) => respuesta.json({ datos: await consultarGuardias() }));
  enrutador.post('/guardias', validarDatos({ cuerpo: esquemaGuardia }), async (solicitud, respuesta) => {
    respuesta.status(201).json({ datos: await guardarGuardia(solicitud.datosValidados.cuerpo, solicitud.usuarioAutenticado.id) });
  });
  enrutador.put('/guardias/:id', validarDatos({ cuerpo: esquemaEditarGuardia, parametros: esquemaId }), async (solicitud, respuesta) => {
    respuesta.json({ datos: await guardarGuardia(solicitud.datosValidados.cuerpo, solicitud.usuarioAutenticado.id, solicitud.datosValidados.parametros.id) });
  });
  return enrutador;
}

export function crearEnrutadorUbicacionSeguridad(requerirAutenticacion) {
  const enrutador = Router();
  enrutador.use(requerirAutenticacion, requerirRoles('SEGURIDAD'));
  enrutador.post('/comprobar-ubicacion', validarDatos({ cuerpo: esquemaUbicacionSeguridad }), async (solicitud, respuesta) => {
    respuesta.json({ datos: await comprobarUbicacionSeguridad(solicitud.usuarioAutenticado.id, solicitud.datosValidados.cuerpo.ubicacion) });
  });
  return enrutador;
}
