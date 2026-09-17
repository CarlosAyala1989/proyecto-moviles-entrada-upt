import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  codificarContrasenaIntranet,
  extraerPerfilIntranet,
  extraerPerfilTexto,
  extraerTecladoIntranet,
  ServicioIntranetUpt,
} from '../src/modulos/registro_estudiante/servicios/intranet_upt.servicio.js';

function crearPaginaLogin() {
  return [...Array(10)].map((_, posicion) => (
    `<button onclick="js:setChar('${posicion}');">${9 - posicion}</button>`
  )).join('');
}

describe('Proveedor de intranet UPT', () => {
  it('traduce la contraseña al teclado aleatorio entregado por la intranet', () => {
    const teclado = extraerTecladoIntranet(crearPaginaLogin());
    assert.equal(codificarContrasenaIntranet('123456', teclado), '876543');
  });

  it('obtiene nombre y código desde el encabezado autenticado', () => {
    assert.deepEqual(
      extraerPerfilIntranet('<span>AYALA RAMOS, CARLOS DANIEL</span><span>2022074266</span>'),
      { nombre_apellidos: 'AYALA RAMOS, CARLOS DANIEL', codigo: '2022074266' },
    );
    assert.deepEqual(
      extraerPerfilIntranet(
        '<header><strong>AYALA</strong><span> RAMOS, CARLOS DANIEL</span>' +
          '<small>Código: 2022074266</small></header>',
      ),
      { nombre_apellidos: 'AYALA RAMOS, CARLOS DANIEL', codigo: '2022074266' },
    );
  });

  it('lee un encabezado OCR con nombre y código separados o en distinto orden', () => {
    for (const texto of [
      'AYALA RAMOS, CARLOS DANIEL\nDatos del estudiante\nCódigo: 2022074266',
      'Código: 2022074266\nDatos del estudiante\nAYALA RAMOS, CARLOS DANIEL',
      'Estudiante: AYALA RAMOS, CARLOS DANIEL\nCódigo: 2022074266',
      'AYALA RAMOS, CARLOS DANIEL Código: 2022074266',
    ]) {
      assert.deepEqual(extraerPerfilTexto(texto), {
        nombre_apellidos: 'AYALA RAMOS, CARLOS DANIEL',
        codigo: '2022074266',
      });
    }
  });

  it('no confunde texto del menú con un nombre ni acepta identidades ambiguas', () => {
    for (const texto of [
      'Notas\n2022074266',
      'AYALA RAMOS, CARLOS DANIEL\nCódigo: 2022074266\nCódigo: 2021051033',
      'AYALA RAMOS, CARLOS DANIEL\nCASTILLO FLORES, DIEGO\nCódigo: 2022074266',
      'AYALA RAMOS, CARLOS DANIEL\nSin código disponible',
    ]) {
      assert.equal(extraerPerfilTexto(texto), null);
    }
  });

  it('mantiene el CAPTCHA y el teclado dentro de una transacción de un solo uso', async () => {
    let cierres = 0;
    const servicio = new ServicioIntranetUpt({
      crearSesionFn: async () => ({
        cargarCaptcha: async () => new Uint8Array([1, 2, 3]),
        verificar: async (datos) => {
          assert.deepEqual(datos, {
            codigo: '2022074266',
            contrasena: '123456',
            captcha: '12345',
          });
          return {
            nombre_apellidos: 'AYALA RAMOS, CARLOS DANIEL',
            codigo: '2022074266',
          };
        },
        cerrar: async () => {
          cierres += 1;
        },
      }),
    });

    const captcha = await servicio.obtenerCaptcha();
    assert.equal(captcha.tipo_imagen, 'image/png');
    assert.equal(captcha.imagen_base64, 'AQID');

    const perfil = await servicio.verificarCredenciales({
      transaccionId: captcha.transaccion_id,
      codigo: '2022074266',
      contrasena: '123456',
      captcha: '12345',
    });
    assert.equal(perfil.nombre_apellidos, 'AYALA RAMOS, CARLOS DANIEL');
    assert.equal(perfil.codigo, '2022074266');
    assert.match(perfil.verificacion_intranet_id, /^[0-9a-f-]{36}$/);
    assert.ok(perfil.verificacion_expira_en);
    assert.deepEqual(
      await servicio.obtenerVerificacion(perfil.verificacion_intranet_id),
      {
        nombre_apellidos: 'AYALA RAMOS, CARLOS DANIEL',
        codigo: '2022074266',
      },
    );
    assert.equal(servicio.consumirVerificacion(perfil.verificacion_intranet_id), true);
    assert.equal(cierres, 1);

    await assert.rejects(
      () => servicio.verificarCredenciales({
        transaccionId: captcha.transaccion_id,
        codigo: '2022074266',
        contrasena: '123456',
        captcha: '12345',
      }),
      { codigo: 'CAPTCHA_EXPIRADO' },
    );
  });

  it('rechaza un código devuelto por la intranet distinto al ingresado', async () => {
    const servicio = new ServicioIntranetUpt({
      crearSesionFn: async () => ({
        cargarCaptcha: async () => new Uint8Array([1]),
        verificar: async () => ({
          nombre_apellidos: 'CASTILLO FLORES, DIEGO',
          codigo: '2021051033',
        }),
        cerrar: async () => {},
      }),
    });
    const captcha = await servicio.obtenerCaptcha();
    await assert.rejects(
      () => servicio.verificarCredenciales({
        transaccionId: captcha.transaccion_id,
        codigo: '2022074266',
        contrasena: '123456',
        captcha: '1234',
      }),
      { codigo: 'CODIGO_INTRANET_NO_COINCIDE' },
    );
  });
});
