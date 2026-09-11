CREATE TABLE IF NOT EXISTS roles (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(40) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_roles_nombre (nombre),
  CONSTRAINT chk_roles_nombre CHECK (nombre = UPPER(nombre))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_institucional VARCHAR(30) NOT NULL,
  correo_institucional VARCHAR(254) NOT NULL,
  contrasena_hash VARCHAR(255) NULL,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(150) NOT NULL,
  nombre_institucional VARCHAR(255) NULL,
  nombre_intranet VARCHAR(255) NULL,
  foto_url VARCHAR(2048) NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  estado_autorizacion VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  identidad_verificada BOOLEAN NOT NULL DEFAULT FALSE,
  identidad_verificada_en DATETIME(3) NULL,
  ultimo_acceso_en DATETIME(3) NULL,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_codigo (codigo_institucional),
  UNIQUE KEY uk_usuarios_correo (correo_institucional),
  KEY idx_usuarios_estado_autorizacion (estado, estado_autorizacion),
  CONSTRAINT chk_usuarios_estado CHECK (
    estado IN ('PENDIENTE', 'ACTIVO', 'INACTIVO', 'BLOQUEADO', 'RECHAZADO')
  ),
  CONSTRAINT chk_usuarios_autorizacion CHECK (
    estado_autorizacion IN ('PENDIENTE', 'AUTORIZADO', 'DENEGADO')
  ),
  CONSTRAINT chk_usuarios_verificacion_fecha CHECK (
    (identidad_verificada = FALSE AND identidad_verificada_en IS NULL)
    OR (identidad_verificada = TRUE AND identidad_verificada_en IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS usuarios_roles (
  usuario_id BIGINT UNSIGNED NOT NULL,
  rol_id SMALLINT UNSIGNED NOT NULL,
  asignado_por BIGINT UNSIGNED NULL,
  asignado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (usuario_id, rol_id),
  KEY idx_usuarios_roles_rol (rol_id, usuario_id),
  KEY idx_usuarios_roles_asignador (asignado_por),
  CONSTRAINT fk_usuarios_roles_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_usuarios_roles_rol FOREIGN KEY (rol_id) REFERENCES roles (id),
  CONSTRAINT fk_usuarios_roles_asignador FOREIGN KEY (asignado_por) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS perfiles_academicos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  escuela VARCHAR(150) NULL,
  facultad VARCHAR(150) NULL,
  estado_academico VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
  periodo_academico VARCHAR(20) NULL,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_perfiles_academicos_usuario (usuario_id),
  KEY idx_perfiles_estado (estado_academico),
  CONSTRAINT fk_perfiles_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT chk_perfiles_estado CHECK (
    estado_academico IN ('PENDIENTE', 'REGULAR', 'IRREGULAR', 'EGRESADO', 'NO_APLICA')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS dispositivos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  identificador_hash CHAR(64) NOT NULL,
  plataforma VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  visto_por_ultima_vez_en DATETIME(3) NULL,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_dispositivos_identificador (identificador_hash),
  KEY idx_dispositivos_usuario_estado (usuario_id, estado),
  CONSTRAINT fk_dispositivos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT chk_dispositivos_plataforma CHECK (plataforma IN ('ANDROID', 'IOS', 'WEB', 'OTRA')),
  CONSTRAINT chk_dispositivos_estado CHECK (estado IN ('ACTIVO', 'REVOCADO', 'BLOQUEADO'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS sesiones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  dispositivo_id BIGINT UNSIGNED NULL,
  token_acceso_hash CHAR(64) NOT NULL,
  token_renovacion_hash CHAR(64) NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
  direccion_ip VARCHAR(45) NULL,
  agente_usuario VARCHAR(512) NULL,
  creada_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expira_en DATETIME(3) NOT NULL,
  revocada_en DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sesiones_token_acceso (token_acceso_hash),
  UNIQUE KEY uk_sesiones_token_renovacion (token_renovacion_hash),
  KEY idx_sesiones_usuario_estado (usuario_id, estado, expira_en),
  KEY idx_sesiones_dispositivo (dispositivo_id),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_sesiones_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT chk_sesiones_estado CHECK (estado IN ('ACTIVA', 'EXPIRADA', 'REVOCADA')),
  CONSTRAINT chk_sesiones_expiracion CHECK (expira_en > creada_en),
  CONSTRAINT chk_sesiones_revocacion CHECK (
    (estado = 'REVOCADA' AND revocada_en IS NOT NULL) OR estado <> 'REVOCADA'
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS puntos_acceso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  descripcion VARCHAR(500) NULL,
  latitud DECIMAL(10,7) NOT NULL,
  longitud DECIMAL(10,7) NOT NULL,
  radio_permitido_metros DECIMAL(8,2) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_puntos_acceso_codigo (codigo),
  KEY idx_puntos_acceso_estado (estado),
  CONSTRAINT chk_puntos_latitud CHECK (latitud BETWEEN -90 AND 90),
  CONSTRAINT chk_puntos_longitud CHECK (longitud BETWEEN -180 AND 180),
  CONSTRAINT chk_puntos_radio CHECK (radio_permitido_metros > 0),
  CONSTRAINT chk_puntos_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS credenciales_acceso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  sesion_id BIGINT UNSIGNED NOT NULL,
  dispositivo_id BIGINT UNSIGNED NULL,
  punto_acceso_id BIGINT UNSIGNED NULL,
  token_hash CHAR(64) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  nonce_hash CHAR(64) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  emitida_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expira_en DATETIME(3) NOT NULL,
  usada_en DATETIME(3) NULL,
  revocada_en DATETIME(3) NULL,
  latitud_emision DECIMAL(10,7) NULL,
  longitud_emision DECIMAL(10,7) NULL,
  precision_metros DECIMAL(8,2) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_credenciales_token (token_hash),
  UNIQUE KEY uk_credenciales_otp (otp_hash),
  UNIQUE KEY uk_credenciales_nonce (nonce_hash),
  KEY idx_credenciales_usuario_estado (usuario_id, estado, expira_en),
  KEY idx_credenciales_sesion (sesion_id),
  KEY idx_credenciales_dispositivo (dispositivo_id),
  KEY idx_credenciales_punto (punto_acceso_id),
  CONSTRAINT fk_credenciales_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_credenciales_sesion FOREIGN KEY (sesion_id) REFERENCES sesiones (id),
  CONSTRAINT fk_credenciales_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT fk_credenciales_punto FOREIGN KEY (punto_acceso_id) REFERENCES puntos_acceso (id),
  CONSTRAINT chk_credenciales_estado CHECK (
    estado IN ('PENDIENTE', 'USADA', 'EXPIRADA', 'REVOCADA')
  ),
  CONSTRAINT chk_credenciales_expiracion CHECK (expira_en > emitida_en),
  CONSTRAINT chk_credenciales_latitud CHECK (latitud_emision IS NULL OR latitud_emision BETWEEN -90 AND 90),
  CONSTRAINT chk_credenciales_longitud CHECK (longitud_emision IS NULL OR longitud_emision BETWEEN -180 AND 180),
  CONSTRAINT chk_credenciales_precision CHECK (precision_metros IS NULL OR precision_metros >= 0),
  CONSTRAINT chk_credenciales_uso CHECK (
    (estado = 'USADA' AND usada_en IS NOT NULL) OR estado <> 'USADA'
  ),
  CONSTRAINT chk_credenciales_revocacion CHECK (
    (estado = 'REVOCADA' AND revocada_en IS NOT NULL) OR estado <> 'REVOCADA'
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS registros_acceso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  credencial_id BIGINT UNSIGNED NULL,
  punto_acceso_id BIGINT UNSIGNED NOT NULL,
  usuario_seguridad_id BIGINT UNSIGNED NOT NULL,
  huella_token CHAR(64) NULL,
  resultado VARCHAR(20) NOT NULL,
  motivo VARCHAR(80) NOT NULL,
  detalle JSON NULL,
  latitud_escaneo DECIMAL(10,7) NULL,
  longitud_escaneo DECIMAL(10,7) NULL,
  registrado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_registros_usuario_fecha (usuario_id, registrado_en),
  KEY idx_registros_resultado_fecha (resultado, registrado_en),
  KEY idx_registros_punto_fecha (punto_acceso_id, registrado_en),
  KEY idx_registros_seguridad_fecha (usuario_seguridad_id, registrado_en),
  KEY idx_registros_credencial (credencial_id),
  KEY idx_registros_huella (huella_token),
  CONSTRAINT fk_registros_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_registros_credencial FOREIGN KEY (credencial_id) REFERENCES credenciales_acceso (id),
  CONSTRAINT fk_registros_punto FOREIGN KEY (punto_acceso_id) REFERENCES puntos_acceso (id),
  CONSTRAINT fk_registros_seguridad FOREIGN KEY (usuario_seguridad_id) REFERENCES usuarios (id),
  CONSTRAINT chk_registros_resultado CHECK (resultado IN ('AUTORIZADO', 'DENEGADO')),
  CONSTRAINT chk_registros_latitud CHECK (latitud_escaneo IS NULL OR latitud_escaneo BETWEEN -90 AND 90),
  CONSTRAINT chk_registros_longitud CHECK (longitud_escaneo IS NULL OR longitud_escaneo BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS registros_auditoria (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_actor_id BIGINT UNSIGNED NULL,
  accion VARCHAR(80) NOT NULL,
  entidad VARCHAR(80) NOT NULL,
  entidad_id VARCHAR(100) NULL,
  detalle JSON NULL,
  direccion_ip VARCHAR(45) NULL,
  registrado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_auditoria_actor_fecha (usuario_actor_id, registrado_en),
  KEY idx_auditoria_entidad_fecha (entidad, entidad_id, registrado_en),
  KEY idx_auditoria_accion_fecha (accion, registrado_en),
  CONSTRAINT fk_auditoria_actor FOREIGN KEY (usuario_actor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS configuraciones_sistema (
  clave VARCHAR(80) NOT NULL,
  valor VARCHAR(1000) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  descripcion VARCHAR(500) NOT NULL,
  es_secreta BOOLEAN NOT NULL DEFAULT FALSE,
  actualizado_por BIGINT UNSIGNED NULL,
  actualizado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (clave),
  KEY idx_configuraciones_actualizador (actualizado_por),
  CONSTRAINT fk_configuraciones_actualizador FOREIGN KEY (actualizado_por) REFERENCES usuarios (id),
  CONSTRAINT chk_configuraciones_tipo CHECK (tipo IN ('ENTERO', 'DECIMAL', 'BOOLEANO', 'TEXTO', 'JSON')),
  CONSTRAINT chk_configuraciones_clave CHECK (clave = UPPER(clave))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
