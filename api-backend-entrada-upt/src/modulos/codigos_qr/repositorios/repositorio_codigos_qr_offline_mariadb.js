import { grupoConexiones } from '../../../config/database.js';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';
import { cifrarSecretoOffline, generarSecretoOffline } from '../../../seguridad/codigos_qr_offline.js';
import { calcularHashToken } from '../../../seguridad/tokens.js';

export class RepositorioCodigosQrOfflineMariaDb {
  async preparar({ usuarioId, sesionId, identificadorDispositivo, plataforma }) {
    const secreto = generarSecretoOffline();
    const secretoCifrado = cifrarSecretoOffline(secreto);
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      const [usuario] = await conexion.query(
        'SELECT estado, estado_autorizacion, identidad_verificada FROM usuarios WHERE id = ? FOR UPDATE',
        [usuarioId],
      );
      if (!usuario || usuario.estado !== 'ACTIVO' || usuario.estado_autorizacion !== 'AUTORIZADO'
          || !usuario.identidad_verificada) {
        throw new ErrorHttp({ codigo: 'USUARIO_NO_HABILITADO', mensaje: 'La identidad no está habilitada.', estadoHttp: 403 });
      }
      const roles = await conexion.query(
        `SELECT roles.nombre FROM usuarios_roles JOIN roles ON roles.id = usuarios_roles.rol_id
         WHERE usuarios_roles.usuario_id = ? AND roles.activo = TRUE`, [usuarioId],
      );
      if (!roles.some(({ nombre }) => nombre === 'ESTUDIANTE')) {
        throw new ErrorHttp({ codigo: 'ROL_NO_HABILITADO_PARA_CODIGO_QR', mensaje: 'La cuenta no puede solicitar ingreso.', estadoHttp: 403 });
      }
      const [sesion] = await conexion.query(
        `SELECT estado, expira_en > CURRENT_TIMESTAMP(3) AS vigente
         FROM sesiones WHERE id = ? AND usuario_id = ? FOR UPDATE`, [sesionId, usuarioId],
      );
      if (!sesion || sesion.estado !== 'ACTIVA' || !sesion.vigente) {
        throw new ErrorHttp({ codigo: 'SESION_NO_VALIDA_PARA_CODIGO_QR', mensaje: 'Inicia sesión nuevamente.', estadoHttp: 401 });
      }
      const identificadorHash = calcularHashToken(identificadorDispositivo);
      const [existente] = await conexion.query(
        'SELECT id, usuario_id FROM dispositivos WHERE identificador_hash = ? FOR UPDATE',
        [identificadorHash],
      );
      if (existente && existente.usuario_id !== usuarioId) {
        throw new ErrorHttp({ codigo: 'DISPOSITIVO_VINCULADO_A_OTRA_CUENTA', mensaje: 'El dispositivo pertenece a otra cuenta.', estadoHttp: 409 });
      }
      let dispositivoId = existente?.id;
      if (existente) {
        await conexion.query(
          `UPDATE dispositivos SET estado = 'ACTIVO', plataforma = ?, secreto_qr_cifrado = ?,
           qr_vinculado_en = CURRENT_TIMESTAMP(3), visto_por_ultima_vez_en = CURRENT_TIMESTAMP(3)
           WHERE id = ?`, [plataforma, secretoCifrado, dispositivoId],
        );
      } else {
        const resultado = await conexion.query(
          `INSERT INTO dispositivos (usuario_id, identificador_hash, plataforma,
           secreto_qr_cifrado, qr_vinculado_en, visto_por_ultima_vez_en)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
          [usuarioId, identificadorHash, plataforma, secretoCifrado],
        );
        dispositivoId = resultado.insertId;
      }
      await conexion.query(
        `UPDATE dispositivos SET estado = 'REVOCADO', secreto_qr_cifrado = NULL
         WHERE usuario_id = ? AND id <> ? AND estado = 'ACTIVO'`, [usuarioId, dispositivoId],
      );
      const [reloj] = await conexion.query('SELECT CURRENT_TIMESTAMP(3) AS ahora');
      await conexion.query(
        `INSERT INTO registros_auditoria (usuario_actor_id, accion, entidad, detalle)
         VALUES (?, 'DISPOSITIVO_QR_OFFLINE_VINCULADO', 'DISPOSITIVO', ?)`,
        [usuarioId, JSON.stringify({ dispositivo_id: dispositivoId })],
      );
      await conexion.commit();
      return {
        dispositivo_id: dispositivoId,
        secreto: secreto.toString('base64url'),
        hora_servidor: reloj.ahora.toISOString(),
        periodo_segundos: 15,
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }
}
