# Rama aplicacion-sin-google

Esta rama autentica estudiantes únicamente con código, contraseña y CAPTCHA de
la intranet UPT. El servidor valida el perfil institucional, consume la prueba
una sola vez, crea o actualiza la identidad y entrega una sesión. No guarda la
contraseña de intranet ni inventa correos. El código anterior de Google permanece
para mantenimiento y pruebas; sus rutas no se montan en el servidor de esta rama.

Por indicación del responsable, no hay geocerca ni comprobación GPS en esta
variante. Se mantienen identidad verificada, roles, cuentas activas y autorizadas,
bloqueos, sesiones, caducidad del QR, rotación y uso único. Los operadores siguen
necesitando su rol y asignación. GLOBAL es un agrupador lógico de registros; sus
coordenadas técnicas no representan la ubicación de personas y no autorizan por
proximidad. No se almacenan coordenadas al emitir ni validar QR en el flujo global.

## Dokploy

Crear una aplicación independiente; conservar la aplicación y base de main.

| Campo | Valor |
| --- | --- |
| Repositorio API | CarlosAyala1989/proyecto-moviles-entrada-upt |
| Rama | aplicacion-sin-google |
| Build Path | /api-backend-entrada-upt |
| Build Type | Dockerfile |
| Docker File | Dockerfile |
| Puerto del dominio | 3000 |
| Dominio HTTPS | api-sin-google.fottuto.men |
| Watch Paths | api-backend-entrada-upt/** |

Las variables reales de esta instalación se prepararon localmente en
`.env.aplicacion-sin-google`, excluido de Git y de la imagen. Pegarlas en
**Environment** de la nueva API. El archivo incluye la conexión exclusiva a
`respaldoseguridad`, claves nuevas y persistentes de QR/restricciones, y el
administrador inicial. No compartir estas claves con la versión main.
El ejemplo público `.env.example` no contiene contraseñas utilizables.

El Dockerfile instala Chromium y Tesseract, usa el usuario node y comprueba
`/api/salud`. Al arrancar aplica migraciones, prepara GLOBAL y crea el administrador
inicial si se proporcionan sus variables. Una clave de administrador existente
no se reemplaza al redesplegar. El servidor de producción rechaza otra base que
no sea `respaldoseguridad`, para evitar conectar por accidente con main.

Preparación explícita e idempotente desde esta carpeta:

```bash
node --env-file=.env.aplicacion-sin-google scripts/preparar_variante_sin_google.js
```

La migración nueva 017 permite el correo nulo. No se modifican las migraciones
históricas ni se cargan usuarios de ejemplo en la base remota. Los estudiantes
se registran después de comprobar sus credenciales reales con la intranet.

## Portal y app

El portal está en el repositorio `CarlosAyala1989/app-seguridad-entrada-upt`, en
la misma rama. Build Path `/portal-privacidad-upt`, Dockerfile `Dockerfile`, puerto
3000 y dominio HTTPS `ingresoupt-estudiante.fottuto.men`. Usa estas variables:

```dotenv
NODE_ENV=production
PORT=3000
SITIO_PUBLICO_URL=https://ingresoupt-estudiante.fottuto.men
API_BASE_URL=https://api-sin-google.fottuto.men/api
RESPONSABLE_NOMBRE="Carlos Daniel Ayala Ramos"
SOPORTE_CORREO=ca2022074266@virtual.upt.pe
ALOJAMIENTO_DESCRIPCION="Infraestructura administrada por el responsable del servicio mediante Dokploy."
```

La app de estudiante usa estos dominios en `config/app_store.json` y como valores
predeterminados. La aplicación de seguridad no se modifica.

## Eliminación y privacidad

La app enlaza directamente a `/eliminar-cuenta`. El portal obtiene un CAPTCHA,
verifica código y contraseña con la API y crea una solicitud de 10 minutos para
la cuenta existente. La contraseña no llega a una URL, cookie, registro o base de
datos. No se inicia sesión en la app ni se registra una cuenta al verificar el
borrado. Después se exige la confirmación ELIMINAR y el borrado es transaccional.
Se mantienen controles de origen, cookie HttpOnly/Secure/SameSite y comprobación
de que la cuenta pertenece exclusivamente a estudiante.

La retención sigue siendo 30 días. Los bloqueos institucionales se conservan por
separado, seudonimizados, durante como máximo ese plazo. Configurar también los
respaldos y logs externos con el máximo de 30 días. La política y el aviso de la
app son la versión 1.3 y explican intranet y ausencia de GPS.

## Operación y revisión Apple

Usar una réplica de API: las sesiones del CAPTCHA de intranet viven en memoria
y en el navegador del servidor. Si se requieren varias, configurar afinidad o
implementar un proveedor compartido antes de escalar. No registrar cuerpos,
contraseñas, cookies ni tokens en proxies.

El usuario y contraseña para App Review deben corresponder a una cuenta real de
intranet habilitada por la institución. Crear una cuenta local en esta base no
crea credenciales de intranet. Completar la prueba real con esa cuenta y el
borrado de una cuenta desechable; las pruebas automatizadas simulan el proveedor.
Los revisores pueden generar el QR desde fuera del campus en esta variante.

Para publicar aún se requieren Mac/Xcode, firma, TestFlight, capturas y los
metadatos de App Store Connect. La eliminación se mantiene accesible dentro de
la app mediante el enlace directo, según la [guía de Apple](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion).
