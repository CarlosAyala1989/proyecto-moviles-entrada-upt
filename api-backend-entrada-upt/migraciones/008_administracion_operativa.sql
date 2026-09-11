ALTER TABLE registros_acceso
  ADD KEY idx_registros_fecha (registrado_en),
  ADD KEY idx_registros_motivo_fecha (motivo, registrado_en);

ALTER TABLE registros_auditoria
  ADD KEY idx_auditoria_fecha (registrado_en);
