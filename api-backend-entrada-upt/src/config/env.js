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
  port: enteroPositivo(process.env.PORT, 'PORT', 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  claveAdministracionDesarrollo:
    process.env.CLAVE_ADMINISTRACION_DESARROLLO ?? '',
  db: {
    host: process.env.DB_HOST,
    port: enteroPositivo(process.env.DB_PORT, 'DB_PORT'),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: enteroPositivo(
      process.env.DB_CONNECTION_LIMIT,
      'DB_CONNECTION_LIMIT',
      10,
    ),
  },
});
