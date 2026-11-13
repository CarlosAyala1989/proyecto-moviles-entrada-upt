const rutasAcademicas = new Map([
  ['ir', ['cursos_actuales', 'Cursos / récord académico']],
  ['miscursos', ['notas_actuales', 'Notas del período actual']],
  ['mihorario', ['horario', 'Horario']],
  ['asistencias', ['asistencia', 'Asistencia']],
  ['tx', ['cursos_extracurriculares', 'Cursos extracurriculares (TAEX)']],
  ['im', ['periodos_anteriores', 'Cursos del período']],
]);
const maximoConsultaMs = 45_000;
const maximoPaginaMs = 7_000;
const rutasAcceso = new Set(['/index2.php', '/login.php']);
const rutaAccesoPasarela = '/pasarela/weblogin/login.php';

function normalizar(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function urlPublicable(url) {
  const salida = new URL(url.pathname, url.origin);
  if (url.pathname === '/alumno.php') {
    for (const parametro of rutasAcademicas.keys()) {
      const valor = url.searchParams.get(parametro);
      if (/^\d+$/u.test(valor ?? '')) salida.searchParams.set(parametro, valor);
    }
  }
  return salida.href;
}

function leerEnlacesEnNavegador(raiz) {
  return [...raiz.querySelectorAll('a[href]')].map((enlace) => ({
    seccion: (enlace.textContent ?? '').replace(/\s+/gu, ' ').trim(),
    href: enlace.getAttribute('href'),
  }));
}

function resolverEnlaces(enlaces, base) {
  const vistos = new Set();
  return enlaces.flatMap(({ seccion, href }) => {
    if (!seccion || !href || href.startsWith('#') || !URL.canParse(href, base)) return [];
    const url = new URL(href, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return [];
    const clave = JSON.stringify([seccion, url.href]);
    if (vistos.has(clave)) return [];
    vistos.add(clave);
    return [{ seccion, url }];
  });
}

function publicarEnlaces(enlaces) {
  return enlaces.map(({ seccion, url }) => ({ seccion, url: urlPublicable(url) }));
}

function buscarEnlace(enlaces, origen, ruta, etiqueta) {
  return enlaces.find(({ url, seccion }) => url.origin === origen
    && url.pathname === ruta && normalizar(seccion).includes(etiqueta));
}

function leerPaginaEnNavegador({ seccion, html, rutaAccesoPasarela }) {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  if (seccion === 'pasarela' && (documento.querySelector('input[type="password"], #kamousagi')
    || html.includes(rutaAccesoPasarela))) {
    return { estado: 'requiere_autenticacion' };
  }
  if (documento.querySelector('#t1')) return { estado: 'redirigido_al_acceso' };

  const texto = (elemento) => (elemento?.textContent ?? '').replace(/\s+/gu, ' ').trim();
  const lineas = (elemento) => {
    const copia = elemento.cloneNode(true);
    copia.querySelectorAll('script, style, noscript, template').forEach((nodo) => nodo.remove());
    const recorrido = document.createTreeWalker(copia, NodeFilter.SHOW_TEXT);
    const resultado = [];
    while (recorrido.nextNode()) {
      const linea = texto(recorrido.currentNode);
      if (linea) resultado.push(linea);
    }
    return resultado;
  };
  const celdas = (fila) => [...fila.cells].map(texto);
  const filasPropias = (tabla) => [...tabla.rows].filter((fila) => fila.closest('table') === tabla);
  const cabecera = (filas) => filas.find((fila) => [...fila.cells].some((celda) => celda.tagName === 'TH'));
  const normalizarCabecera = (nombre) => nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const esCabeceraPagos = (cabeceras) => {
    const valores = cabeceras.map(normalizarCabecera);
    return ['monto', 'vence', 'descripcion'].every((nombre) => valores.includes(nombre));
  };
  const registro = (columnas, fila) => Object.fromEntries(
    columnas.slice(0, fila.length).map((columna, indice) => [columna, fila[indice]]),
  );
  const elementosTabla = [...documento.querySelectorAll('table')];
  const tablas = elementosTabla.flatMap((tabla, indice) => {
    const filas = filasPropias(tabla);
    const filaCabecera = seccion === 'economia_inicio'
      ? filas.find((fila) => esCabeceraPagos(celdas(fila))) ?? cabecera(filas)
      : cabecera(filas);
    const cabeceras = filaCabecera ? celdas(filaCabecera) : [];
    const filasDatos = filas
      .filter((fila) => fila !== filaCabecera && !fila.querySelector('table'))
      .map(celdas)
      .filter((fila) => fila.some(Boolean));
    if (!cabeceras.length && !filasDatos.length) return [];
    return [{
      indice: indice + 1,
      titulo: texto(tabla.caption) || null,
      cabeceras,
      filas: filasDatos,
      registros: cabeceras.length ? filasDatos
        .filter((fila) => fila.length === cabeceras.length)
        .map((fila) => registro(cabeceras, fila)) : [],
    }];
  });

  if (seccion === 'economia_inicio') {
    const tablaPagos = tablas.find(({ cabeceras }) => esCabeceraPagos(cabeceras));
    const textoPagina = lineas(documento.body);
    const menu = documento.querySelector('#menu-block') ?? documento;
    const enlaces = [...menu.querySelectorAll('a[href]')].map((enlace) => ({
      seccion: texto(enlace),
      href: enlace.getAttribute('href'),
    }));
    const indiceDeuda = textoPagina.findIndex((linea) => /^deuda\s+(?:de\s+)?libro\b/iu.test(linea));
    const deudaBiblioteca = indiceDeuda < 0 ? null
      : (textoPagina[indiceDeuda].replace(/^deuda\s+(?:de\s+)?libro\s*:?\s*/iu, '')
        || textoPagina[indiceDeuda + 1] || null);
    const esTotal = ([primera]) => /^total\b/iu.test(primera);
    const total = tablaPagos?.filas.find(esTotal);
    return {
      titulo: documento.title,
      texto: tablaPagos ? lineas(elementosTabla[tablaPagos.indice - 1]) : [],
      tablas: tablaPagos ? [tablaPagos] : [],
      obligaciones: tablaPagos?.registros.filter((fila) => !esTotal(Object.values(fila))) ?? null,
      total: total?.[0].match(/\d/u) ? total[0] : total?.[1] || null,
      deuda_biblioteca: deudaBiblioteca,
      enlaces,
    };
  }

  const datos = { titulo: documento.title, texto: lineas(documento.body), tablas };
  if (seccion === 'notas_actuales') {
    datos.cursos_con_notas = [...documento.querySelectorAll('.accordion h3')].map((encabezado) => {
      const bloque = encabezado.nextElementSibling;
      const unidades = [...(bloque?.querySelectorAll('table.lista') ?? [])].flatMap((tabla) => {
        const filas = filasPropias(tabla);
        const filaCabecera = cabecera(filas);
        const columnas = filaCabecera ? celdas(filaCabecera) : [];
        const unidadesTabla = [];
        let unidad;
        for (const fila of filas) {
          if (fila === filaCabecera || fila.parentElement.tagName === 'TFOOT') continue;
          const valores = celdas(fila);
          if (!valores.some(Boolean)) continue;
          if (valores[0]) {
            unidad = { unidad: valores[0], peso_unidad: valores[3] || null, evaluaciones: [] };
            unidadesTabla.push(unidad);
          } else {
            unidad?.evaluaciones.push(columnas.length === valores.length
              ? registro(columnas, valores) : { celdas: valores });
          }
        }
        const resumen = tabla.tFoot?.rows[0];
        if (unidad && resumen) unidad.resumen_final = celdas(resumen);
        return unidadesTabla;
      });
      return { curso: texto(encabezado), unidades };
    }).filter(({ curso }) => curso);
  }
  return datos;
}

async function descargarPagina(contexto, url, timeout) {
  const respuesta = await contexto.request.get(url.href, { timeout, maxRedirects: 0 });
  try {
    const cabeceras = respuesta.headers();
    if (respuesta.status() >= 300 && respuesta.status() < 400 && cabeceras.location) {
      const destino = new URL(cabeceras.location, url);
      return { destino: destino.origin === url.origin ? destino.pathname : null };
    }
    if (!respuesta.ok()) return {};
    const cuerpo = await respuesta.body();
    const declaracion = cabeceras['content-type']?.match(/charset\s*=\s*["']?([\w-]+)/iu)
      ?? cuerpo.subarray(0, 4096).toString('latin1').match(/<meta\b[^>]*\bcharset\s*=\s*["']?([\w-]+)/iu);
    let decodificador;
    try {
      decodificador = new TextDecoder(declaracion?.[1] ?? 'utf-8');
    } catch {
      decodificador = new TextDecoder();
    }
    return { html: decodificador.decode(cuerpo) };
  } finally {
    await respuesta.dispose();
  }
}

export async function consultarDatosEstudianteIntranet(contexto, pagina, urlLogin) {
  const origen = new URL(urlLogin).origin;
  const limite = Date.now() + maximoConsultaMs;
  const paginaPerfil = new URL(pagina.url());
  if (paginaPerfil.origin !== origen) throw new Error('El perfil no pertenece a la intranet configurada.');
  const academicos = resolverEnlaces(await pagina.locator('html').evaluate(leerEnlacesEnNavegador), paginaPerfil);
  const enlacesAcademicos = academicos.filter(({ url }) => url.origin === origen
    && url.pathname === '/alumno.php'
    && [...rutasAcademicas.keys()].some((parametro) => /^\d+$/u.test(url.searchParams.get(parametro) ?? '')));
  const inicio = buscarEnlace(academicos, origen, '/inicio.php', 'inicio')
    ?? { url: new URL('/inicio.php', origen) };
  const consulta = {
    fecha_extraccion: new Date().toISOString(),
    menu_principal: [],
    menu_academico: publicarEnlaces(enlacesAcademicos),
    cursos_actuales: null,
    notas_actuales: null,
    periodos_anteriores: [],
    horario: null,
    asistencia: null,
    cursos_extracurriculares: null,
    economia_inicio: null,
    comprobantes_electronicos: null,
    pasarela: null,
    errores: [],
  };
  let paginasLeidas = 0;
  let sesionExpirada = false;
  let principal = [];
  const lectura = await contexto.newPage();

  async function visitar(seccion, titulo, enlace, parametro) {
    const pagina = { pagina: titulo, url: enlace ? urlPublicable(enlace.url) : null };
    function error(codigo, estado = 'error') {
      consulta.errores.push({ seccion, codigo, ...(parametro === 'im' ? { periodo: enlace.seccion } : {}) });
      return { ...pagina, estado, codigo, texto: [], tablas: [] };
    }

    if (!enlace) return error('ENLACE_NO_DISPONIBLE', 'no_disponible');
    if (sesionExpirada) return error('SESION_INTRANET_EXPIRADA', 'redirigido_al_acceso');
    const tiempoDisponible = Math.min(maximoPaginaMs, limite - Date.now());
    if (tiempoDisponible <= 0) return error('TIEMPO_CONSULTA_AGOTADO');

    try {
      const { destino, html } = await descargarPagina(contexto, enlace.url, tiempoDisponible);
      const pasarela = seccion === 'pasarela';
      if (pasarela && (destino === rutaAccesoPasarela || rutasAcceso.has(destino))) {
        return error('ACCESO_PASARELA_REQUERIDO', 'requiere_autenticacion');
      }
      if (rutasAcceso.has(destino)) {
        sesionExpirada = true;
        return error('SESION_INTRANET_EXPIRADA', 'redirigido_al_acceso');
      }
      if (destino !== undefined) return error('DESTINO_INTRANET_INESPERADO');
      if (html === undefined) return error('PAGINA_INTRANET_NO_DISPONIBLE');
      const { enlaces, ...datos } = await lectura.evaluate(leerPaginaEnNavegador, {
        seccion, html, rutaAccesoPasarela,
      });
      if (datos.estado === 'requiere_autenticacion') {
        return error('ACCESO_PASARELA_REQUERIDO', 'requiere_autenticacion');
      }
      if (datos.estado === 'redirigido_al_acceso') {
        if (pasarela) return error('ACCESO_PASARELA_REQUERIDO', 'requiere_autenticacion');
        sesionExpirada = true;
        return error('SESION_INTRANET_EXPIRADA', 'redirigido_al_acceso');
      }
      if (enlaces) principal = resolverEnlaces(enlaces, enlace.url);
      if (seccion === 'economia_inicio' && !datos.tablas.length && !datos.deuda_biblioteca) {
        return error('INFORMACION_ECONOMICA_NO_DISPONIBLE', 'no_disponible');
      }
      paginasLeidas += 1;
      return { ...pagina, ...datos, estado: 'leida' };
    } catch (errorPagina) {
      return error(errorPagina.name === 'TimeoutError' ? 'TIEMPO_PAGINA_AGOTADO' : 'PAGINA_INTRANET_NO_DISPONIBLE');
    }
  }

  try {
    // El documento analizado queda separado de la página y sus recursos se bloquean.
    await lectura.route('**/*', (ruta) => ruta.abort());
    consulta.economia_inicio = await visitar('economia_inicio', 'Información económica', inicio);
    consulta.menu_principal = publicarEnlaces(principal);
    const comprobantes = buscarEnlace(principal, origen, '/reporte_comprobantesElectronicos.php', 'comprobantes');
    consulta.comprobantes_electronicos = await visitar(
      'comprobantes_electronicos', 'Comprobantes electrónicos', comprobantes,
    );
    for (const [parametro, [seccion, titulo]] of rutasAcademicas) {
      const enlaces = enlacesAcademicos.filter(({ url }) => /^\d+$/u.test(url.searchParams.get(parametro) ?? ''));
      if (parametro === 'im') {
        const periodos = new Map(enlaces.map((enlace) => [enlace.url.searchParams.get(parametro), enlace]));
        for (const enlace of periodos.values()) {
          const datos = await visitar(seccion, titulo, enlace, parametro);
          consulta.periodos_anteriores.push({ ...datos, periodo: enlace.seccion });
        }
      } else {
        consulta[seccion] = await visitar(seccion, titulo, enlaces[0], parametro);
      }
    }
    const pasarela = buscarEnlace(principal, origen, '/pasarela.php', 'pasarela');
    consulta.pasarela = await visitar('pasarela', 'Pasarela de pagos (consulta)', pasarela);
    return {
      estado: paginasLeidas === 0 ? 'no_disponible' : consulta.errores.length ? 'parcial' : 'completo',
      ...consulta,
    };
  } finally {
    await lectura.close().catch(() => {});
  }
}
