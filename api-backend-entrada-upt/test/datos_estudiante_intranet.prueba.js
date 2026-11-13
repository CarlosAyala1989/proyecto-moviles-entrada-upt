import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { it } from 'node:test';
import request from 'supertest';
import { crearAplicacion } from '../src/app.js';
import { grupoConexiones } from '../src/config/database.js';
import { ServicioIntranetUpt } from '../src/modulos/registro_estudiante/servicios/intranet_upt.servicio.js';

const rutaApi = '/api/registro-estudiante/intranet';
const codigoEstudiante = '1111222233';
const paginaAcceso = `
  <form method="post" action="/login.php">
    <input id="t1" name="codigo">
    <input id="clave" name="contrasena" type="hidden">
    <button type="button" class="btn_cuerpo_login_number"
      onclick="document.querySelector('#clave').value += '1'">1</button>
    <input id="kamousagi" name="captcha">
    <img src="imagen.php" width="100" height="40">
    <button id="Submit">Entrar</button>
  </form>`;

const menuPrincipal = `
  <nav id="menu-block">
    <a href="/inicio.php">Inicio</a>
    <a href="/pasarela.php?sesion=privada">PASARELA</a>
    <a href="/reporte_comprobantesElectronicos.php?token=privado">Comprobantes Electrónicos</a>
    <a href="https://ejemplo.invalid/alumno.php?im=99&amp;token=privado">Otro portal</a>
    ${'<span></span>'.repeat(12)}
    <a href="/alumno.php">Alumno</a>
  </nav>`;
const perfil = `
  <h1>APELLIDO PRUEBA, NOMBRE PRUEBA</h1><h1>${codigoEstudiante}</h1>
  <a href="/inicio.php">Inicio</a>
  <a href="?ir=1&amp;sesion=privada">Ingeniería de Sistemas</a>
  <a href="?tx=1">Cursos extracurriculares (TAEX)</a>
  <a href="?im=1">2025-I</a><a href="?im=1&amp;token=duplicado">2025-I</a>
  <a href="?im=2">2025-II</a><a href="?im=3">2026-I</a>
  <a href="?miscursos=1">Notas</a>
  <a href="?mihorario=1">Horario</a>
  <a href="?asistencias=1">Asistencia</a>
  <a href="https://ejemplo.invalid/alumno.php?im=99">Otro período</a>`;

function tabla(columnas, ...filas) {
  return `<table><tr>${columnas.map((celda) => `<th>${celda}</th>`).join('')}</tr>
    ${filas.map((fila) => `<tr>${fila.map((celda) => `<td>${celda}</td>`).join('')}</tr>`).join('')}
    </table>`;
}

const pagos = tabla(
  ['Nro', 'Descripción', 'Monto', 'Vence', 'Dependencia', 'Semestre'],
  ['1', 'Cuarta cuota', '200.50', '30/11/2026', 'Escuela de prueba', '2026-II'],
  ['Total S/.', '200.50', ''],
).replace(/<(\/?)th>/gu, '<$1td>');
const notas = `
  <div class="accordion"><h3>Matemática de prueba</h3><div><table class="lista">
    <thead><tr><th>Unidad</th><th>Criterio</th><th>Peso C.</th><th>Peso U.</th><th>Nota</th></tr></thead>
    <tbody><tr><td>Unidad I</td><td></td><td></td><td>50 %</td><td></td></tr>
    <tr><td></td><td>Examen</td><td>100 %</td><td></td><td>17</td></tr></tbody>
    <tfoot><tr><td>Promedio</td><td>17</td></tr></tfoot>
  </table></div></div>`;

