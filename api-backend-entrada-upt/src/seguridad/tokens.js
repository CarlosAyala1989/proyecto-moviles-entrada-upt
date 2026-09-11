import { createHash, randomBytes } from 'node:crypto';

export function generarTokenOpaco(tipo) {
  return `upt_${tipo}_${randomBytes(32).toString('base64url')}`;
}

export function calcularHashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function calcularHashIdentificador(identificador) {
  return createHash('sha256')
    .update(identificador.trim().toLowerCase())
    .digest('hex');
}
