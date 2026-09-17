# API y MySQL en la red interna de Dokploy

La API usa las variables de entorno del contenedor para crear su pool de conexiones. Las variables inyectadas por Dokploy tienen prioridad sobre los archivos locales. El Dockerfile no incluye `.env` ni archivos de credenciales y escucha en `0.0.0.0:3000`.

## Variables de la aplicación API

En el servicio de la **API**, abre **Environment**, agrega o actualiza estas variables y guarda. Conserva las variables Google OAuth que ya tengas configuradas.

Para habilitar el botón Google de la aplicación estudiante, configura además
las cuatro variables `GOOGLE_` y el callback HTTPS descritos en
[Configuración de Google OAuth](../../CONFIGURACION_GOOGLE_OAUTH.md#dokploy-y-aplicación-de-estudiante).
El archivo privado `.env.dokploy` incluye ambos bloques; debe copiarse a
**Environment** y aplicarse con un nuevo despliegue.

```dotenv
NODE_ENV=production
PORT=3000
TZ=America/Lima
DB_HOST=api-moviles-ii-dbapi-39hk8g
DB_PORT=3306
DB_DATABASE=upt_ingreso-version2
DB_USER=upt_app
DB_PASSWORD=COPIAR_PASSWORD_DE_INTERNAL_CREDENTIALS
DB_CONNECTION_LIMIT=10
DB_ALLOW_PUBLIC_KEY_RETRIEVAL=true
```

El nombre del host, base y usuario corresponden a la imagen proporcionada. Copia el campo **Password** del usuario `upt_app`, no **Root Password**. Se dejó además un archivo privado `.env.dokploy` en el directorio del backend con los valores completos para copiar al editor de Dokploy. Ese archivo está ignorado por Git y Docker; Dokploy recibe la configuración desde su editor **Environment**, no desde ese archivo.

`DB_HOST` identifica el servicio MySQL dentro de Docker. No uses `127.0.0.1`, porque dentro del contenedor de la API esa dirección apunta a la propia API. El puerto de MySQL es el interno **3306**. El puerto del dominio de la API sigue siendo **3000**. La aplicación usa los campos `DB_` separados; pegar únicamente la URL de conexión en `DATABASE_URL` no configura este proyecto.

## Red y despliegue

1. Comprueba que API y MySQL compartan una red Docker y puedan comunicarse. Para una **Application** de Dokploy, revisa **Advanced → Swarm Settings → Network** y verifica que comparta una red con el servicio MySQL. Si ambos ya comparten la red, basta con configurar las variables. La misma máquina física no basta si los contenedores están en redes distintas.
2. Si la API se despliega mediante **Docker Compose**, conecta su servicio a la red externa que ya usa MySQL. Por ejemplo, si esa red es `dokploy-network`:

   ```yaml
   services:
     api:
       # Conserva build/image y las variables existentes de tu servicio.
       networks:
         - dokploy-network

   networks:
     dokploy-network:
       external: true
   ```

   Las variables del editor Environment de Compose también deben pasarse al servicio con `environment` o `env_file`, según tu archivo Compose. Verifica el nombre real de la red de MySQL antes de usar el ejemplo.
3. Publica estos cambios del código mediante el método que ya usa tu aplicación y pulsa **Deploy/Redeploy** para reconstruir la API con esta versión y aplicar las variables. No hay que abrir un puerto público de MySQL para esta conexión.
4. Si construyes con el Dockerfile de este repositorio, usa el directorio `api-backend-entrada-upt` como contexto de construcción y `Dockerfile` dentro de ese directorio. Mantén el dominio HTTP de la API dirigido al puerto **3000**.

## Comprobación desde el contenedor de la API

Abre una terminal del contenedor de la **API** y ejecuta en `/app`:

```bash
npm run verificar:bd
```

El comando es de solo lectura: comprueba conexión, nombre de la base, versión del servidor y las 13 tablas requeridas. No imprime contraseñas ni cambia filas. Debe mostrar `Conexión correcta` y `Las 13 tablas requeridas están disponibles`.

Después consulta desde el mismo contenedor:

```bash
node -e "fetch('http://127.0.0.1:3000/api/salud').then(async r => { console.log(await r.text()); process.exitCode = r.ok ? 0 : 1; }).catch(() => { console.error('No se pudo consultar la API'); process.exitCode = 1; })"
```

También puedes abrir `https://TU_DOMINIO_API/api/salud`. El endpoint comprueba la conexión SQL realmente y devuelve HTTP 200 con `estado: correcto` y `base_datos: conectada`; HTTP 503 indica que todavía falla la conexión.

La base ya contiene la estructura importada, por lo que no es necesario volver a importar el SQL. Si usaste `upt_ingreso_dokploy.sql`, las 10 migraciones también están registradas. No ejecutes `sembrar:pruebas` en esta base.

## Actualización automática de la base en cada despliegue

El arranque `node src/server.js` ejecuta las migraciones antes de abrir el
puerto HTTP. Funciona con el Dockerfile existente, `npm start` y `npm run dev`.
No requiere un segundo webhook, un comando de build adicional ni variables
nuevas en Dokploy. Las migraciones se ejecutan dentro del contenedor que
arranca, con las credenciales internas `DB_*`, nunca durante `docker build`.

El flujo es **push a main → despliegue de la API → migraciones pendientes →
API disponible**. Conserva **On Push**, la rama `main` y el build Dockerfile.
Si configuras **Watch Paths**, incluye `api-backend-entrada-upt/**` para que
los cambios en `migraciones/` también disparen un despliegue. Si está vacío,
no necesitas agregar un filtro.

`migraciones_aplicadas` guarda los nombres aplicados. Los archivos registrados
se omiten en cada arranque: no se reimporta el dump, no se cargan usuarios de
prueba y no se reinicia la base. El SQL de una migración sí puede modificar
datos cuando lo indique expresamente. Un bloqueo de MySQL/MariaDB por base
serializa las migraciones de distintos contenedores; un segundo arranque
espera hasta 60 segundos y luego revisa de nuevo qué archivos quedan pendientes.

### Cómo introducir un cambio de esquema

1. Crea un archivo nuevo en `api-backend-entrada-upt/migraciones/`, con el
   siguiente número: después de `010_...sql`, el siguiente será `011_...sql`.
   No edites ni renombres las migraciones que ya se aplicaron.
2. Escribe SQL incremental compatible con MySQL 8 y MariaDB, por ejemplo un
   `ALTER TABLE` para añadir una columna o un `CREATE TABLE` para una tabla nueva.
   Usa `utf8mb4_unicode_ci` cuando declares una colación. El ejecutor adapta
   la colación MariaDB de los archivos históricos si MySQL no la admite.
3. Prueba el cambio en una base de desarrollo y publica juntos el código de
   la API y su migración. Un cambio al código de un repositorio JavaScript
   por sí solo no genera automáticamente un cambio SQL.
4. Al hacer push, Dokploy reconstruye la API y el arranque aplica ese archivo.
   En los logs verás `Migración aplicada: 011_...sql`, después
   `Migraciones al día (1 nuevas).` y finalmente `API disponible...`.

Para activar el mecanismo por primera vez, sube los cambios del ejecutor y
arranque a GitHub y deja que Dokploy despliegue esa versión. En la base ya
importada debería aparecer `Migraciones al día (0 nuevas).`.
El usuario `upt_app` necesita los permisos que use el SQL de las migraciones
sobre esta base, incluidos `CREATE`, `ALTER` e `INDEX`; no necesita ser root.

### Si una migración falla

El proceso termina con código 1 antes de aceptar peticiones, registra el
archivo que falló y no lo marca como aplicado ni continúa con los siguientes.
Consulta los logs y corrige el problema antes de desplegar de nuevo.
En MySQL/MariaDB, `ALTER TABLE` y `CREATE TABLE` pueden quedar confirmados
aunque falle otra sentencia del mismo archivo: el rollback no revierte ese
DDL. Inspecciona cualquier cambio parcial antes de reintentar; dividir los
cambios y hacerlos reanudables evita repetir un `ADD COLUMN` ya ejecutado.

Planifica las migraciones para que la API anterior pueda seguir funcionando
mientras Dokploy cambia los contenedores: primero añade campos/tablas y
reserva eliminaciones para un despliegue posterior. Una reversión de la
imagen de la API no revierte automáticamente la base de datos.

Referencias: [auto deploy de Dokploy](https://docs.dokploy.com/docs/core/auto-deploy),
[bloqueos de MySQL](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html)
y [confirmación implícita del DDL](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html).

## Si falla

- `ENOTFOUND`: revisa el host interno y la red compartida.
- `ECONNREFUSED` o `ETIMEDOUT`: revisa que MySQL esté levantado y use el puerto interno 3306.
- `ER_ACCESS_DENIED_ERROR`: revisa el Password de `upt_app` y su acceso a la base destino.
- `ER_BAD_DB_ERROR`: revisa el nombre exacto `upt_ingreso-version2`.
- `ER_CANNOT_RETRIEVE_RSA_KEY`: revisa `DB_ALLOW_PUBLIC_KEY_RETRIEVAL=true` para la conexión interna MySQL 8. Como alternativa, monta el PEM de la clave pública del servidor y configura `DB_CACHING_RSA_PUBLIC_KEY` con su ruta.

Referencias: [credenciales internas](https://docs.dokploy.com/docs/core/databases/connection), [variables Environment](https://docs.dokploy.com/docs/core/variables) y [red de una Application](https://docs.dokploy.com/docs/core/applications/advanced).