it('consulta datos académicos y de pagos con el mismo acceso de intranet', async () => {
  const solicitudes = [];
  const intranet = createServer(async (solicitud, respuesta) => {
    const url = new URL(solicitud.url, 'http://localhost');
    solicitudes.push([solicitud.method, url.pathname, url.searchParams.keys().next().value]);
    respuesta.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (url.pathname === '/index2.php') return respuesta.end(paginaAcceso);
    if (url.pathname === '/imagen.php') {
      respuesta.setHeader('Content-Type', 'image/svg+xml');
      return respuesta.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"/>');
    }
    if (url.pathname === '/login.php') {
      let cuerpo = '';
      for await (const fragmento of solicitud) cuerpo += fragmento;
      const datos = new URLSearchParams(cuerpo);
      if (datos.get('codigo') !== codigoEstudiante
        || datos.get('contrasena') !== '1' || datos.get('captcha') !== '1234') {
        respuesta.statusCode = 401;
        return respuesta.end(paginaAcceso);
      }
      respuesta.setHeader('Set-Cookie', 'sesion=privada; Path=/; HttpOnly');
      respuesta.writeHead(302, { Location: '/inicio.php' });
      return respuesta.end();
    }
    if (solicitud.headers.cookie !== 'sesion=privada') {
      respuesta.writeHead(302, { Location: '/index2.php' });
      return respuesta.end();
    }

    switch (url.pathname) {
      case '/inicio.php':
        return respuesta.end(`${menuPrincipal}<h2>INFORMACIÓN ECONÓMICA</h2>
          <table><tr><td>${pagos}</td></tr></table>
          <b>Deuda Libro:</b><p>No tiene deuda de libro</p>
          <p>ÚLTIMOS ACCESOS 192.0.2.20</p>`);
      case '/pasarela.php':
        respuesta.writeHead(302, { Location: '/pasarela/weblogin/login.php?token=privado' });
        return respuesta.end();
      case '/reporte_comprobantesElectronicos.php':
        return respuesta.end(tabla(['Comprobante', 'Monto'], ['B001-1', '200.50']));
      case '/alumno.php':
        if (url.searchParams.has('miscursos')) {
          return respuesta.end(`${notas}<script>fetch('/no-ejecutar', { method: 'POST' })</script>`);
        }
        if (url.searchParams.has('ir')) return respuesta.end(tabla(['Curso', 'Nota'], ['Matemática', '17']));
        if (url.searchParams.has('mihorario')) return respuesta.end(tabla(['Curso', 'Lunes'], ['Matemática', '08:00']));
        if (url.searchParams.has('asistencias')) return respuesta.end(tabla(['Fecha', '05/11/2026'], ['Estado', 'Asistió']));
        if (url.searchParams.has('tx')) return respuesta.end(tabla(['Curso'], ['Teatro']));
        if (url.searchParams.get('im') === '1') return respuesta.end(tabla(['Curso'], ['Lenguaje']));
        if (url.searchParams.get('im') === '2') {
          respuesta.statusCode = 503;
          return respuesta.end('Error remoto con detalle privado');
        }
        if (url.searchParams.get('im') === '3') {
          respuesta.writeHead(302, { Location: '/no-ejecutar?token=privado' });
          return respuesta.end();
        }
        return respuesta.end(perfil);
      default:
        respuesta.statusCode = 404;
        return respuesta.end('No encontrada');
    }
  });
  await new Promise((resolver) => intranet.listen(0, '127.0.0.1', resolver));
  const servicioIntranet = new ServicioIntranetUpt({
    urlLogin: `http://127.0.0.1:${intranet.address().port}/index2.php`,
  });
  try {
    const api = request(crearAplicacion({ entornoEjecucion: 'test', servicioIntranet }));
    const captcha = await api.get(`${rutaApi}/captcha`).expect(200);
    const credenciales = {
      transaccion_id: captcha.body.datos.transaccion_id,
      codigo: codigoEstudiante,
      contrasena: '1',
      captcha: '1234',
    };
    await api.post(`${rutaApi}/verificar`)
      .send({ ...credenciales, incluir_datos_estudiante: 'true' })
      .expect(400);
    const respuesta = await api.post(`${rutaApi}/verificar`)
      .send({ ...credenciales, incluir_datos_estudiante: true })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    const datos = respuesta.body.datos.datos_estudiante;
    assert.equal(datos.estado, 'parcial');
    assert.equal(datos.cursos_actuales.tablas[0].registros[0].Nota, '17');
    assert.deepEqual(datos.notas_actuales.cursos_con_notas[0].unidades[0], {
      unidad: 'Unidad I',
      peso_unidad: '50 %',
      evaluaciones: [{ Unidad: '', Criterio: 'Examen', 'Peso C.': '100 %', 'Peso U.': '', Nota: '17' }],
      resumen_final: ['Promedio', '17'],
    });
    assert.deepEqual(datos.periodos_anteriores.map(({ periodo, estado, codigo }) => [periodo, estado, codigo]), [
      ['2025-I', 'leida', undefined],
      ['2025-II', 'error', 'PAGINA_INTRANET_NO_DISPONIBLE'],
      ['2026-I', 'error', 'DESTINO_INTRANET_INESPERADO'],
    ]);
    assert.equal(datos.horario.tablas[0].registros[0].Lunes, '08:00');
    assert.equal(datos.asistencia.tablas[0].registros[0]['05/11/2026'], 'Asistió');
    assert.equal(datos.cursos_extracurriculares.tablas[0].registros[0].Curso, 'Teatro');
    assert.equal(datos.economia_inicio.obligaciones[0].Descripción, 'Cuarta cuota');
    assert.equal(datos.economia_inicio.obligaciones[0].Vence, '30/11/2026');
    assert.equal(datos.economia_inicio.total, '200.50');
    assert.equal(datos.economia_inicio.deuda_biblioteca, 'No tiene deuda de libro');
    assert.equal(datos.comprobantes_electronicos.tablas[0].registros[0].Comprobante, 'B001-1');
    assert.equal(datos.pasarela.estado, 'requiere_autenticacion');
    assert.doesNotMatch(JSON.stringify(datos), /sesion=|token=|192\.0\.2\.20|detalle privado|no-ejecutar/u);
    assert.equal(solicitudes.filter(([metodo]) => metodo === 'POST').length, 1);
    assert.equal(solicitudes.filter(([, ruta, parametro]) => ruta === '/alumno.php' && parametro === 'im').length, 3);
    assert.ok(!solicitudes.some(([, ruta]) => ['/no-ejecutar', '/pasarela/weblogin/login.php'].includes(ruta)));
    assert.deepEqual(await servicioIntranet.obtenerVerificacion(respuesta.body.datos.verificacion_intranet_id), {
      codigo: codigoEstudiante,
      nombre_apellidos: 'APELLIDO PRUEBA, NOMBRE PRUEBA',
      escuela_profesional: 'Ingeniería de Sistemas',
    });
    await api.post(`${rutaApi}/verificar`)
      .send({ ...credenciales, incluir_datos_estudiante: true })
      .expect(410);
  } finally {
    await servicioIntranet.cerrar();
    await new Promise((resolver) => intranet.close(resolver));
    await grupoConexiones.end();
  }
});
