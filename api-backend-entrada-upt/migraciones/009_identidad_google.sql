ALTER TABLE usuarios
  ADD COLUMN google_sub VARCHAR(255) NULL AFTER correo_institucional,
  ADD UNIQUE KEY uk_usuarios_google_sub (google_sub);
