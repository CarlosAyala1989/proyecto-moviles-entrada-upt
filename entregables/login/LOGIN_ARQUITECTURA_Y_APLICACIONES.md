# Inicio de sesión de las aplicaciones UPT

Documento técnico de apoyo a `LOGIN_APLICACIONES_UPT.pptx`.

Fecha de elaboración: 2 de octubre de 2026. Fuente: código del repositorio en el commit `3d2e2ed`.

## 1. Alcance de esta explicación

Esta entrega presenta el proyecto como una etapa dedicada exclusivamente al inicio de sesión. El resultado de cada flujo es una sesión autenticada con un usuario y sus roles. La explicación termina ahí: no desarrolla las funciones posteriores de las aplicaciones.

No se han eliminado funciones del código. La presentación y este documento recortan el alcance de la exposición, tal como se solicitó.

Existen **dos aplicaciones Flutter**, aunque se explican **tres perfiles de acceso**:

| Perfil | Proyecto Flutter | Forma de ingresar |
| --- | --- | --- |
| Estudiante | `seguridad_estudiante/` | Verificación de intranet UPT y después Google institucional. Ambos pasos son obligatorios. |
| Administrador | `seguridad_verificador/` | Usuario o correo y contraseña de su cuenta del sistema. |
| Seguridad | `seguridad_verificador/` | Usuario o correo y contraseña de su cuenta del sistema. |

Administrador y seguridad comparten la misma pantalla de login. La cuenta y sus roles determinan el perfil. El estudiante tiene un proceso institucional y no crea una contraseña local para esta aplicación.

## 2. Vista general

Flutter muestra las pantallas, recoge los datos y realiza solicitudes HTTPS. La API valida la identidad, consulta la base de datos y crea la sesión. La base de datos guarda usuarios, roles y sesiones.

```text
Estudiante: Flutter + navegador de Google
                    |
                    | HTTPS
                    v
              API Node.js / Express
                 |           |
                 |           +-- Intranet UPT y Google Workspace
                 v
           Base de datos SQL

Administrador / Seguridad: Flutter
                    |
                    | HTTPS
                    v
              API Node.js / Express
                    |
                    v
           Base de datos SQL
```

Flutter nunca conecta directamente a la base de datos. La contraseña de la base y el secreto OAuth de Google pertenecen al servidor.

La URL predeterminada del cliente es `https://api-moviles.fottuto.men/api`. Esta entrega describe el código y su configuración. No constituye una nueva comprobación del estado de producción en la fecha del documento.

## 3. Backend común: construcción y responsabilidades

### Tecnologías

| Componente | Uso en el login |
| --- | --- |
| Node.js 20 o superior | Ejecuta el servidor JavaScript. El Dockerfile utiliza Node.js 22 sobre Alpine. |
| JavaScript con módulos ES | Organiza el código mediante `import` y `export`. |
| Express 5 | Publica las rutas HTTP y coordina los middleware. |
| Zod | Valida los campos y el formato de las solicitudes. |
| Driver `mariadb` | Gestiona conexiones y consultas SQL a MariaDB o MySQL compatible. |
| `bcryptjs` | Compara contraseñas locales con sus hashes almacenados. |
| `node:crypto` | Genera tokens aleatorios y calcula sus hashes SHA-256. |
| `google-auth-library` | Gestiona OAuth y valida la identidad devuelta por Google. |
| Playwright Core y Chromium | Automatizan la verificación de la intranet UPT desde el servidor. |
| Tesseract OCR | Ayuda a extraer la información del perfil de intranet durante la verificación. El alumno escribe el CAPTCHA de la imagen. |
| Helmet, CORS y Morgan | Aplican cabeceras HTTP, configuran acceso desde otros orígenes y registran solicitudes. |
| Dotenv | Carga la configuración del entorno. |
| Docker y Dokploy | Empaquetan y despliegan la API. |

Las versiones concretas de dependencias están en `api-backend-entrada-upt/package.json` y se fijan en `package-lock.json`.

### Organización

