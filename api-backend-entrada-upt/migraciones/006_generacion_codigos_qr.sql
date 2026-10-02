ALTER TABLE credenciales_acceso
  ADD COLUMN ubicacion_obtenida_en DATETIME(3) NULL AFTER precision_metros,
  ADD COLUMN distancia_punto_acceso_metros DECIMAL(10,2) NULL
    AFTER ubicacion_obtenida_en,
  ADD COLUMN motivo_revocacion VARCHAR(80) NULL AFTER revocada_en,
  ADD CONSTRAINT chk_credenciales_distancia CHECK (
    distancia_punto_acceso_metros IS NULL
    OR distancia_punto_acceso_metros >= 0
  );

INSERT INTO configuraciones_sistema (clave, valor, tipo, descripcion) VALUES
  (
    'ANTIGUEDAD_MAXIMA_UBICACION_SEGUNDOS',
    '30',
    'ENTERO',
    'Antigüedad máxima provisional de la ubicación enviada por el cliente.'
  ),
  (
    'DESFASE_FUTURO_UBICACION_SEGUNDOS',
    '10',
    'ENTERO',
    'Tolerancia provisional para diferencias del reloj del dispositivo.'
  ),
  (
    'PRECISION_MAXIMA_UBICACION_METROS',
    '100',
    'DECIMAL',
    'Precisión máxima provisional; la ubicación declarada no prueba presencia física.'
  )
ON DUPLICATE KEY UPDATE
  valor = VALUES(valor),
  tipo = VALUES(tipo),
  descripcion = VALUES(descripcion);
