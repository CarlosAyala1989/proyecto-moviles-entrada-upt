-- Solicitudes breves y compartidas por todas las réplicas de la API.
-- No se guardan tokens Google ni contraseñas. El usuario se desvincula al borrar.
CREATE TABLE solicitudes_eliminacion_cuenta (
  id CHAR(36) NOT NULL PRIMARY KEY,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  estado_oauth_hash CHAR(64) NULL,
  nonce_hash CHAR(64) NULL,
  verificador_pkce VARCHAR(128) NULL,
  navegador_hash CHAR(64) NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  error_codigo VARCHAR(60) NULL,
  creada_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expira_en DATETIME(3) NOT NULL,
  completada_en DATETIME(3) NULL,
  UNIQUE KEY uk_eliminacion_estado_oauth (estado_oauth_hash),
  KEY idx_eliminacion_expiracion (expira_en),
  KEY idx_eliminacion_usuario (usuario_id),
  CONSTRAINT fk_eliminacion_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_eliminacion_estado CHECK (
    estado IN ('PENDIENTE', 'PROCESANDO', 'LISTA', 'COMPLETADA', 'ERROR')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