```text
api-backend-entrada-upt/
  src/
    server.js                    Preparación de la base y arranque
    app.js                       Express, middleware y montaje de rutas
    config/                      Entorno y conexiones a la base de datos
    middleware/                  Autenticación, roles, validación y errores
    seguridad/                   Tokens y otras utilidades de seguridad
    modulos/
      autenticacion/
        rutas/                   URLs de login y sesión
        controladores/           Entrada HTTP y respuesta
        validacion/              Esquemas de los datos recibidos
        servicios/               Reglas de autenticación
        repositorios/            Consultas SQL y transacciones
      registro_estudiante/
        rutas/                   Intranet y Google
        controladores/           Coordinación de las solicitudes
        validacion/              Formatos de intranet y transacciones
        servicios/               Verificación y conciliación de identidad
        repositorios/            Registro de la identidad verificada
  migraciones/                   Evolución del esquema SQL
  test/                          Pruebas de la API
  Dockerfile                     Imagen del servidor
```

El recorrido habitual es: ruta, validación, controlador, servicio y repositorio. El servicio decide si una identidad puede iniciar sesión. El repositorio realiza la lectura o escritura en la base.

### Base de datos utilizada por el login

| Tabla | Responsabilidad |
| --- | --- |
| `usuarios` | Código, correo, nombres, estado y autorización. Para cuentas locales guarda `contrasena_hash`. Para estudiantes puede guardar `google_sub` y los datos de identidad verificados. |
| `roles` | Define los roles, entre ellos `ESTUDIANTE`, `ADMINISTRADOR` y `SEGURIDAD`. |
| `usuarios_roles` | Relaciona cada usuario con sus roles. |
| `sesiones` | Guarda hashes de los tokens, fechas de vencimiento y estado de la sesión. |
| `intentos_inicio_sesion` | Registra intentos del login local y sus resultados. |
| `registros_auditoria` | Registra acciones como inicio de sesión o verificación institucional. |
| `migraciones_aplicadas` | Identifica las migraciones SQL que el servidor ya ejecutó. |

El servidor aplica las migraciones pendientes antes de escuchar solicitudes. Las credenciales reales de la base de datos no forman parte de esta documentación.

## 4. Aplicación del estudiante

### Qué hace el login

El estudiante acredita primero que puede entrar a la intranet y después que controla su cuenta Google institucional. La API compara ambas identidades antes de abrir la sesión.

### Recorrido del alumno

1. Pulsa **Ingresar o registrarme** en `Identidad Digital UPT`.
2. La aplicación solicita a la API una imagen CAPTCHA de la intranet.
3. Escribe su código institucional, contraseña numérica de intranet y número de la imagen.
4. La API verifica las credenciales contra la intranet y devuelve una comprobación temporal junto con el perfil obtenido.
5. El alumno pulsa **Continuar con Google institucional**.
6. Flutter abre el navegador para que seleccione su cuenta `@virtual.upt.pe`.
7. Google devuelve el resultado a la API. El servidor valida la cuenta y compara el código y el nombre con los de intranet.
8. Si la identidad coincide, el backend registra o actualiza al estudiante y emite los tokens de sesión.
9. Flutter recoge el resultado, comprueba el rol permitido y guarda la sesión en almacenamiento seguro.

El flujo actual usa intranet **y** Google, en ese orden. No son dos opciones intercambiables. El mismo recorrido sirve para el primer registro y para un nuevo inicio de sesión institucional.

### Datos y comprobaciones

La validación actual de la API exige un código de 10 dígitos, una contraseña de intranet de 1 a 6 dígitos y un CAPTCHA de 1 a 5 dígitos. Estos límites proceden del código del proyecto.

Google debe entregar un correo verificado de Google Workspace en el dominio configurado. Con la configuración actual, el dominio es `virtual.upt.pe`. Además, el backend comprueba la respuesta OAuth, el `nonce`, el identificador de Google y la correspondencia de la identidad con intranet.

El servidor usa `state`, `nonce` y PKCE en OAuth. El secreto del cliente Google permanece en Node.js. La contraseña Google se introduce en Google, no en un formulario de Flutter ni de esta API.

