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

## Endpoints disponibles

| Método | Ruta | Resultado esperado |
| --- | --- | --- |
| `GET` | `/api` | Información básica de la API. |
| `GET` | `/api/salud` | `200` cuando MariaDB está disponible. |
| Varios | `/api/autenticacion/*` | Inicio, renovación, consulta y cierre de sesión. |
| `GET` | `/api/identidad-digital` | Identidad propia obtenida desde la sesión. |
| Varios | `/api/administracion/*` | Administración protegida por el rol `ADMINISTRADOR`. |

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

Las migraciones crean el control de versiones, el modelo de identidad y acceso,
los roles iniciales y la configuración provisional de desarrollo. El diseño
completo está documentado en `docs/modelo_datos.md`.

Para cargar datos completamente ficticios y reproducibles:

```bash
npm run sembrar:pruebas
```

La carga es idempotente y se bloquea si `NODE_ENV=production`.

## Autenticación y administración local

Las operaciones de usuarios y el procedimiento para crear el administrador
inicial están documentados en `docs/administracion_usuarios.md`. El contrato de
sesiones, sus medidas de seguridad y las peticiones HTTP reproducibles están en
`docs/autenticacion_temporal.md`.

La respuesta del perfil propio y sus reglas de privacidad están documentadas
en `docs/identidad_digital.md`.

## Pruebas

```bash
npm test
```

Las pruebas cubren la API básica, conexión de salud, modelo de datos,
autenticación válida e inválida, usuarios inactivos, expiración lógica,
rotación y revocación de tokens, bloqueo temporal, autorización por roles y el
flujo administrativo. También comprueban la identidad propia, la privacidad de
campos internos y el rechazo de consultas sobre otra persona. No se ejecutan
aplicaciones Flutter durante esta etapa.

## Docker

La imagen no contiene credenciales. Al ejecutarla, inyecta las variables
`DB_*`; si MariaDB comparte una red Docker con la API, usa el nombre del
servicio como `DB_HOST` y su puerto interno `3306`.

```bash
docker build -t api-entrada-upt .
```
