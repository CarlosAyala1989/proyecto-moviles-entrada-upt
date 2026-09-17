import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, '../..');
const credentialsFile = process.env.DB_CREDENTIALS_FILE
  ? path.resolve(process.env.DB_CREDENTIALS_FILE)
  : path.join(projectRoot, 'credenciales_bd_local.txt');
const administratorCredentialsFile = path.join(
  projectRoot,
  'credenciales_administrador_local.txt',
);

// .env permite configurar la API; el archivo existente aporta las credenciales locales.
dotenv.config({
  path: [
    path.join(projectRoot, '.env'),
    credentialsFile,
    administratorCredentialsFile,
  ],
  quiet: true,
});

const zonaHorariaOperativa = 'America/Lima';
if (process.env.TZ && process.env.TZ !== zonaHorariaOperativa) {
  throw new Error(`TZ debe ser ${zonaHorariaOperativa}`);
}
process.env.TZ = zonaHorariaOperativa;

const requiredVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_DATABASE',
  'DB_USER',
  'DB_PASSWORD',
];

const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${missingVariables.join(', ')}`,
  );
}

function enteroPositivo(valor, nombre, valorPredeterminado) {
  const valorConvertido = Number(valor ?? valorPredeterminado);

  if (!Number.isInteger(valorConvertido) || valorConvertido <= 0) {
    throw new Error(`${nombre} debe ser un número entero positivo`);
  }

  return valorConvertido;
}

export const entorno = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  zonaHoraria: zonaHorariaOperativa,
  port: enteroPositivo(process.env.PORT, 'PORT', 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  autenticacion: {
    duracionTokenAccesoMinutos: enteroPositivo(
      process.env.DURACION_TOKEN_ACCESO_MINUTOS,
      'DURACION_TOKEN_ACCESO_MINUTOS',
      15,
    ),
    duracionTokenRenovacionDias: enteroPositivo(
      process.env.DURACION_TOKEN_RENOVACION_DIAS,
      'DURACION_TOKEN_RENOVACION_DIAS',
      7,
    ),
    maxIntentosInicioSesion: enteroPositivo(
      process.env.MAX_INTENTOS_INICIO_SESION,
      'MAX_INTENTOS_INICIO_SESION',
      5,
    ),
    duracionBloqueoMinutos: enteroPositivo(
      process.env.DURACION_BLOQUEO_MINUTOS,
      'DURACION_BLOQUEO_MINUTOS',
      15,
    ),
  },
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '',
    dominio: (process.env.GOOGLE_WORKSPACE_DOMAIN ?? 'virtual.upt.pe').toLowerCase(),
  },
  db: {
    host: process.env.DB_HOST,
    port: enteroPositivo(process.env.DB_PORT, 'DB_PORT'),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    allowPublicKeyRetrieval: process.env.DB_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true',
    cachingRsaPublicKey: process.env.DB_CACHING_RSA_PUBLIC_KEY || undefined,
    connectionLimit: enteroPositivo(
      process.env.DB_CONNECTION_LIMIT,
      'DB_CONNECTION_LIMIT',
      10,
    ),
  },
});
