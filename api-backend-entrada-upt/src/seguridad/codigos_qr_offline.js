import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const duracionPasoOfflineSegundos = 15;
const patronV2 = /^upt_offline_v2\.([1-9]\d{0,18})\.([1-9]\d{0,12})\.(\d{6})\.([A-Za-z0-9_-]{43})$/;
const patronV1 = /^upt_offline_v1\.([1-9]\d{0,18})\.([1-9]\d{0,12})\.([A-Za-z0-9_-]{43})$/;

function resumenPasoOffline(secreto, dispositivoId, pasoTiempo, version) {
  return createHmac('sha256', secreto)
    .update(`upt_offline_${version}.${dispositivoId}.${pasoTiempo}`)
    .digest();
}

function otpDesdeResumen(resumen) {
  const desplazamiento = resumen.at(-1) & 0x0f;
  const valor = (
    ((resumen[desplazamiento] & 0x7f) << 24)
    | ((resumen[desplazamiento + 1] & 0xff) << 16)
    | ((resumen[desplazamiento + 2] & 0xff) << 8)
    | (resumen[desplazamiento + 3] & 0xff)
  ) >>> 0;
  return String(valor % 1_000_000).padStart(6, '0');
}

export function interpretarCodigoOffline(valor) {
  if (typeof valor !== 'string') return null;
  const coincidenciaV2 = patronV2.exec(valor);
  const coincidenciaV1 = coincidenciaV2 ? null : patronV1.exec(valor);
  const coincidencia = coincidenciaV2 ?? coincidenciaV1;
  if (!coincidencia) return null;
  const dispositivoId = Number(coincidencia[1]);
  const pasoTiempo = Number(coincidencia[2]);
  if (!Number.isSafeInteger(dispositivoId) || !Number.isSafeInteger(pasoTiempo)) return null;
  return coincidenciaV2
    ? { version: 'v2', dispositivoId, pasoTiempo, otp: coincidencia[3], firma: coincidencia[4] }
    : { version: 'v1', dispositivoId, pasoTiempo, otp: null, firma: coincidencia[3] };
}

export function firmarPasoOffline(secreto, dispositivoId, pasoTiempo, version = 'v2') {
  return resumenPasoOffline(secreto, dispositivoId, pasoTiempo, version).toString('base64url');
}

export function calcularOtpOffline(secreto, dispositivoId, pasoTiempo) {
  return otpDesdeResumen(resumenPasoOffline(secreto, dispositivoId, pasoTiempo, 'v2'));
}

export function verificarFirmaOffline(codigo, secreto) {
  const recibida = Buffer.from(codigo.firma, 'ascii');
  const esperada = Buffer.from(
    firmarPasoOffline(secreto, codigo.dispositivoId, codigo.pasoTiempo, codigo.version),
    'ascii',
  );
  const firmaValida = recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
  if (codigo.version === 'v1') return firmaValida;
  const otpRecibido = Buffer.from(codigo.otp, 'ascii');
  const otpEsperado = Buffer.from(
    calcularOtpOffline(secreto, codigo.dispositivoId, codigo.pasoTiempo),
    'ascii',
  );
  return firmaValida
    && otpRecibido.length === otpEsperado.length
    && timingSafeEqual(otpRecibido, otpEsperado);
}

function claveCifrado() {
  const valor = process.env.CLAVE_QR_OFFLINE;
  if (!valor || !/^[A-Za-z0-9_-]{43}$/.test(valor)) {
    throw new Error('CLAVE_QR_OFFLINE debe contener 32 bytes codificados en base64url.');
  }
  return createHash('sha256').update(valor).digest();
}

export function cifrarSecretoOffline(secreto) {
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', claveCifrado(), iv);
  const cifrado = Buffer.concat([cifrador.update(secreto), cifrador.final()]);
  return `${iv.toString('base64url')}.${cifrado.toString('base64url')}.${cifrador.getAuthTag().toString('base64url')}`;
}

export function descifrarSecretoOffline(valor) {
  const [iv, cifrado, etiqueta] = valor.split('.').map((parte) => Buffer.from(parte, 'base64url'));
  const descifrador = createDecipheriv('aes-256-gcm', claveCifrado(), iv);
  descifrador.setAuthTag(etiqueta);
  return Buffer.concat([descifrador.update(cifrado), descifrador.final()]);
}

export function generarSecretoOffline() { return randomBytes(32); }
