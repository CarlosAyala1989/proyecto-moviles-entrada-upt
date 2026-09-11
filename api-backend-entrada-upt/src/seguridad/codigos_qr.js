import { randomBytes, timingSafeEqual } from 'node:crypto';
import { calcularHashToken } from './tokens.js';

const patronCodigoQr = /^upt_qr_v1\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{22})$/;

export function generarCodigoQrOpaco() {
  const referencia = randomBytes(32).toString('base64url');
  const otp = randomBytes(16).toString('base64url');
  const nonce = randomBytes(16).toString('base64url');
  const codigoQr = `upt_qr_v1.${referencia}.${otp}.${nonce}`;

  return {
    codigoQr,
    tokenHash: calcularHashToken(referencia),
    otpHash: calcularHashToken(otp),
    nonceHash: calcularHashToken(nonce),
  };
}

export function interpretarCodigoQr(codigoQr) {
  const huellaToken = calcularHashToken(codigoQr);
  const coincidencia = codigoQr.match(patronCodigoQr);
  if (!coincidencia) {
    return {
      formatoValido: false,
      huellaToken,
    };
  }

  const [, referencia, otp, nonce] = coincidencia;
  return {
    formatoValido: true,
    huellaToken,
    referenciaHash: calcularHashToken(referencia),
    // Permite validar credenciales emitidas por la versión anterior del backend.
    codigoCompletoHash: huellaToken,
    otpHash: calcularHashToken(otp),
    nonceHash: calcularHashToken(nonce),
  };
}

export function compararHashes(hashEsperado, hashRecibido) {
  if (
    typeof hashEsperado !== 'string'
    || typeof hashRecibido !== 'string'
    || !/^[a-f0-9]{64}$/.test(hashEsperado)
    || !/^[a-f0-9]{64}$/.test(hashRecibido)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(hashEsperado, 'hex'),
    Buffer.from(hashRecibido, 'hex'),
  );
}
