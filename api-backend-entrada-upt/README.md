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
| Varios | `/api/codigos-qr/*` | Generación, estado y revocación del QR temporal. |
| `POST` | `/api/ingresos/validar` | Decisión de acceso reservada al rol `SEGURIDAD`. |
| `GET` | `/api/ingresos/recientes` | Historial reciente del operador autenticado. |
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
numérico automáticamente al arrancar la API, antes de aceptar peticiones.
El mismo ejecutor puede invocarse manualmente mediante:

```bash
npm run migrar
```

En Dokploy, cada despliegue tras un push aplica sólo los archivos pendientes
y conserva el historial de `migraciones_aplicadas`. Para un cambio de esquema,
añade una migración numerada nueva y publícala junto al código. No edites las
ya aplicadas. Si una migración falla, la API no inicia; los cambios DDL
parciales pueden requerir reparación antes de reintentar.
Consulta [el procedimiento de actualización automática](docs/despliegue_dokploy.md#actualización-automática-de-la-base-en-cada-despliegue).

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

El contrato de generación del QR, la rotación y los límites de la ubicación
están documentados en `docs/codigos_qr_temporales.md`.

La validación, el consumo de un solo uso y los motivos de decisión están
documentados en `docs/validacion_ingresos.md`.

El historial paginado, los puntos de acceso, el resumen, la auditoría y las
configuraciones permitidas están documentados en
`docs/administracion_operativa.md`.

## Pruebas

```bash
npm test
```

Las pruebas cubren la API básica, conexión de salud, modelo de datos,
autenticación válida e inválida, usuarios inactivos, expiración lógica,
rotación y revocación de tokens, bloqueo temporal, autorización por roles y el
flujo administrativo. También comprueban la identidad propia, la privacidad de
campos internos, el rechazo de consultas sobre otra persona y la generación,
caducidad, rotación y revocación de credenciales QR. La validación cubre tokens
inválidos, alterados, vencidos, revocados y reutilizados; usuarios inactivos,
rol de seguridad, ubicación, punto de acceso y consumo simultáneo. No se
ejecutan aplicaciones Flutter durante esta etapa. La administración operativa
cubre filtros por usuario, fecha, resultado, motivo, punto y operador, además
de comprobar la privacidad y autorización de los historiales.

## Docker

La imagen no contiene credenciales. Al ejecutarla, inyecta las variables
`DB_*`; si MariaDB comparte una red Docker con la API, usa el nombre del
servicio como `DB_HOST` y su puerto interno `3306`.

```bash
docker build -t api-entrada-upt .
```

La creación del administrador de Dokploy y el panel Flutter para puertas y
guardias están documentados en [Administración y GPS](docs/administracion_guardias.md).
