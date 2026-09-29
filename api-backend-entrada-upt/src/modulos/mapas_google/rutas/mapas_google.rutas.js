import { Router } from 'express';
import { z } from 'zod';
import { entorno } from '../../../config/env.js';
import { ErrorHttp } from '../../../middleware/manejo_errores.js';
import { validarDatos } from '../../../middleware/validar_datos.js';

const esquemaMapaEstatico = z.object({
  latitud: z.coerce.number().min(-90).max(90),
  longitud: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().int().min(1).max(20).default(17),
  ancho: z.coerce.number().int().min(320).max(640).default(600),
  alto: z.coerce.number().int().min(180).max(640).default(340),
}).strict();

function errorMapa(codigo, mensaje, estadoHttp) {
  return new ErrorHttp({ codigo, mensaje, estadoHttp });
}

function construirUrlMapa({ latitud, longitud, zoom, ancho, alto }, apiKey) {
  const centro = `${latitud},${longitud}`;
  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('center', centro);
  url.searchParams.set('zoom', String(zoom));
  url.searchParams.set('size', `${ancho}x${alto}`);
  url.searchParams.set('scale', '2');
  url.searchParams.set('maptype', 'roadmap');
  url.searchParams.set('format', 'png');
  url.searchParams.set('language', 'es');
  url.searchParams.set('region', 'PE');
  url.searchParams.set('markers', `color:0x1565C0|${centro}`);
  url.searchParams.set('key', apiKey);
  return url;
}

export function crearEnrutadorMapaGoogle({
  apiKey = entorno.googleMaps.apiKey,
  solicitarMapa = fetch,
} = {}) {
  const enrutador = Router();

  enrutador.get(
    '/estatico',
    validarDatos({ consulta: esquemaMapaEstatico }),
    async (solicitud, respuesta) => {
      if (!apiKey) {
        throw errorMapa(
          'GOOGLE_MAPS_NO_CONFIGURADO',
          'El mapa todavía no está configurado. Añade GOOGLE_MAPS_API_KEY en la API.',
          503,
        );
      }

      let resultado;
      try {
        resultado = await solicitarMapa(
          construirUrlMapa(solicitud.datosValidados.consulta, apiKey),
          { signal: AbortSignal.timeout(10_000) },
        );
      } catch {
        throw errorMapa(
          'GOOGLE_MAPS_NO_DISPONIBLE',
          'No fue posible cargar Google Maps en este momento.',
          502,
        );
      }

      const tipoContenido = resultado.headers.get('content-type') ?? '';
      if (!resultado.ok || !tipoContenido.startsWith('image/')) {
        throw errorMapa(
          'GOOGLE_MAPS_RESPUESTA_INVALIDA',
          'Google Maps rechazó la solicitud. Revisa la clave, sus restricciones y la facturación.',
          502,
        );
      }

      const imagen = Buffer.from(await resultado.arrayBuffer());
      respuesta
        .status(200)
        .set({
          'Content-Type': tipoContenido,
          'Content-Length': String(imagen.length),
          'Cache-Control': 'private, max-age=300',
        })
        .send(imagen);
    },
  );

  return enrutador;
}
