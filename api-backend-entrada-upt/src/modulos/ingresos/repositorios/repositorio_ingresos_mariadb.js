import { grupoConexiones } from '../../../config/database.js';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';
import { compararHashes } from '../../../seguridad/codigos_qr.js';

const clavesConfiguracion = [
  'DURACION_QR_SEGUNDOS',
  'QR_UN_SOLO_USO',
  'ANTIGUEDAD_MAXIMA_UBICACION_SEGUNDOS',
  'DESFASE_FUTURO_UBICACION_SEGUNDOS',
  'PRECISION_MAXIMA_UBICACION_METROS',
];
const rolesPortadores = ['ESTUDIANTE', 'DOCENTE', 'TRABAJADOR'];

const mensajesDecision = {
  ACCESO_AUTORIZADO: 'Ingreso autorizado.',
  TOKEN_INVALIDO: 'El código QR no es válido.',
  INTEGRIDAD_CREDENCIAL_INVALIDA: 'El código QR fue alterado o está incompleto.',
  CREDENCIAL_EXPIRADA: 'El código QR ha vencido.',
  CREDENCIAL_REVOCADA: 'El código QR fue revocado.',
  CREDENCIAL_YA_UTILIZADA: 'El código QR ya fue utilizado.',
  USUARIO_NO_HABILITADO: 'El usuario no está habilitado para ingresar.',
  IDENTIDAD_NO_VERIFICADA: 'La identidad del usuario no está verificada.',
  ROL_PORTADOR_NO_HABILITADO: 'El usuario no posee un rol habilitado para ingresar.',
  SESION_USUARIO_INVALIDA: 'La sesión asociada al código QR ya no es válida.',
  PUNTO_ACCESO_INACTIVO: 'El punto de acceso no está habilitado.',
  PUNTO_ACCESO_NO_COINCIDE: 'El código QR fue emitido para otro punto de acceso.',
  UBICACION_ESCANEO_FUERA_DE_ZONA: 'La ubicación del escaneo está fuera de la zona permitida.',
};

async function consultarRoles(conexion, usuarioId) {
  const filas = await conexion.query(
    `SELECT roles.nombre
     FROM usuarios_roles
     JOIN roles ON roles.id = usuarios_roles.rol_id
     WHERE usuarios_roles.usuario_id = ? AND roles.activo = TRUE
     ORDER BY roles.nombre`,
    [usuarioId],
  );
  return filas.map(({ nombre }) => nombre);
}

async function bloquearPersonalSeguridad(conexion, usuarioSeguridadId) {
  const [usuario] = await conexion.query(
    `SELECT id, estado, estado_autorizacion
     FROM usuarios WHERE id = ? FOR UPDATE`,
    [usuarioSeguridadId],
  );
  const roles = usuario
    ? await consultarRoles(conexion, usuarioSeguridadId)
    : [];
  if (
    !usuario
    || usuario.estado !== 'ACTIVO'
    || usuario.estado_autorizacion !== 'AUTORIZADO'
    || !roles.includes('SEGURIDAD')
  ) {
    throw new ErrorHttp({
      codigo: 'PERSONAL_SEGURIDAD_NO_HABILITADO',
      mensaje: 'El personal de seguridad no está habilitado para validar ingresos.',
      estadoHttp: 403,
    });
  }
}

async function seleccionarPuntoAcceso(conexion, codigo, ubicacion) {
  const [punto] = await conexion.query(
    `SELECT
      id,
      codigo,
      nombre,
      estado,
      radio_permitido_metros,
      ST_Distance_Sphere(
        POINT(longitud, latitud),
        POINT(?, ?)
      ) AS distancia_metros
     FROM puntos_acceso
     WHERE codigo = ?
     LIMIT 1
     FOR UPDATE`,
    [ubicacion.longitud, ubicacion.latitud, codigo],
  );
  if (!punto) {
    throw new ErrorHttp({
      codigo: 'PUNTO_ACCESO_NO_ENCONTRADO',
      mensaje: 'El punto de acceso indicado no existe.',
      estadoHttp: 422,
    });
  }
  return {
    id: punto.id,
    codigo: punto.codigo,
    nombre: punto.nombre,
    estado: punto.estado,
    radioPermitidoMetros: Number(punto.radio_permitido_metros),
    distanciaMetros: Number(punto.distancia_metros),
  };
}

