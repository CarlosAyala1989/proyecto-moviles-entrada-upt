import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, '../..');
const credentialsFile = process.env.DB_CREDENTIALS_FILE
  ? path.resolve(process.env.DB_CREDENTIALS_FILE)
  : path.join(projectRoot, 'credenciales_bd_local.txt');

// .env permite configurar la API; el archivo existente aporta las credenciales locales.
dotenv.config({
  path: [path.join(projectRoot, '.env'), credentialsFile],
  quiet: true,
});

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

function positiveInteger(value, name, fallback) {
  const parsedValue = Number(value ?? fallback);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} debe ser un número entero positivo`);
  }

  return parsedValue;
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: positiveInteger(process.env.PORT, 'PORT', 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  db: {
    host: process.env.DB_HOST,
    port: positiveInteger(process.env.DB_PORT, 'DB_PORT'),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: positiveInteger(
      process.env.DB_CONNECTION_LIMIT,
      'DB_CONNECTION_LIMIT',
      10,
    ),
  },
});

