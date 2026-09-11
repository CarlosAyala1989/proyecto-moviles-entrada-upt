ALTER TABLE registros_acceso
  ADD COLUMN precision_escaneo_metros DECIMAL(8,2) NULL
    AFTER longitud_escaneo,
  ADD COLUMN ubicacion_escaneo_obtenida_en DATETIME(3) NULL
    AFTER precision_escaneo_metros,
  ADD COLUMN distancia_escaneo_metros DECIMAL(10,2) NULL
    AFTER ubicacion_escaneo_obtenida_en,
  ADD CONSTRAINT chk_registros_precision CHECK (
    precision_escaneo_metros IS NULL OR precision_escaneo_metros >= 0
  ),
  ADD CONSTRAINT chk_registros_distancia CHECK (
    distancia_escaneo_metros IS NULL OR distancia_escaneo_metros >= 0
  );
