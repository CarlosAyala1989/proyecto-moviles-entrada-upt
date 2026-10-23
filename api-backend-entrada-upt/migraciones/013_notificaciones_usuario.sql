-- Bandeja personal US-20/US-21. Cambio aditivo para despliegues graduales.
CREATE TABLE IF NOT EXISTS notificaciones_usuario (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  registro_acceso_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  evento VARCHAR(80) NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  mensaje VARCHAR(500) NOT NULL,
  causa_general VARCHAR(250) NOT NULL,
  canal_soporte VARCHAR(500) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'NO_LEIDA',
  creada_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  leida_en DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_notificaciones_registro_tipo (registro_acceso_id, tipo),
  KEY idx_notificaciones_usuario_fecha (usuario_id, creada_en, id),
  KEY idx_notificaciones_usuario_estado_tipo (usuario_id, estado, tipo),
  CONSTRAINT fk_notificaciones_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_notificaciones_registro FOREIGN KEY (registro_acceso_id)
    REFERENCES registros_acceso (id) ON DELETE CASCADE,
  CONSTRAINT chk_notificaciones_tipo CHECK (tipo IN ('DENEGACION_ACCESO', 'INTENTO_SOSPECHOSO')),
  CONSTRAINT chk_notificaciones_estado CHECK (
    (estado = 'NO_LEIDA' AND leida_en IS NULL)
    OR (estado = 'LEIDA' AND leida_en IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