La API utiliza la contraseña de intranet durante la comprobación y no la persiste en SQL. La pantalla Flutter limpia el campo de contraseña y el CAPTCHA al terminar el intento. Una verificación institucional fallida no abre una sesión.

### Qué función cumple Flutter

- Presenta las pantallas inicial y de verificación de intranet.
- Muestra el CAPTCHA y recoge los datos del formulario.
- Envía las solicitudes a la API y muestra errores comprensibles.
- Abre el navegador para el acceso Google mediante `url_launcher`.
- Consulta el estado de la transacción OAuth cada dos segundos hasta completarse o vencer.
- Adopta y almacena la sesión emitida por el backend.

Flutter no decide si intranet y Google identifican al mismo estudiante. Esa decisión se realiza en el servidor.

### Rutas específicas

Todas las rutas de esta tabla empiezan por `/api/registro-estudiante`.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/intranet/captcha` | Obtiene CAPTCHA y transacción temporal. |
| POST | `/intranet/verificar` | Envía `transaccion_id`, `codigo`, `contrasena` y `captcha`. |
| POST | `/google/iniciar` | Recibe `verificacion_intranet_id` y devuelve la URL OAuth. |
| GET | `/google/callback` | Recibe el retorno de Google en el backend. |
| GET | `/google/resultado` | Muestra el resultado del proceso en el navegador. |
| GET | `/google/estado/:transaccion_id` | Permite a Flutter obtener el estado y recoger la sesión al completarse. |

### Qué necesita para funcionar

La app necesita Flutter compatible con Dart 3.10, el paquete compartido `cliente_api_upt`, acceso HTTPS a la API y un navegador disponible para Google. El servidor necesita conectividad a la intranet y a Google, Chromium, Tesseract y la configuración OAuth completa.

Un nuevo login institucional requiere internet. Recuperar datos locales previamente guardados no equivale a autenticar por primera vez a una persona sin conexión.

## 5. Acceso del administrador

### Qué hace el login

Una cuenta previamente creada ingresa mediante usuario o correo y contraseña. La cuenta debe estar activa y autorizada. El perfil administrativo corresponde al rol `ADMINISTRADOR`.

### Recorrido

1. Abre la aplicación `Control de Acceso UPT`, del proyecto `seguridad_verificador/`.
2. Escribe su usuario o correo y su contraseña.
3. Flutter envía ambos campos a `POST /api/autenticacion/iniciar-sesion`.
4. El backend busca la cuenta, compara la contraseña mediante bcrypt y revisa su estado y autorización.
5. Si acepta las credenciales, devuelve la sesión y los roles del usuario.
6. Flutter guarda la sesión y reconoce el perfil administrativo por el rol devuelto.

El campo de usuario se corresponde en el servidor con `codigo_institucional` o `correo_institucional`. No existe un tercer identificador independiente en este contrato.

### Qué función cumple Flutter

Muestra el formulario, oculta o revela la contraseña a petición del usuario, valida que los campos no estén vacíos, indica que la solicitud está procesándose y muestra los errores. Después conserva la sesión segura y utiliza los roles devueltos para reconocer el perfil.

El backend comprueba los permisos de las rutas protegidas. Seleccionar o modificar un perfil en Flutter no otorga un rol administrativo.

### Qué necesita para funcionar

Necesita una cuenta existente con contraseña hash y rol `ADMINISTRADOR`, la API disponible y conexión a internet. Este login usa la autenticación local del sistema. La configuración Google OAuth no es necesaria para este acceso.

No hay un proyecto Flutter independiente para el administrador. Comparte `seguridad_verificador/` con el personal de seguridad.

## 6. Acceso del personal de seguridad

### Qué hace el login

El personal de seguridad ingresa con una cuenta del sistema mediante usuario o correo y contraseña. Su perfil corresponde al rol `SEGURIDAD`.

### Recorrido

1. Abre la misma aplicación `Control de Acceso UPT`.
2. Completa el formulario de usuario o correo y contraseña.
3. Flutter solicita el login a `/api/autenticacion/iniciar-sesion`.
4. El servidor compara la contraseña y verifica que la cuenta esté activa y autorizada.
5. Flutter recibe la sesión con sus roles y reconoce el perfil de seguridad.

### Qué función cumple Flutter

Usa la misma pantalla y el mismo controlador de sesión que el administrador. Presenta los campos, maneja la espera y los errores, guarda los tokens y reconoce el rol `SEGURIDAD` devuelto por la API.

La contraseña se verifica en el backend. Flutter no almacena una copia de la contraseña para autenticar sin conexión.

### Qué necesita para funcionar

Necesita una cuenta existente con contraseña hash y rol `SEGURIDAD`, la API disponible e internet. La petición de login local no solicita coordenadas. Esta exposición termina al crear la sesión y no desarrolla las comprobaciones posteriores de operación.

## 7. Sesiones y seguridad comunes

### Contrato de sesión

El login local responde `201 Created` con una estructura como esta. Los valores son ilustrativos y no representan credenciales utilizables.

```json
{
  "datos": {
    "tipo_token": "Bearer",
    "token_acceso": "upt_acceso_VALOR_ALEATORIO",
    "token_renovacion": "upt_renovacion_VALOR_ALEATORIO",
    "token_acceso_expira_en": "FECHA_ISO_8601",
    "token_renovacion_expira_en": "FECHA_ISO_8601",
    "usuario": {
      "id": 1,
      "codigo_institucional": "USUARIO_EJEMPLO",
      "correo_institucional": "usuario@example.invalid",
      "nombres": "Nombre",
      "apellidos": "Apellido",
      "roles": ["ADMINISTRADOR"]
    }
  }
}
```

El flujo institucional del estudiante obtiene una sesión equivalente al recoger el resultado de Google. Los tokens son opacos y aleatorios, no JWT. La base de datos conserva sus hashes SHA-256.

### Rutas comunes

| Método | Ruta completa | Uso |
| --- | --- | --- |
| POST | `/api/autenticacion/iniciar-sesion` | Login local para administrador y seguridad en las pantallas descritas. |
| POST | `/api/autenticacion/renovar-sesion` | Recibe `token_renovacion` y rota los dos tokens. |
| GET | `/api/autenticacion/sesion` | Consulta el usuario y sus roles mediante Bearer. |
| POST | `/api/autenticacion/cerrar-sesion` | Revoca la sesión mediante Bearer y responde `204`. |

### Medidas que ya aplica el código

- Hash bcrypt para las contraseñas locales.
- Tokens de acceso y renovación distintos, con vencimiento y rotación.
- Comprobación del estado del usuario y de la sesión en las solicitudes autenticadas.
- Autorización por roles en el backend y filtro de roles admitidos en Flutter.
- Error genérico cuando el usuario o la contraseña local no coincide.
- Bloqueo temporal del login local tras intentos fallidos y registro de esos intentos.
- Almacenamiento de la sesión en `flutter_secure_storage` mediante `AlmacenSesionSegura`.
- Exigencia de HTTPS en la configuración Flutter para una compilación release.

Los valores predeterminados del proyecto son 15 minutos para el token de acceso, 7 días para la renovación, 5 intentos fallidos para el bloqueo y 15 minutos de bloqueo. Son configurables y no representan una política oficial de la universidad.

### Errores habituales

| Caso | Resultado esperado |
| --- | --- |
| Usuario o contraseña local incorrectos | `401 CREDENCIALES_INVALIDAS`. |
| Cuenta deshabilitada o no autorizada | `403 USUARIO_NO_HABILITADO`. |
| Bloqueo temporal del login local | `429 INICIO_SESION_BLOQUEADO`. |
| Cuenta de Google ajena al dominio institucional | Rechazo durante la verificación institucional. |
| Identidad Google y perfil de intranet incompatibles | No se abre la sesión del estudiante. |
| Transacción institucional vencida | El usuario debe repetir el proceso. |
| Cuenta con rol no admitido por la aplicación | Flutter rechaza esa sesión y solicita su cierre remoto. |
| Sin internet durante un nuevo login | No se pueden verificar las credenciales en el servidor. |

## 8. Requisitos y configuración

### API y base de datos

| Variable | Función |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` | Conexión SQL del backend. |
| `DB_CONNECTION_LIMIT` | Tamaño del grupo de conexiones. |
| `PORT` | Puerto HTTP interno, normalmente 3000. |
| `NODE_ENV` | Modo de ejecución, `production` en Dokploy. |
| `TZ` | Zona horaria, `America/Lima` en este proyecto. |
| `CORS_ORIGIN` | Orígenes HTTP permitidos. |
| `DURACION_TOKEN_ACCESO_MINUTOS` | Duración del token de acceso. |
| `DURACION_TOKEN_RENOVACION_DIAS` | Duración del token de renovación. |
| `MAX_INTENTOS_INICIO_SESION` | Límite antes del bloqueo del login local. |
| `DURACION_BLOQUEO_MINUTOS` | Duración del bloqueo. |