async function registrarDecision(conexion, {
  resultado,
  motivo,
  usuarioId,
  credencialId,
  puntoAcceso,
  usuarioSeguridadId,
  codigo,
  ubicacion,
  detalle = {},
  identidad,
}) {
  const registro = await conexion.query(
    `INSERT INTO registros_acceso (
      usuario_id,
      credencial_id,
      punto_acceso_id,
      usuario_seguridad_id,
      huella_token,
      resultado,
      motivo,
      detalle,
      latitud_escaneo,
      longitud_escaneo,
      precision_escaneo_metros,
      ubicacion_escaneo_obtenida_en,
      distancia_escaneo_metros
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      usuarioId ?? null,
      credencialId ?? null,
      puntoAcceso.id,
      usuarioSeguridadId,
      codigo.huellaToken,
      resultado,
      motivo,
      JSON.stringify({
        precision_reportada_metros: ubicacion.precision_metros,
        distancia_calculada_metros: Number(puntoAcceso.distanciaMetros.toFixed(2)),
        ...detalle,
      }),
      ubicacion.latitud,
      ubicacion.longitud,
      ubicacion.precision_metros,
      ubicacion.obtenida_en,
      puntoAcceso.distanciaMetros,
    ],
  );
  const [fila] = await conexion.query(
    'SELECT registrado_en FROM registros_acceso WHERE id = ?',
    [registro.insertId],
  );

  return {
    resultado,
    motivo,
    mensaje: mensajesDecision[motivo],
    registradoEn: fila.registrado_en,
    puntoAcceso: {
      codigo: puntoAcceso.codigo,
      nombre: puntoAcceso.nombre,
    },
    ...(identidad ? { identidad } : {}),
  };
}

function decisionDenegada(datos, motivo, detalle) {
  return registrarDecision(datos.conexion, {
    ...datos,
    resultado: 'DENEGADO',
    motivo,
    detalle,
  });
}

function coincideIntegridad(credencial, codigo) {
  const tokenCoincide = compararHashes(
    credencial.token_hash,
    codigo.referenciaHash,
  ) || compararHashes(
    credencial.token_hash,
    codigo.codigoCompletoHash,
  );
  return tokenCoincide
    && compararHashes(credencial.otp_hash, codigo.otpHash)
    && compararHashes(credencial.nonce_hash, codigo.nonceHash);
}

export class RepositorioIngresosMariaDb {
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

  async validar({
    codigo,
    puntoAccesoCodigo,
    ubicacion,
    usuarioSeguridadId,
    unSoloUso,
  }) {
    const conexion = await grupoConexiones.getConnection();
    try {
      await conexion.beginTransaction();
      await bloquearPersonalSeguridad(conexion, usuarioSeguridadId);

      let referencia = null;
      let usuario = null;
      let sesion = null;
      if (codigo.formatoValido) {
        [referencia] = await conexion.query(
          `SELECT id, usuario_id, sesion_id
           FROM credenciales_acceso
           WHERE token_hash IN (?, ?)
           ORDER BY id DESC
           LIMIT 1`,
          [codigo.referenciaHash, codigo.codigoCompletoHash],
        );
        if (referencia) {
          [usuario] = await conexion.query(
            `SELECT
              usuarios.id,
              usuarios.codigo_institucional,
              usuarios.nombres,
              usuarios.apellidos,
              COALESCE(
                NULLIF(usuarios.nombre_institucional, ''),
                CONCAT_WS(' ', usuarios.nombres, usuarios.apellidos)
              ) AS nombre_completo,
              usuarios.foto_url,
              usuarios.estado,
              usuarios.estado_autorizacion,
              usuarios.identidad_verificada,
              perfiles_academicos.escuela,
              perfiles_academicos.estado_academico
             FROM usuarios
             LEFT JOIN perfiles_academicos
               ON perfiles_academicos.usuario_id = usuarios.id
             WHERE usuarios.id = ?
             FOR UPDATE`,
            [referencia.usuario_id],
          );
          [sesion] = await conexion.query(
            `SELECT
              estado,
              token_renovacion_expira_en > CURRENT_TIMESTAMP(3)
                AS renovacion_vigente
             FROM sesiones
             WHERE id = ? AND usuario_id = ?
             FOR UPDATE`,
            [referencia.sesion_id, referencia.usuario_id],
          );
        }
      }

      const puntoAcceso = await seleccionarPuntoAcceso(
        conexion,
        puntoAccesoCodigo,
        ubicacion,
      );
      const datosDecision = {
        conexion,
        usuarioId: referencia?.usuario_id,
        credencialId: referencia?.id,
        puntoAcceso,
        usuarioSeguridadId,
        codigo,
        ubicacion,
      };

      if (puntoAcceso.estado !== 'ACTIVO') {
        const resultado = await decisionDenegada(
          datosDecision,
          'PUNTO_ACCESO_INACTIVO',
        );
        await conexion.commit();
        return resultado;
      }
      if (puntoAcceso.distanciaMetros > puntoAcceso.radioPermitidoMetros) {
        const resultado = await decisionDenegada(
          datosDecision,
          'UBICACION_ESCANEO_FUERA_DE_ZONA',
          { radio_permitido_metros: puntoAcceso.radioPermitidoMetros },
        );
        await conexion.commit();
        return resultado;
      }
      if (!codigo.formatoValido || !referencia) {
        const resultado = await decisionDenegada(datosDecision, 'TOKEN_INVALIDO');
        await conexion.commit();
        return resultado;
      }

      const [credencial] = await conexion.query(
        `SELECT
          id,
          usuario_id,
          sesion_id,
          punto_acceso_id,
          token_hash,
          otp_hash,
          nonce_hash,
          estado,
          expira_en <= CURRENT_TIMESTAMP(3) AS esta_expirada
         FROM credenciales_acceso
         WHERE id = ?
         FOR UPDATE`,
        [referencia.id],
      );

      if (!credencial || !coincideIntegridad(credencial, codigo)) {
        const resultado = await decisionDenegada(
          datosDecision,
          'INTEGRIDAD_CREDENCIAL_INVALIDA',
        );
        await conexion.commit();
        return resultado;
      }
      if (usuario.estado !== 'ACTIVO' || usuario.estado_autorizacion !== 'AUTORIZADO') {
        const resultado = await decisionDenegada(
          datosDecision,
          'USUARIO_NO_HABILITADO',
        );
        await conexion.commit();
        return resultado;
      }
      if (!usuario.identidad_verificada) {
        const resultado = await decisionDenegada(
          datosDecision,
          'IDENTIDAD_NO_VERIFICADA',
        );
        await conexion.commit();
        return resultado;
      }

      const roles = await consultarRoles(conexion, usuario.id);
      const rolesValidos = roles.filter((rol) => rolesPortadores.includes(rol));
      if (rolesValidos.length === 0) {
        const resultado = await decisionDenegada(
          datosDecision,
          'ROL_PORTADOR_NO_HABILITADO',
        );
        await conexion.commit();
        return resultado;
      }
      if (!sesion || sesion.estado !== 'ACTIVA' || !sesion.renovacion_vigente) {
        const resultado = await decisionDenegada(
          datosDecision,
          'SESION_USUARIO_INVALIDA',
        );
        await conexion.commit();
        return resultado;
      }
      if (credencial.punto_acceso_id !== puntoAcceso.id) {
        const resultado = await decisionDenegada(
          datosDecision,
          'PUNTO_ACCESO_NO_COINCIDE',
        );
        await conexion.commit();
        return resultado;
      }
      if (credencial.estado === 'REVOCADA') {
        const resultado = await decisionDenegada(
          datosDecision,
          'CREDENCIAL_REVOCADA',
        );
        await conexion.commit();
        return resultado;
      }
      if (credencial.estado === 'USADA') {
        const resultado = await decisionDenegada(
          datosDecision,
          'CREDENCIAL_YA_UTILIZADA',
        );
        await conexion.commit();
        return resultado;
      }
      if (credencial.estado === 'EXPIRADA' || credencial.esta_expirada) {
        if (credencial.estado === 'PENDIENTE') {
          await conexion.query(
            "UPDATE credenciales_acceso SET estado = 'EXPIRADA' WHERE id = ?",
            [credencial.id],
          );
        }
        const resultado = await decisionDenegada(
          datosDecision,
          'CREDENCIAL_EXPIRADA',
        );
        await conexion.commit();
        return resultado;
      }

      if (unSoloUso) {
        const consumo = await conexion.query(
          `UPDATE credenciales_acceso
           SET estado = 'USADA', usada_en = CURRENT_TIMESTAMP(3)
           WHERE id = ? AND estado = 'PENDIENTE'`,
          [credencial.id],
        );
        if (consumo.affectedRows !== 1) {
          const resultado = await decisionDenegada(
            datosDecision,
            'CREDENCIAL_YA_UTILIZADA',
          );
          await conexion.commit();
          return resultado;
        }
      }

      const resultado = await registrarDecision(conexion, {
        ...datosDecision,
        resultado: 'AUTORIZADO',
        motivo: 'ACCESO_AUTORIZADO',
        identidad: {
          foto_url: usuario.foto_url,
          nombre_completo: usuario.nombre_completo,
          codigo_institucional: usuario.codigo_institucional,
          tipo_usuario: rolesValidos,
          escuela: usuario.escuela,
          estado_academico: usuario.estado_academico,
        },
      });
      await conexion.commit();
      return resultado;
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  async consultarRecientes({ usuarioSeguridadId, limite }) {
    const filas = await grupoConexiones.query(
      `SELECT
        registros_acceso.id,
        registros_acceso.resultado,
        registros_acceso.motivo,
        registros_acceso.registrado_en,
        puntos_acceso.codigo AS punto_codigo,
        puntos_acceso.nombre AS punto_nombre,
        usuarios.id AS usuario_id,
        usuarios.codigo_institucional,
        COALESCE(
          NULLIF(usuarios.nombre_institucional, ''),
          CONCAT_WS(' ', usuarios.nombres, usuarios.apellidos)
        ) AS nombre_completo
       FROM registros_acceso
       JOIN puntos_acceso
         ON puntos_acceso.id = registros_acceso.punto_acceso_id
       LEFT JOIN usuarios ON usuarios.id = registros_acceso.usuario_id
       WHERE registros_acceso.usuario_seguridad_id = ?
       ORDER BY registros_acceso.id DESC
       LIMIT ?`,
      [usuarioSeguridadId, limite],
    );
    return filas.map((fila) => ({
      id: fila.id,
      resultado: fila.resultado,
      motivo: fila.motivo,
      registrado_en: fila.registrado_en,
      punto_acceso: {
        codigo: fila.punto_codigo,
        nombre: fila.punto_nombre,
      },
      usuario: fila.resultado === 'AUTORIZADO' && fila.usuario_id
        ? {
          codigo_institucional: fila.codigo_institucional,
          nombre_completo: fila.nombre_completo,
        }
        : null,
    }));
  }
}
