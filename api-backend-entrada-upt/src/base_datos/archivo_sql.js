import { readFile } from 'node:fs/promises';

export function separarSentenciasSql(contenido) {
  const contenidoSinComentarios = contenido
    .split(/\r?\n/)
    .filter((linea) => !linea.trimStart().startsWith('--'))
    .join('\n');

  return contenidoSinComentarios
    .split(/;\s*(?:\r?\n|$)/)
    .map((sentencia) => sentencia.trim())
    .filter(Boolean);
}

export async function ejecutarArchivoSql(conexion, rutaArchivo) {
  const contenido = await readFile(rutaArchivo, 'utf8');

  for (const sentencia of separarSentenciasSql(contenido)) {
    await conexion.query(sentencia);
  }
}