### Configuración adicional para el estudiante

| Variable | Función |
| --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` | Identifica el cliente OAuth de tipo aplicación web. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Secreto OAuth guardado únicamente en el backend. |
| `GOOGLE_OAUTH_REDIRECT_URI` | Callback autorizado exactamente igual en Google Cloud y en la API. |
| `GOOGLE_WORKSPACE_DOMAIN` | Dominio institucional, actualmente `virtual.upt.pe`. |
| `CHROME_EXECUTABLE` | Ruta al navegador utilizado por la verificación de intranet. |
| `CHROME_NO_SANDBOX` | Opción del navegador del contenedor según el entorno de ejecución. |

El callback configurado para el despliegue del proyecto es `https://api-moviles.fottuto.men/api/registro-estudiante/google/callback`. Flutter abre el navegador, pero el retorno OAuth llega al backend.

Google Maps no participa en el login. Esta etapa no requiere una clave Maps.

### Flutter y cliente compartido

Cada aplicación utiliza Flutter con Dart 3.10 y widgets Material. La biblioteca interna `paquetes/cliente_api_upt/` contiene las solicitudes HTTP, los modelos, la configuración y el controlador de sesión que ambas aplicaciones comparten.

Para el login, las dependencias relevantes del cliente son `http` y `flutter_secure_storage`. La app estudiantil utiliza también `url_launcher` para abrir Google. Otras dependencias presentes en los proyectos pertenecen a funciones fuera del alcance de esta entrega.

