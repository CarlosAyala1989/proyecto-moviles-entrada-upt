const patronCorreoInstitucional = /^[a-z]+(\d{10})@virtual\.upt\.pe$/i;

function textoSeguro(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function firmaNombre(valor) {
  const tokens = textoSeguro(valor)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/u)
    .filter(Boolean)
    .sort();

  return tokens.join(' ');
}

/**
 * Obtiene el código de un correo institucional UPT. El prefijo alfabético se
 * deriva del nombre del estudiante, por lo que no se fija a "ca". Esta función
 * únicamente interpreta el identificador; la validación del token de Google
 * debe ocurrir antes de invocarla.
 */
export function extraerCodigoCorreoInstitucional(correo) {
  const coincidencia = textoSeguro(correo).match(patronCorreoInstitucional);
  return coincidencia?.[1] ?? null;
}

/**
 * Convierte el formato de la intranet "APELLIDOS, NOMBRES" al que usa usuarios.
 */
export function separarNombreIntranet(nombreApellidos) {
  const [apellidos, nombres, ...resto] = textoSeguro(nombreApellidos)
    .split(',')
    .map((parte) => parte.trim());

  if (!apellidos || !nombres || resto.length > 0) return null;

  return {
    apellidos,
    nombres,
    nombreCompleto: `${nombres} ${apellidos}`,
  };
}

/**
 * Compara todos los tokens del nombre sin depender de mayúsculas, tildes o del
 * orden apellido/nombre. No es una verificación del proveedor de identidad.
 */
export function coincidenNombres(nombreGoogle, nombreIntranet) {
  const firmaGoogle = firmaNombre(nombreGoogle);
  const firmaIntranet = firmaNombre(nombreIntranet);
  return Boolean(firmaGoogle) && firmaGoogle === firmaIntranet;
}

/**
 * Concilia los datos ya autenticados de Google y de la intranet. Quien llama a
 * esta función debe haber validado previamente el ID token de Google y la
 * respuesta firmada u oficial de la intranet en el servidor.
 */
export function conciliarIdentidadEstudiante({
  correoGoogle,
  nombreGoogle,
  codigoIntranet,
  nombreApellidosIntranet,
}) {
  const codigoGoogle = extraerCodigoCorreoInstitucional(correoGoogle);
  if (!codigoGoogle) {
    return { valida: false, motivo: 'CORREO_INSTITUCIONAL_INVALIDO' };
  }

  const codigoIntranetNormalizado = textoSeguro(codigoIntranet);
  if (!/^\d{10}$/.test(codigoIntranetNormalizado)) {
    return { valida: false, motivo: 'CODIGO_INTRANET_INVALIDO' };
  }

  if (codigoGoogle !== codigoIntranetNormalizado) {
    return { valida: false, motivo: 'CODIGOS_NO_COINCIDEN' };
  }

  const nombreIntranet = separarNombreIntranet(nombreApellidosIntranet);
  if (!nombreIntranet) {
    return { valida: false, motivo: 'NOMBRE_INTRANET_INVALIDO' };
  }

  if (!coincidenNombres(nombreGoogle, nombreIntranet.nombreCompleto)) {
    return { valida: false, motivo: 'NOMBRES_NO_COINCIDEN' };
  }

  return {
    valida: true,
    codigo: codigoGoogle,
    correoInstitucional: textoSeguro(correoGoogle).toLowerCase(),
    nombres: nombreIntranet.nombres,
    apellidos: nombreIntranet.apellidos,
    nombreGoogle: textoSeguro(nombreGoogle),
    nombreIntranet: textoSeguro(nombreApellidosIntranet),
  };
}
