-- Restricción institucional separada de la cuenta, autorizada por el responsable
-- durante un máximo de 30 días. No guarda código, Google sub, nombre o correo.
CREATE TABLE restricciones_identidad_eliminada (
  identidad_hash CHAR(64) NOT NULL PRIMARY KEY,
  clave_firma CHAR(64) NOT NULL,
  expira_en DATETIME(3) NOT NULL,
  KEY idx_restricciones_eliminadas_expiracion (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