`URL_API_UPT` permite configurar la dirección de la API al compilar. Ejemplo de ejecución local desde cualquiera de las aplicaciones:

```bash
flutter pub get --enforce-lockfile
flutter run -d linux --dart-define=URL_API_UPT=http://127.0.0.1:3000/api
```

`127.0.0.1` sirve para ejecutar API y Flutter en el mismo equipo. En un teléfono se necesita una dirección del servidor accesible desde el dispositivo. Una compilación release debe utilizar HTTPS.

### Preparación local del backend

Desde `api-backend-entrada-upt/`, configurar `.env` tomando `.env.example` como referencia y disponer de una base SQL accesible:

```bash
npm ci
npm run migrar
npm run dev
```

Para la verificación institucional local también deben estar disponibles Chromium o Chrome y Tesseract. En el despliegue Docker estos binarios se instalan desde el Dockerfile.

En Dokploy se utiliza la imagen de la API, se cargan sus variables y se publica el dominio con HTTPS. La aplicación arranca después de aplicar migraciones y verificar la conexión SQL. No se debe cargar una semilla de pruebas en producción.

### Consideración de despliegue del acceso institucional

Las transacciones temporales de intranet y Google se mantienen en memoria del proceso Node.js. Un reinicio durante el login obliga a repetirlo. Si se utilizan varias réplicas de la API, las solicitudes de un mismo flujo deben llegar a la misma instancia, o debe incorporarse un almacenamiento compartido de transacciones.

## 9. Capturas para la presentación

La presentación contiene cinco diapositivas, con cuatro espacios editables de imagen:

