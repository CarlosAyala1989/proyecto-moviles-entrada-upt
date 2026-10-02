CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  archivo VARCHAR(255) NOT NULL,
  aplicada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_migraciones_aplicadas_archivo (archivo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
