import { grupoConexiones } from '../../../config/database.js';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';

const clavesConfiguracion = [
  'DURACION_QR_SEGUNDOS',
  'QR_UN_SOLO_USO',
  'ANTIGUEDAD_MAXIMA_UBICACION_SEGUNDOS',
  'DESFASE_FUTURO_UBICACION_SEGUNDOS',
  'PRECISION_MAXIMA_UBICACION_METROS',
];

function errorUsuarioNoHabilitado() {
  return new ErrorHttp({
    codigo: 'USUARIO_NO_HABILITADO',
    mensaje: 'El usuario no está habilitado para generar códigos QR.',
    estadoHttp: 403,
  });
}

async function consultarRoles(conexion, usuarioId) {
  const filas = await conexion.query(
    `SELECT roles.nombre
     FROM usuarios_roles
     JOIN roles ON roles.id = usuarios_roles.rol_id
     WHERE usuarios_roles.usuario_id = ? AND roles.activo = TRUE`,
    [usuarioId],
  );
  return filas.map(({ nombre }) => nombre);
}

async function seleccionarPuntoAcceso(conexion, ubicacion) {
  const [punto] = await conexion.query(
    `SELECT
      id,
      codigo,
      nombre,
      radio_permitido_metros,
      ST_Distance_Sphere(
        POINT(longitud, latitud),
        POINT(?, ?)
      ) AS distancia_metros
     FROM puntos_acceso
     WHERE estado = 'ACTIVO'
     ORDER BY distancia_metros
     LIMIT 1
     FOR UPDATE`,
    [ubicacion.longitud, ubicacion.latitud],
  );

  if (!punto) {
    throw new ErrorHttp({
      codigo: 'PUNTO_ACCESO_NO_DISPONIBLE',
      mensaje: 'No existe un punto de acceso activo para validar la ubicación.',
      estadoHttp: 503,
    });
  }
  if (Number(punto.distancia_metros) > Number(punto.radio_permitido_metros)) {
    throw new ErrorHttp({
      codigo: 'UBICACION_FUERA_DE_ZONA',
      mensaje: 'La ubicación informada está fuera de las zonas permitidas.',
      estadoHttp: 403,
    });
  }

  return {
    id: punto.id,
    codigo: punto.codigo,
    nombre: punto.nombre,
    radio_permitido_metros: Number(punto.radio_permitido_metros),
    distancia_metros: Number(punto.distancia_metros),
  };
}

export class RepositorioCodigosQrMariaDb {
  async consultarConfiguracion() {
    const marcadores = clavesConfiguracion.map(() => '?').join(', ');
    const filas = await grupoConexiones.query(
      `SELECT clave, valor
       FROM configuraciones_sistema
       WHERE clave IN (${marcadores})`,
      clavesConfiguracion,
    );
    return Object.fromEntries(filas.map(({ clave, valor }) => [clave, valor]));
  }

  async generar({
    usuarioId,
    sesionId,
    ubicacion,
    duracionSegundos,
    tokenHash,
    otpHash,
    nonceHash,
  }) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const [usuario] = await conexion.query(
        `SELECT estado, estado_autorizacion, identidad_verificada
         FROM usuarios WHERE id = ? FOR UPDATE`,
        [usuarioId],
      );
      if (!usuario) {
        throw new ErrorHttp({
          codigo: 'IDENTIDAD_DIGITAL_NO_ENCONTRADA',
          mensaje: 'No se encontró la identidad digital del usuario.',
          estadoHttp: 404,
        });
      }
      if (usuario.estado !== 'ACTIVO' || usuario.estado_autorizacion !== 'AUTORIZADO') {
        throw errorUsuarioNoHabilitado();
      }
      if (!usuario.identidad_verificada) {
        throw new ErrorHttp({
          codigo: 'IDENTIDAD_NO_VERIFICADA',
          mensaje: 'La identidad debe estar verificada para generar un código QR.',
          estadoHttp: 403,
        });
      }

      const roles = await consultarRoles(conexion, usuarioId);
      if (!roles.some((rol) => ['ESTUDIANTE', 'DOCENTE', 'TRABAJADOR'].includes(rol))) {
        throw new ErrorHttp({
          codigo: 'ROL_NO_HABILITADO_PARA_CODIGO_QR',
          mensaje: 'El usuario no posee un rol habilitado para solicitar ingreso.',
          estadoHttp: 403,
        });
      }

      const [sesion] = await conexion.query(
        `SELECT
          estado,
          expira_en > CURRENT_TIMESTAMP(3) AS acceso_vigente
         FROM sesiones
         WHERE id = ? AND usuario_id = ?
         FOR UPDATE`,
        [sesionId, usuarioId],
      );
      if (!sesion || sesion.estado !== 'ACTIVA' || !sesion.acceso_vigente) {
        throw new ErrorHttp({
          codigo: 'SESION_NO_VALIDA_PARA_CODIGO_QR',
          mensaje: 'La sesión ya no permite generar códigos QR.',
          estadoHttp: 401,
        });
      }

