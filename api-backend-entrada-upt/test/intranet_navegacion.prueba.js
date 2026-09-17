import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { it } from 'node:test';
import { chromium } from 'playwright-core';
import { SesionIntranetNavegador } from '../src/modulos/registro_estudiante/servicios/intranet_upt.servicio.js';

it('espera el redireccionamiento antes de cerrar el aviso y abrir Alumno', async () => {
  const rutas = [];
  const servidor = createServer(async (solicitud, respuesta) => {
    rutas.push(solicitud.url);
    respuesta.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (solicitud.url === '/login') {
      let cuerpo = '';
      for await (const fragmento of solicitud) cuerpo += fragmento;
      const datos = new URLSearchParams(cuerpo);
      if (datos.get('codigo') !== '1111222233'
        || datos.get('contrasena') !== '123456'
        || datos.get('captcha') !== '1234') {
        respuesta.end('<input id="t1">');
        return;
      }
      // La página intermedia tarda más que la antigua espera del aviso.
      respuesta.end('<script>setTimeout(() => location.href = "/inicio", 3200);</script>');
    } else if (solicitud.url === '/inicio') {
      respuesta.end(`
        <div class="mfp-content" style="position:fixed;inset:0;z-index:100;background:white">
          <button onclick="this.parentElement.remove()">Cerrar aviso</button>
        </div>
        <div id="menu-block">
          ${'<a href="#">Otra opción</a>'.repeat(16)}
          <a href="/alumno">Alumno</a>
        </div>
      `);
    } else if (solicitud.url === '/alumno') {
      respuesta.end('<h1>APELLIDO PRUEBA, NOMBRE PRUEBA&nbsp;&nbsp;</h1><h1>1111222233&nbsp;&nbsp;</h1>');
    } else {
      respuesta.end(`
        <form action="/login" method="post">
          <input id="t1" name="codigo">
          <input id="clave" name="contrasena" type="hidden">
          ${Array.from({ length: 10 }, (_, digito) => (
            `<button type="button" class="btn_cuerpo_login_number"
              onclick="document.querySelector('#clave').value += '${digito}'">${digito}</button>`
          )).join('')}
          <input id="kamousagi" name="captcha">
          <button id="Submit">Enviar</button>
        </form>
      `);
    }
  });
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  let navegador;
  try {
    navegador = await chromium.launch({
      executablePath: process.env.CHROME_EXECUTABLE ?? '/usr/bin/google-chrome',
      headless: true,
      args: process.env.CHROME_NO_SANDBOX === 'true' ? ['--no-sandbox'] : [],
    });
    const contexto = await navegador.newContext();
    const pagina = await contexto.newPage();
    const urlLogin = `http://127.0.0.1:${servidor.address().port}/`;
    await pagina.goto(urlLogin);
    const sesion = new SesionIntranetNavegador({ contexto, pagina, urlLogin });
    const perfil = await sesion.verificar({
      codigo: '1111222233',
      contrasena: '123456',
      captcha: '1234',
    });
    assert.deepEqual(perfil, {
      nombre_apellidos: 'APELLIDO PRUEBA, NOMBRE PRUEBA',
      codigo: '1111222233',
    });
    assert.ok(rutas.includes('/alumno'));
  } finally {
    await navegador?.close();
    await new Promise((resolver) => servidor.close(resolver));
  }
});
