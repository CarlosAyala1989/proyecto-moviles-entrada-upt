CREATE TABLE turnos_seguridad (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_seguridad_id BIGINT UNSIGNED NOT NULL,
  punto_acceso_id BIGINT UNSIGNED NOT NULL,
  iniciado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cerrado_en DATETIME(3) NULL,
  KEY idx_turnos_guardia_fecha (usuario_seguridad_id, iniciado_en),
  FOREIGN KEY (usuario_seguridad_id) REFERENCES usuarios(id),
  FOREIGN KEY (punto_acceso_id) REFERENCES puntos_acceso(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE registros_acceso
  ADD COLUMN turno_seguridad_id BIGINT UNSIGNED NULL,
  ADD KEY idx_accesos_turno (turno_seguridad_id, registrado_en),
  ADD CONSTRAINT fk_acceso_turno FOREIGN KEY (turno_seguridad_id) REFERENCES turnos_seguridad(id);

CREATE TABLE incidencias_seguridad (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  registro_acceso_id BIGINT UNSIGNED NOT NULL,
  responsable_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  observacion VARCHAR(1000) NOT NULL,
  clave_idempotencia CHAR(36) NOT NULL,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_incidencia_reintento (responsable_id, clave_idempotencia),
  KEY idx_incidencia_acceso (registro_acceso_id, id),
  FOREIGN KEY (registro_acceso_id) REFERENCES registros_acceso(id),
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bloqueos_identidad (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  creado_por BIGINT UNSIGNED NOT NULL,
  vigente_desde DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  vigente_hasta DATETIME(3) NULL,
  rehabilitado_en DATETIME(3) NULL,
  rehabilitado_por BIGINT UNSIGNED NULL,
  motivo_rehabilitacion VARCHAR(500) NULL,
  KEY idx_bloqueo_vigente (usuario_id, rehabilitado_en, vigente_hasta),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (creado_por) REFERENCES usuarios(id),
  FOREIGN KEY (rehabilitado_por) REFERENCES usuarios(id),
  CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reglas_acceso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  rol VARCHAR(40) NOT NULL,
  estado_usuario VARCHAR(20) NOT NULL,
  accion VARCHAR(10) NOT NULL,
  punto_acceso_id BIGINT UNSIGNED NULL,
  dias_semana JSON NOT NULL,
  hora_inicio CHAR(5) NOT NULL,
  hora_fin CHAR(5) NOT NULL,
  vigente_desde DATETIME(3) NOT NULL,
  vigente_hasta DATETIME(3) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por BIGINT UNSIGNED NOT NULL,
  actualizado_por BIGINT UNSIGNED NOT NULL,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_reglas_vigencia (activo, rol, estado_usuario),
  FOREIGN KEY (punto_acceso_id) REFERENCES puntos_acceso(id),
  FOREIGN KEY (creado_por) REFERENCES usuarios(id),
  FOREIGN KEY (actualizado_por) REFERENCES usuarios(id),
  CHECK (accion IN ('PERMITIR', 'DENEGAR')),
  CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
