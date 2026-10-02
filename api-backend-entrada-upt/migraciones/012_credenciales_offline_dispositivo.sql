ALTER TABLE dispositivos
  ADD COLUMN secreto_qr_cifrado VARCHAR(255) NULL AFTER estado,
  ADD COLUMN qr_vinculado_en DATETIME(3) NULL AFTER secreto_qr_cifrado;

CREATE TABLE IF NOT EXISTS usos_codigos_offline (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dispositivo_id BIGINT UNSIGNED NOT NULL,
  paso_tiempo BIGINT UNSIGNED NOT NULL,
  punto_acceso_id BIGINT UNSIGNED NOT NULL,
  usado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_uso_offline_dispositivo_paso (dispositivo_id, paso_tiempo),
  KEY idx_usos_offline_fecha (usado_en),
  CONSTRAINT fk_usos_offline_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT fk_usos_offline_punto FOREIGN KEY (punto_acceso_id) REFERENCES puntos_acceso (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
