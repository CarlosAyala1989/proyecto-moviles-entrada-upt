import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calcularOtpOffline,
  firmarPasoOffline,
  interpretarCodigoOffline,
  verificarFirmaOffline,
} from '../src/seguridad/codigos_qr_offline.js';

const secreto = Buffer.alloc(32, 7);
const dispositivoId = 42;
const pasoTiempo = 123456789;

describe('OTP QR offline', () => {
  it('valida juntos el OTP visible y la firma completa del QR v2', () => {
    const otp = calcularOtpOffline(secreto, dispositivoId, pasoTiempo);
    const firma = firmarPasoOffline(secreto, dispositivoId, pasoTiempo);
    const codigo = interpretarCodigoOffline(
      `upt_offline_v2.${dispositivoId}.${pasoTiempo}.${otp}.${firma}`,
    );
    assert.ok(codigo);
    assert.equal(codigo.otp, otp);
    assert.equal(verificarFirmaOffline(codigo, secreto), true);

    const otpAlterado = otp === '000000' ? '000001' : '000000';
    assert.equal(verificarFirmaOffline({ ...codigo, otp: otpAlterado }, secreto), false);
    assert.equal(verificarFirmaOffline({
      ...codigo,
      firma: `${firma.startsWith('A') ? 'B' : 'A'}${firma.slice(1)}`,
    }, secreto), false);
  });

  it('acepta temporalmente QR v1 durante el despliegue gradual', () => {
    const firma = firmarPasoOffline(secreto, dispositivoId, pasoTiempo, 'v1');
    const codigo = interpretarCodigoOffline(
      `upt_offline_v1.${dispositivoId}.${pasoTiempo}.${firma}`,
    );
    assert.ok(codigo);
    assert.equal(codigo.version, 'v1');
    assert.equal(verificarFirmaOffline(codigo, secreto), true);
  });
});
