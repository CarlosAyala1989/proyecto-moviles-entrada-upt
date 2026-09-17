import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright-core';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';

const ejecutarArchivo = promisify(execFile);
const urlLoginPredeterminada = 'https://net.upt.edu.pe/index2.php?n=a38c138bbf10e4d5d2fbf6cb08bb280b';
const duracionTransaccionMs = 5 * 60 * 1000;
const duracionVerificacionMs = 10 * 60 * 1000;
const maximoTransacciones = 200;

function crearError(codigo, mensaje, estadoHttp) {
  return new ErrorHttp({ codigo, mensaje, estadoHttp });
}

function decodificarHtml(texto) {
  return texto
    .replace(/&nbsp;/giu, ' ')
    .replace(/&aacute;/giu, 'á')
    .replace(/&eacute;/giu, 'é')
    .replace(/&iacute;/giu, 'í')
    .replace(/&oacute;/giu, 'ó')
    .replace(/&uacute;/giu, 'ú')
    .replace(/&ntilde;/giu, 'ñ')
    .replace(/&amp;/giu, '&')
    .replace(/&#(\d+);/gu, (_coincidencia, codigo) => String.fromCodePoint(Number(codigo)))
    .trim();
}

export function extraerPerfilTexto(texto) {
  const codigos = [...new Set(texto.match(/\b\d{10}\b/gu) ?? [])];
  // No se elige un código entre varias identidades ni se usa el ingresado
  // como sustituto de lo que realmente muestra la intranet.
  if (codigos.length !== 1) return null;
  const patronNombre = /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ '\-]+,\s*[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ '\-]+$/iu;
  const lineas = texto.split(/\r?\n/gu).map((linea) => linea.trim()).filter(Boolean);
  // Tesseract puede leer columnas en otro orden o intercalar el menú entre
  // nombre y código. El script original también los buscaba por separado.
  const nombres = new Set();
  for (const linea of lineas) {
    const sinEtiqueta = linea.replace(
      /^(?:ESTUDIANTE|ALUMNO|NOMBRES?(?: Y APELLIDOS)?|APELLIDOS Y NOMBRES)\s*:\s*/iu,
      '',
    );
    if (patronNombre.test(sinEtiqueta)) nombres.add(sinEtiqueta);
    const coincidencia = sinEtiqueta.toUpperCase().match(
      /([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ '\-]+,\s*[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ '\-]+?)\s*(?:C[ÓO]DIGO\s*:?\s*)?(\d{10})/u,
    );
    if (coincidencia) nombres.add(coincidencia[1].trim());
  }
  return nombres.size === 1
    ? { nombre_apellidos: [...nombres][0], codigo: codigos[0] }
    : null;
}

