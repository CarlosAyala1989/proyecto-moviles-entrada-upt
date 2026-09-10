# API Backend Entrada UPT

API REST en Node.js/Express para las aplicaciones Flutter de estudiantes y
verificadores. Utiliza un pool de conexiones a MariaDB.

## Requisitos

- Node.js 20 o superior
- MariaDB accesible desde el equipo o contenedor donde se ejecuta la API

## Ejecución local

El proyecto carga primero `.env` (si existe) y después
`credenciales_bd_local.txt`. Las variables ya definidas en `.env` tienen
prioridad.

```bash
npm install
npm run dev
```

La API queda disponible en `http://localhost:3000/api`.

Endpoints iniciales:

- `GET /api`: información de la API.
- `GET /api/health`: estado de la API y de la conexión con MariaDB.

Para cambiar opciones como el puerto, copia `.env.example` como `.env`. No
subas archivos con credenciales al repositorio.

## Pruebas

```bash
npm test
```

## Docker

Antes de construir la imagen deben existir las dependencias bloqueadas:

```bash
docker build -t api-entrada-upt .
```

Al ejecutar la imagen, inyecta las variables `DB_*`. Si MariaDB está en el
mismo Compose, `DB_HOST` debe ser el nombre de su servicio y `DB_PORT` suele
ser `3306` (el puerto interno del contenedor).
