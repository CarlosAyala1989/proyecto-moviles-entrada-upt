import { randomBytes } from 'node:crypto';
import { calcularHashToken } from './tokens.js';

export function generarCodigoQrOpaco() {
  const referencia = randomBytes(32).toString('base64url');
  const otp = randomBytes(16).toString('base64url');
  const nonce = randomBytes(16).toString('base64url');
  const codigoQr = `upt_qr_v1.${referencia}.${otp}.${nonce}`;

  return {
    codigoQr,
    tokenHash: calcularHashToken(codigoQr),
    otpHash: calcularHashToken(otp),
    nonceHash: calcularHashToken(nonce),
  };
}
