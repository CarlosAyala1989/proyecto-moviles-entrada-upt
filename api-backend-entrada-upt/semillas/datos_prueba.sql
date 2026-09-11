INSERT INTO usuarios (
  codigo_institucional,
  correo_institucional,
  nombres,
  apellidos,
  estado,
  estado_autorizacion,
  identidad_verificada,
  identidad_verificada_en
) VALUES
  ('PRUEBA-EST-001', 'estudiante.prueba@example.invalid', 'Estudiante', 'De Prueba', 'ACTIVO', 'AUTORIZADO', TRUE, CURRENT_TIMESTAMP(3)),
  ('PRUEBA-SEG-001', 'seguridad.prueba@example.invalid', 'Seguridad', 'De Prueba', 'ACTIVO', 'AUTORIZADO', TRUE, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  nombres = VALUES(nombres),
  apellidos = VALUES(apellidos),
  estado = VALUES(estado),
  estado_autorizacion = VALUES(estado_autorizacion),
  identidad_verificada = VALUES(identidad_verificada),
  identidad_verificada_en = VALUES(identidad_verificada_en);

INSERT INTO usuarios_roles (usuario_id, rol_id)
SELECT usuarios.id, roles.id
FROM usuarios
JOIN roles ON roles.nombre = 'ESTUDIANTE'
WHERE usuarios.codigo_institucional = 'PRUEBA-EST-001'
ON DUPLICATE KEY UPDATE asignado_en = asignado_en;

INSERT INTO usuarios_roles (usuario_id, rol_id)
SELECT usuarios.id, roles.id
FROM usuarios
JOIN roles ON roles.nombre = 'SEGURIDAD'
WHERE usuarios.codigo_institucional = 'PRUEBA-SEG-001'
ON DUPLICATE KEY UPDATE asignado_en = asignado_en;

INSERT INTO perfiles_academicos (
  usuario_id,
  escuela,
  facultad,
  estado_academico,
  periodo_academico
)
SELECT
  usuarios.id,
  'Escuela de prueba',
  'Facultad de prueba',
  'REGULAR',
  'DESARROLLO'
FROM usuarios
WHERE usuarios.codigo_institucional = 'PRUEBA-EST-001'
ON DUPLICATE KEY UPDATE
  escuela = VALUES(escuela),
  facultad = VALUES(facultad),
  estado_academico = VALUES(estado_academico),
  periodo_academico = VALUES(periodo_academico);

INSERT INTO puntos_acceso (
  codigo,
  nombre,
  descripcion,
  latitud,
  longitud,
  radio_permitido_metros,
  estado
) VALUES (
  'PRUEBA-LOCAL',
  'Punto de acceso de prueba',
  'Coordenadas ficticias exclusivas para pruebas automatizadas.',
  0,
  0,
  150,
  'ACTIVO'
)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  latitud = VALUES(latitud),
  longitud = VALUES(longitud),
  radio_permitido_metros = VALUES(radio_permitido_metros),
  estado = VALUES(estado);
