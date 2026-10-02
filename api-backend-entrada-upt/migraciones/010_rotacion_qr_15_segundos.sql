UPDATE configuraciones_sistema
SET valor = '15',
    descripcion = 'Credencial QR opaca de un solo uso, renovada cada 15 segundos.'
WHERE clave = 'DURACION_QR_SEGUNDOS';

UPDATE puntos_acceso
SET latitud = -18.013,
    longitud = -70.251,
    descripcion = 'Coordenadas simuladas exclusivas para el desarrollo local.'
WHERE codigo = 'PRUEBA-LOCAL'
  AND latitud = 0
  AND longitud = 0;
