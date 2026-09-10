# API de Identidad Digital y Control de Acceso UPT

Backend Node.js/Express para las aplicaciones móviles de estudiante y personal
de seguridad. El backend es la autoridad para la conexión con MariaDB y para
las decisiones de acceso; las aplicaciones Flutter no se conectan a la base de
datos directamente.

## Requisitos

- Node.js 20 o superior.
- MariaDB disponible en Docker.
- Archivo local `credenciales_bd_local.txt`, excluido de Git, con las variables
  `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER` y `DB_PASSWORD`.

La configuración puede sobrescribirse con un archivo `.env`. No se deben
guardar contraseñas, tokens ni el archivo de credenciales en el repositorio.

## Ejecución local

```bash
npm install
npm run migrar
npm run dev
```

## Endpoints del Hito 1

| Método | Ruta | Resultado esperado |
| --- | --- | --- |
| `GET` | `/api` | Información básica de la API. |
| `GET` | `/api/salud` | `200` cuando MariaDB está disponible. |

`/api/health` se conserva temporalmente como alias de `/api/salud` para no
interrumpir clientes locales ya configurados.

### Prueba HTTP reproducible

Con el servidor iniciado, ejecuta:

```bash
curl --include http://127.0.0.1:3000/api/salud
```

La respuesta esperada es `200 OK` con un cuerpo como:

```json
{
  "estado": "correcto",
  "base_datos": "conectada"
}
```

## Migraciones

Las migraciones SQL se encuentran en `migraciones/` y se aplican en orden
numérico mediante:

```bash
npm run migrar
```

La migración inicial crea únicamente `migraciones_aplicadas`, que registra las
migraciones ejecutadas. Las tablas de usuarios, roles, QR y accesos pertenecen
al Hito 2 y todavía no se crean.

## Pruebas

```bash
npm test
```

Las pruebas cubren la API básica, la conexión de salud, JSON inválido, tipo de
contenido y rutas inexistentes. No se ejecutan aplicaciones Flutter durante
esta etapa.

## Docker

La imagen no contiene credenciales. Al ejecutarla, inyecta las variables
`DB_*`; si MariaDB comparte una red Docker con la API, usa el nombre del
servicio como `DB_HOST` y su puerto interno `3306`.

```bash
docker build -t api-entrada-upt .
```
