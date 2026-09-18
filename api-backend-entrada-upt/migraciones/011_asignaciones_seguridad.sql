CREATE TABLE IF NOT EXISTS asignaciones_seguridad (
  usuario_id BIGINT UNSIGNED NOT NULL,
  punto_acceso_id BIGINT UNSIGNED NOT NULL,
  asignado_por BIGINT UNSIGNED NOT NULL,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (usuario_id),
  KEY idx_asignaciones_punto (punto_acceso_id),
  CONSTRAINT fk_asignaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_asignaciones_punto FOREIGN KEY (punto_acceso_id) REFERENCES puntos_acceso (id),
  CONSTRAINT fk_asignaciones_actor FOREIGN KEY (asignado_por) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
