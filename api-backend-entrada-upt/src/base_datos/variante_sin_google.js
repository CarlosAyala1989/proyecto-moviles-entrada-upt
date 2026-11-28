export async function asegurarAccesoGlobal(grupoConexiones) {
  // Agrupador lógico: estas coordenadas técnicas no se usan para autorizar.
  await grupoConexiones.query(`INSERT INTO puntos_acceso
    (codigo, nombre, descripcion, latitud, longitud, radio_permitido_metros, estado)
    VALUES ('GLOBAL', 'Acceso global', 'Variante sin geocerca; no representa la ubicación del teléfono.', 0, 0, 1, 'ACTIVO')
    ON DUPLICATE KEY UPDATE estado = 'ACTIVO'`);
}