export function extraerTecladoIntranet(html) {
  const teclas = new Map();
  const patron = /onclick\s*=\s*["']js:setChar\('([0-9])'\);["'][^>]*>\s*([0-9])\s*</giu;
  for (const coincidencia of html.matchAll(patron)) {
    const [, posicion, digito] = coincidencia;
    teclas.set(digito, posicion);
  }
  if (teclas.size !== 10) {
    throw crearError(
      'INTRANET_RESPUESTA_INVALIDA',
      'La intranet no entregó un teclado numérico válido.',
      502,
    );
  }
  return teclas;
}

export function codificarContrasenaIntranet(contrasena, teclado) {
  return [...contrasena].map((digito) => {
    const posicion = teclado.get(digito);
    if (posicion === undefined) {
      throw crearError('CONTRASENA_INTRANET_INVALIDA', 'La contraseña debe ser numérica.', 400);
    }
    return posicion;
  }).join('');
}

export function extraerPerfilIntranet(html) {
  const nodos = [...html.matchAll(/>([^<>]+)</gu)]
    .map(([, texto]) => decodificarHtml(texto))
    .filter(Boolean);
  for (const [indice, nodo] of nodos.entries()) {
    if (/^\d{10}$/.test(nodo) && indice > 0) {
      const nombreApellidos = nodos[indice - 1];
      if (/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+,\s*[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+$/iu.test(nombreApellidos)) {
        return { codigo: nodo, nombre_apellidos: nombreApellidos };
      }
    }
  }

  const textoPlano = decodificarHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
      .replace(/<[^>]+>/gu, ' ')
      .replace(/\s+/gu, ' '),
  );
  return extraerPerfilTexto(textoPlano);
}

async function resolverEjecutableChrome(rutaConfigurada) {
  const candidatos = [
    rutaConfigurada,
    process.env.CHROME_EXECUTABLE,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidato of candidatos) {
    try {
      await access(candidato);
      return candidato;
    } catch {
      // Continúa con el siguiente ejecutable conocido.
    }
  }
  throw crearError(
    'NAVEGADOR_NO_DISPONIBLE',
    'No se encontró Google Chrome o Chromium para consultar la intranet.',
    503,
  );
}

async function extraerPerfilConOcr(pagina) {
  const carpeta = await mkdtemp(join(tmpdir(), 'upt-intranet-'));
  try {
    const vista = pagina.viewportSize() ?? { width: 1920, height: 1080 };
    const capturas = [
      await pagina.screenshot({
        clip: {
          x: 0,
          y: 0,
          width: vista.width,
          height: Math.min(220, vista.height),
        },
      }),
      await pagina.screenshot({ fullPage: true }),
    ];
    for (const [indice, captura] of capturas.entries()) {
      const archivo = join(carpeta, `captura-${indice}.png`);
      await writeFile(archivo, captura);
      try {
        const { stdout } = await ejecutarArchivo(
          'tesseract',
          [archivo, 'stdout', '-l', 'eng', '--psm', '6'],
          { timeout: 15_000, maxBuffer: 1024 * 1024 },
        );
        const perfil = extraerPerfilTexto(stdout);
        if (perfil) return perfil;
        console.warn(
          `OCR de intranet sin perfil reconocible (captura ${indice}, ${stdout.length} caracteres).`,
        );
      } catch (error) {
        // El OCR es el último recurso; la extracción DOM sigue siendo principal.
        console.warn('No se pudo ejecutar el OCR de intranet:', error.code ?? 'ERROR_OCR');
      }
    }
    return null;
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

class SesionIntranetNavegador {
  constructor({ contexto, pagina, urlLogin }) {
    this.contexto = contexto;
    this.pagina = pagina;
    this.urlLogin = urlLogin;
  }

  async cargarCaptcha() {
    await this.pagina.goto(this.urlLogin, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    const imagen = this.pagina.locator("img[src='imagen.php']").first();
    await imagen.waitFor({ state: 'visible', timeout: 10_000 });
    return imagen.screenshot({ type: 'png' });
  }

  async leerPerfilActual() {
    const texto = await this.pagina.locator('body').innerText();
    return extraerPerfilTexto(texto)
      ?? extraerPerfilIntranet(await this.pagina.content())
      ?? await extraerPerfilConOcr(this.pagina);
  }

  async verificar({ codigo, contrasena, captcha }) {
    await this.pagina.locator('#t1').fill(codigo);
    for (const digito of contrasena) {
      await this.pagina.locator(
        'button.btn_cuerpo_login_number:visible',
        { hasText: new RegExp(`^\\s*${digito}\\s*$`) },
      ).first().click();
    }
    await this.pagina.locator('#kamousagi').fill(captcha);
    await this.pagina.locator('#Submit').click();
    await this.pagina.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});

    const botonAviso = this.pagina.locator('body .mfp-content button:visible').first();
    try {
      await botonAviso.waitFor({ state: 'visible', timeout: 3_000 });
      await botonAviso.click();
    } catch {
      // El aviso sólo aparece para algunos perfiles o periodos académicos.
    }

    const sigueEnLogin = await this.pagina.locator('#t1:visible').isVisible().catch(() => false);
    if (sigueEnLogin) {
      throw crearError(
        'CREDENCIALES_INTRANET_INVALIDAS',
        'El código, la contraseña o el CAPTCHA de intranet no son válidos.',
        401,
      );
    }

    // Selector literal usado por ScrapEstudiante.py. No equivale a tomar el
    // enlace número 17: nth-child cuenta todos los hijos de #menu-block.
    const opcionPerfil = this.pagina.locator('#menu-block > a:nth-child(17)');
    try {
      await opcionPerfil.waitFor({ state: 'attached', timeout: 15_000 });
      try {
        await opcionPerfil.click({ timeout: 5_000 });
      } catch {
        // El portal puede conservar el menú fuera del área visible; Selenium
        // activa el mismo onclick al hacer clic y Playwright lo fuerza aquí.
        await opcionPerfil.click({ force: true });
      }
    } catch {
      const perfilDisponible = await this.leerPerfilActual();
      if (perfilDisponible) return perfilDisponible;
      throw crearError(
        'NAVEGACION_INTRANET_INVALIDA',
        'La intranet inició sesión, pero no mostró el menú académico esperado.',
        422,
      );
    }

    await this.pagina.getByRole('link', { name: 'Notas', exact: true })
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
    return this.leerPerfilActual();
  }

  cerrar() {
    return this.contexto.close();
  }
}

/**
 * Conserva por cinco minutos el mismo contexto de navegador que generó el
 * CAPTCHA. El usuario resuelve la imagen; Node replica después el flujo del
 * script Selenium sin persistir código, contraseña ni CAPTCHA.
 */
export class ServicioIntranetUpt {
  #ahora;

  #crearSesionFn;

  #ejecutableChrome;

  #navegador;

  #urlLogin;

  #transacciones = new Map();

  #verificaciones = new Map();

  constructor({
    ahora = () => Date.now(),
    crearSesionFn,
    executablePath,
    urlLogin = urlLoginPredeterminada,
  } = {}) {
    this.#ahora = ahora;
    this.#crearSesionFn = crearSesionFn;
    this.#ejecutableChrome = executablePath;
    this.#urlLogin = urlLogin;
  }

  async #obtenerNavegador() {
    if (!this.#navegador) {
      const executablePath = await resolverEjecutableChrome(this.#ejecutableChrome);
      this.#navegador = chromium.launch({
        executablePath,
        headless: true,
        args: [
          '--disable-dev-shm-usage',
          ...(process.env.CHROME_NO_SANDBOX === 'true' ? ['--no-sandbox'] : []),
        ],
      });
      this.#navegador.then((navegador) => {
        navegador.on('disconnected', () => {
          this.#navegador = undefined;
        });
      }).catch(() => {
        this.#navegador = undefined;
      });
    }
    return this.#navegador;
  }

  async #crearSesion() {
    if (this.#crearSesionFn) return this.#crearSesionFn();
    const navegador = await this.#obtenerNavegador();
    const contexto = await navegador.newContext({
      locale: 'es-PE',
      viewport: { width: 1920, height: 1080 },
    });
    return new SesionIntranetNavegador({
      contexto,
      pagina: await contexto.newPage(),
      urlLogin: this.#urlLogin,
    });
  }

  async #limpiarTransaccionesExpiradas() {
    const cierres = [];
    for (const [id, transaccion] of this.#transacciones) {
      if (transaccion.expiraEn <= this.#ahora()) {
        this.#transacciones.delete(id);
        cierres.push(transaccion.sesion.cerrar());
      }
    }
    await Promise.allSettled(cierres);
    for (const [id, verificacion] of this.#verificaciones) {
      if (verificacion.expiraEn <= this.#ahora()) {
        this.#verificaciones.delete(id);
      }
    }
  }

  async obtenerCaptcha() {
    await this.#limpiarTransaccionesExpiradas();
    if (this.#transacciones.size >= maximoTransacciones) {
      throw crearError(
        'INTRANET_SATURADA',
        'Hay demasiadas verificaciones de intranet en curso. Intenta nuevamente.',
        429,
      );
    }

    let sesion;
    try {
      sesion = await this.#crearSesion();
      const imagen = await sesion.cargarCaptcha();
      const id = randomUUID();
      const expiraEn = this.#ahora() + duracionTransaccionMs;
      this.#transacciones.set(id, { sesion, expiraEn });
      return {
        transaccion_id: id,
        imagen_base64: Buffer.from(imagen).toString('base64'),
        tipo_imagen: 'image/png',
        expira_en: new Date(expiraEn).toISOString(),
      };
    } catch (error) {
      await sesion?.cerrar().catch(() => {});
      if (error instanceof ErrorHttp) throw error;
      throw crearError(
        'INTRANET_NO_DISPONIBLE',
        'No se pudo abrir la intranet UPT en el navegador del servidor.',
        503,
      );
    }
  }

  async verificarCredenciales({ transaccionId, codigo, contrasena, captcha }) {
    await this.#limpiarTransaccionesExpiradas();
    const transaccion = this.#transacciones.get(transaccionId);
    if (!transaccion) {
      throw crearError('CAPTCHA_EXPIRADO', 'El CAPTCHA expiró. Solicita uno nuevo.', 410);
    }
    this.#transacciones.delete(transaccionId);

    try {
      const perfil = await transaccion.sesion.verificar({ codigo, contrasena, captcha });
      if (perfil) {
        if (perfil.codigo !== codigo) {
          throw crearError(
            'CODIGO_INTRANET_NO_COINCIDE',
            'El código devuelto por la intranet no coincide con el código ingresado.',
            422,
          );
        }
        const verificacionId = randomUUID();
        const expiraEn = this.#ahora() + duracionVerificacionMs;
        this.#verificaciones.set(verificacionId, { perfil, expiraEn });
        return {
          ...perfil,
          verificacion_intranet_id: verificacionId,
          verificacion_expira_en: new Date(expiraEn).toISOString(),
        };
      }
      throw crearError(
        'PERFIL_INTRANET_NO_ENCONTRADO',
        'La intranet inició sesión, pero no se pudo obtener el perfil del estudiante.',
        422,
      );
    } catch (error) {
      if (error instanceof ErrorHttp) throw error;
      throw crearError(
        'INTRANET_NO_DISPONIBLE',
        'La intranet no pudo completar la verificación en este momento.',
        503,
      );
    } finally {
      await transaccion.sesion.cerrar().catch(() => {});
    }
  }

  async obtenerVerificacion(verificacionId) {
    await this.#limpiarTransaccionesExpiradas();
    const verificacion = this.#verificaciones.get(verificacionId);
    if (!verificacion) {
      throw crearError(
        'VERIFICACION_INTRANET_EXPIRADA',
        'La verificación de intranet venció. Inicia nuevamente el proceso.',
        410,
      );
    }
    return { ...verificacion.perfil };
  }

  consumirVerificacion(verificacionId) {
    return this.#verificaciones.delete(verificacionId);
  }

  async cerrar() {
    const cierres = [...this.#transacciones.values()]
      .map(({ sesion }) => sesion.cerrar());
    this.#transacciones.clear();
    this.#verificaciones.clear();
    await Promise.allSettled(cierres);
    if (this.#navegador) {
      const navegador = await this.#navegador.catch(() => null);
      this.#navegador = undefined;
      await navegador?.close().catch(() => {});
    }
  }
}
