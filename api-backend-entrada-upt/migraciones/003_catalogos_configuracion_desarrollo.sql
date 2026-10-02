INSERT INTO roles (nombre, descripcion) VALUES
  ('ESTUDIANTE', 'Usuario estudiante autorizado para consultar su identidad y solicitar credenciales.'),
  ('DOCENTE', 'Usuario docente autorizado para consultar su identidad y solicitar credenciales.'),
  ('TRABAJADOR', 'Trabajador autorizado para consultar su identidad y solicitar credenciales.'),
  ('SEGURIDAD', 'Personal autorizado para validar credenciales de acceso.'),
  ('ADMINISTRADOR', 'Personal autorizado para administrar usuarios y configuración.')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), activo = TRUE;

INSERT INTO configuraciones_sistema (clave, valor, tipo, descripcion) VALUES
  ('DURACION_QR_SEGUNDOS', '15', 'ENTERO', 'Valor provisional de desarrollo; no constituye una regla oficial de la UPT.'),
  ('RADIO_UBICACION_METROS', '150', 'DECIMAL', 'Valor provisional de desarrollo; la ubicación informada por el cliente no prueba presencia física.'),
  ('DURACION_SESION_MINUTOS', '480', 'ENTERO', 'Duración provisional para sesiones locales de desarrollo.'),
  ('MAX_INTENTOS_INICIO_SESION', '5', 'ENTERO', 'Cantidad provisional de intentos fallidos antes de aplicar bloqueo temporal.'),
  ('QR_UN_SOLO_USO', 'true', 'BOOLEANO', 'Define que una credencial aceptada no puede autorizar un segundo ingreso.')
ON DUPLICATE KEY UPDATE
  valor = VALUES(valor),
  tipo = VALUES(tipo),
  descripcion = VALUES(descripcion);