      const puntoAcceso = await seleccionarPuntoAcceso(conexion, ubicacion);

      await conexion.query(
        `UPDATE credenciales_acceso
         SET estado = 'EXPIRADA'
         WHERE usuario_id = ?
           AND estado = 'PENDIENTE'
           AND expira_en <= CURRENT_TIMESTAMP(3)`,
        [usuarioId],
      );
      await conexion.query(
        `UPDATE credenciales_acceso
         SET estado = 'REVOCADA',
             revocada_en = CURRENT_TIMESTAMP(3),
             motivo_revocacion = 'ROTACION_CODIGO_QR'
         WHERE usuario_id = ? AND estado = 'PENDIENTE'`,
        [usuarioId],
      );

      const resultado = await conexion.query(
        `INSERT INTO credenciales_acceso (
          usuario_id,
          sesion_id,
          punto_acceso_id,
          token_hash,
          otp_hash,
          nonce_hash,
          expira_en,
          latitud_emision,
          longitud_emision,
          precision_metros,
          ubicacion_obtenida_en,
          distancia_punto_acceso_metros
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          TIMESTAMPADD(SECOND, ?, CURRENT_TIMESTAMP(3)),
          ?, ?, ?, ?, ?
        )`,
        [
          usuarioId,
          sesionId,
          puntoAcceso.id,
          tokenHash,
          otpHash,
          nonceHash,
          duracionSegundos,
          ubicacion.latitud,
          ubicacion.longitud,
          ubicacion.precision_metros,
          ubicacion.obtenida_en,
          puntoAcceso.distancia_metros,
        ],
      );
      await conexion.query(
        `INSERT INTO registros_auditoria
          (usuario_actor_id, accion, entidad, entidad_id)
         VALUES (?, 'CODIGO_QR_GENERADO', 'CREDENCIAL_ACCESO', ?)`,
        [usuarioId, String(resultado.insertId)],
      );
      const [credencial] = await conexion.query(
        `SELECT emitida_en, expira_en
         FROM credenciales_acceso WHERE id = ?`,
        [resultado.insertId],
      );
      await conexion.commit();

      return {
        id: resultado.insertId,
        emitida_en: credencial.emitida_en,
        expira_en: credencial.expira_en,
        punto_acceso: puntoAcceso,
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  async consultarActual(usuarioId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      await conexion.query(
        `UPDATE credenciales_acceso
         SET estado = 'EXPIRADA'
         WHERE usuario_id = ?
           AND estado = 'PENDIENTE'
           AND expira_en <= CURRENT_TIMESTAMP(3)`,
        [usuarioId],
      );
      const [credencial] = await conexion.query(
        `SELECT
          credenciales_acceso.estado,
          credenciales_acceso.emitida_en,
          credenciales_acceso.expira_en,
          credenciales_acceso.revocada_en,
          puntos_acceso.codigo AS punto_codigo,
          puntos_acceso.nombre AS punto_nombre
         FROM credenciales_acceso
         LEFT JOIN puntos_acceso
           ON puntos_acceso.id = credenciales_acceso.punto_acceso_id
         WHERE credenciales_acceso.usuario_id = ?
         ORDER BY credenciales_acceso.id DESC
         LIMIT 1`,
        [usuarioId],
      );
      await conexion.commit();
      if (!credencial) return null;

      return {
        estado: credencial.estado,
        emitida_en: credencial.emitida_en,
        expira_en: credencial.expira_en,
        revocada_en: credencial.revocada_en,
        punto_acceso: credencial.punto_codigo
          ? { codigo: credencial.punto_codigo, nombre: credencial.punto_nombre }
          : null,
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  async revocarActual(usuarioId) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await conexion.query(
        `UPDATE credenciales_acceso
         SET estado = 'REVOCADA',
             revocada_en = CURRENT_TIMESTAMP(3),
             motivo_revocacion = 'REVOCACION_USUARIO'
         WHERE usuario_id = ? AND estado = 'PENDIENTE'`,
        [usuarioId],
      );
      if (resultado.affectedRows > 0) {
        await conexion.query(
          `INSERT INTO registros_auditoria
            (usuario_actor_id, accion, entidad, detalle)
           VALUES (?, 'CODIGO_QR_REVOCADO', 'CREDENCIAL_ACCESO', ?)`,
          [usuarioId, JSON.stringify({ cantidad: resultado.affectedRows })],
        );
      }
      await conexion.commit();
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }
}
