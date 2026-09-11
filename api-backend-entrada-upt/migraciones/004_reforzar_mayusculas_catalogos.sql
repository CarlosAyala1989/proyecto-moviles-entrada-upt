ALTER TABLE roles
  DROP CONSTRAINT chk_roles_nombre,
  ADD CONSTRAINT chk_roles_nombre CHECK (BINARY nombre = BINARY UPPER(nombre));

ALTER TABLE configuraciones_sistema
  DROP CONSTRAINT chk_configuraciones_clave,
  ADD CONSTRAINT chk_configuraciones_clave CHECK (BINARY clave = BINARY UPPER(clave));
