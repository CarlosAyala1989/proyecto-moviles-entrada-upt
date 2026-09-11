ALTER TABLE usuarios
  ADD COLUMN intentos_fallidos_inicio_sesion SMALLINT UNSIGNED NOT NULL DEFAULT 0
    AFTER ultimo_acceso_en,
  ADD COLUMN bloqueado_hasta DATETIME(3) NULL
    AFTER intentos_fallidos_inicio_sesion,
  ADD KEY idx_usuarios_bloqueo_temporal (bloqueado_hasta);

ALTER TABLE sesiones
  ADD COLUMN token_renovacion_expira_en DATETIME(3) NULL AFTER expira_en,
  ADD COLUMN motivo_revocacion VARCHAR(80) NULL AFTER revocada_en,
  ADD KEY idx_sesiones_renovacion_estado
    (token_renovacion_hash, estado, token_renovacion_expira_en),
  ADD CONSTRAINT chk_sesiones_renovacion_expiracion CHECK (
    token_renovacion_expira_en IS NULL OR token_renovacion_expira_en > expira_en
  );

CREATE TABLE IF NOT EXISTS intentos_inicio_sesion (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  identificador_hash CHAR(64) NOT NULL,
  exitoso BOOLEAN NOT NULL,
  motivo VARCHAR(80) NOT NULL,
  direccion_ip VARCHAR(45) NULL,
  agente_usuario VARCHAR(512) NULL,
  registrado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_intentos_identificador_fecha (identificador_hash, registrado_en),
  KEY idx_intentos_usuario_fecha (usuario_id, registrado_en),
  CONSTRAINT fk_intentos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