| Diapositiva | Contenido | Captura sugerida |
| --- | --- | --- |
| 1 | Inicio de sesión UPT y los tres perfiles | Portada sin captura obligatoria. |
| 2 | Estudiante: intranet | Formulario de código, contraseña y CAPTCHA. |
| 3 | Estudiante: Google | Selección de cuenta institucional o botón para continuar con Google. |
| 4 | Administrador | Formulario de login de `Control de Acceso UPT`. |
| 5 | Seguridad | El mismo formulario con un ejemplo de usuario de seguridad. |

Los espacios vacíos son intencionales y están preparados para insertar las capturas del usuario. El texto de las diapositivas es editable. Para añadir una imagen, utilizar el espacio reservado o insertar la imagen y ajustar su tamaño al área. Evitar mostrar contraseñas, tokens o datos personales reales en las capturas.

## 10. Fuentes del repositorio

Las rutas son relativas a la raíz del proyecto.

| Tema | Archivos principales |
| --- | --- |
| Dependencias del backend | [package.json](../../api-backend-entrada-upt/package.json), [Dockerfile](../../api-backend-entrada-upt/Dockerfile) |
| Arranque, rutas y entorno | [server.js](../../api-backend-entrada-upt/src/server.js), [app.js](../../api-backend-entrada-upt/src/app.js), [.env.example](../../api-backend-entrada-upt/.env.example) |
| Login local | [autenticacion.rutas.js](../../api-backend-entrada-upt/src/modulos/autenticacion/rutas/autenticacion.rutas.js), [autenticacion.servicio.js](../../api-backend-entrada-upt/src/modulos/autenticacion/servicios/autenticacion.servicio.js) |
| Intranet y Google | [registro_estudiante.rutas.js](../../api-backend-entrada-upt/src/modulos/registro_estudiante/rutas/registro_estudiante.rutas.js), [intranet_upt.servicio.js](../../api-backend-entrada-upt/src/modulos/registro_estudiante/servicios/intranet_upt.servicio.js), [google_estudiante.servicio.js](../../api-backend-entrada-upt/src/modulos/registro_estudiante/servicios/google_estudiante.servicio.js) |
| Persistencia institucional | [repositorio_registro_estudiante_mariadb.js](../../api-backend-entrada-upt/src/modulos/registro_estudiante/repositorios/repositorio_registro_estudiante_mariadb.js) |
| Tokens | [tokens.js](../../api-backend-entrada-upt/src/seguridad/tokens.js) |
| Pantallas de estudiante | [pantalla_inicio_sesion.dart](../../seguridad_estudiante/lib/pantallas/pantalla_inicio_sesion.dart), [pantalla_verificacion_intranet.dart](../../seguridad_estudiante/lib/pantallas/pantalla_verificacion_intranet.dart) |
| Coordinación del acceso institucional | [controlador_verificacion_intranet.dart](../../seguridad_estudiante/lib/controladores/controlador_verificacion_intranet.dart) |
| Pantalla compartida administrador y seguridad | [pantalla_inicio_sesion_seguridad.dart](../../seguridad_verificador/lib/pantallas/pantalla_inicio_sesion_seguridad.dart), [aplicacion_seguridad.dart](../../seguridad_verificador/lib/aplicacion/aplicacion_seguridad.dart) |
| Sesión del cliente | [controlador_sesion.dart](../../paquetes/cliente_api_upt/lib/sesion/controlador_sesion.dart), [almacen_sesion_segura.dart](../../paquetes/cliente_api_upt/lib/sesion/almacen_sesion_segura.dart), [configuracion_api.dart](../../paquetes/cliente_api_upt/lib/configuracion/configuracion_api.dart) |
| Modelo SQL | [002_modelo_identidad_acceso.sql](../../api-backend-entrada-upt/migraciones/002_modelo_identidad_acceso.sql), [005_autenticacion_temporal.sql](../../api-backend-entrada-upt/migraciones/005_autenticacion_temporal.sql), [009_identidad_google.sql](../../api-backend-entrada-upt/migraciones/009_identidad_google.sql) |
