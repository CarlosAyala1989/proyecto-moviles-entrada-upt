-- La intranet acredita código y nombre; no se inventa un correo institucional.
ALTER TABLE usuarios MODIFY correo_institucional VARCHAR(254) NULL;
