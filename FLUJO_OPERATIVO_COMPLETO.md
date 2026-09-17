# Flujo operativo completo — Identidad Digital y Control de Acceso UPT

Este documento describe el recorrido completo, desde preparar el entorno hasta cerrar las sesiones y auditar los eventos. Se refiere al entorno local: las cuentas, puntos y coordenadas de prueba no son datos institucionales reales.

## 1. Componentes y responsabilidad

| Componente | Qué hace | Código principal |
| --- | --- | --- |
| API Node/Express | Autoridad de autenticación, QR, decisión de ingreso y auditoría. | `api-backend-entrada-upt/src/app.js`, `api-backend-entrada-upt/src/server.js` |
| MariaDB | Guarda usuarios, roles, sesiones, QR, puntos, ingresos y auditoría. | `api-backend-entrada-upt/migraciones/`, `api-backend-entrada-upt/semillas/datos_prueba.sql` |
| Paquete Flutter compartido | Contiene URL, contrato HTTP, modelos y sesión segura para ambas apps. | `paquetes/cliente_api_upt/lib/servicios/cliente_api.dart`, `paquetes/cliente_api_upt/lib/sesion/controlador_sesion.dart` |
| App de portador | Inicio de sesión, identidad y generación/revocación de QR. | `seguridad_estudiante/lib/main.dart`, `seguridad_estudiante/lib/controladores/controlador_identidad_qr.dart` |
| App de seguridad | Escaneo, ubicación, resultado de validación e historial. | `seguridad_verificador/lib/main.dart`, `seguridad_verificador/lib/controladores/controlador_validacion_ingresos.dart` |
| Administración | Crea y mantiene usuarios, roles, puntos y configuración; consulta trazabilidad. | `api-backend-entrada-upt/src/modulos/usuarios/`, `api-backend-entrada-upt/src/modulos/administracion_operativa/` |

Las aplicaciones no acceden a MariaDB ni deciden un ingreso. El backend valida solicitud, token y rol antes de operar contra la base de datos.

## 2. Preparación del entorno local

### 2.1 Base de datos y API

1. Instalar Node.js 20+, MariaDB y Flutter. Las variables requeridas están descritas en `api-backend-entrada-upt/.env.example`.
2. Crear localmente `api-backend-entrada-upt/credenciales_bd_local.txt` o `.env`, con `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER` y `DB_PASSWORD`. No se deben versionar. `src/config/env.js` las carga y valida; `src/config/database.js` crea el pool MariaDB.
3. Preparar el esquema y datos ficticios:

   ```bash
   cd api-backend-entrada-upt
   npm install
   npm run migrar
   npm run sembrar:pruebas
   ```

   `scripts/ejecutar_migraciones.js` aplica en orden los SQL de `migraciones/` y registra cada uno. `scripts/cargar_datos_prueba.js` carga `semillas/datos_prueba.sql` de forma idempotente y se bloquea en producción.
4. Iniciar la API:

   ```bash
   npm run dev
   ```

   `src/server.js` escucha en `0.0.0.0`; `PORT` vale **3000** salvo que se sobrescriba. `src/app.js` configura CORS, Helmet, JSON, errores y todas las rutas bajo `/api`. Confirmar primero:

   ```bash
   curl --include http://127.0.0.1:3000/api/salud
   ```

### 2.2 Flutter Linux y el puerto compartido

`paquetes/cliente_api_upt/lib/configuracion/configuracion_api.dart` define `http://127.0.0.1:3000/api` como URL de desarrollo. Por tanto, al usar Flutter en Linux no se necesita ajustar puertos ni pasar la URL: ambas partes corren en el mismo equipo y usan el puerto 3000.

En una segunda terminal, ejecutar el portador:

```bash
cd seguridad_estudiante
flutter pub get
flutter run -d Linux
```

Para ejecutar al operador de seguridad:

```bash
cd seguridad_verificador
flutter pub get
flutter run -d Linux --dart-define=PUNTO_ACCESO_CODIGO=PUERTA-PRINCIPAL
```

Tras ejecutar `npm run sembrar:pruebas`, las credenciales exclusivamente
ficticias para probar estas dos aplicaciones son:

| Aplicación | Código institucional | Contraseña |
| --- | --- | --- |
| Portador | `PRUEBA-EST-001` | `Prueba-Local-UPT!2026` |
| Verificador | `PRUEBA-SEG-001` | `Prueba-Local-UPT!2026` |

La semilla conserva únicamente el hash bcrypt de esa clave en
`api-backend-entrada-upt/semillas/datos_prueba.sql`; la clave no debe volver a
usarse fuera del entorno local.

Ambos `main.dart` validan la URL antes de restaurar una sesión. El verificador también valida el punto en `seguridad_verificador/lib/configuracion/configuracion_seguridad.dart`. En Android, el registro Google local usa `adb reverse tcp:3000 tcp:3000` y conserva `127.0.0.1`, para que tanto Flutter como el navegador alcancen el callback de Express. El verificador puede usar `10.0.2.2` en el emulador. Las compilaciones release exigen HTTPS.

## 3. Flujo funcional, de inicio a fin

### A. Preparación administrativa

Un `ADMINISTRADOR` inicia sesión con `POST /api/autenticacion/iniciar-sesion`. El servicio `modulos/autenticacion/servicios/autenticacion.servicio.js` comprueba credenciales y el repositorio `modulos/autenticacion/repositorios/repositorio_autenticacion_mariadb.js` crea una sesión con token de acceso y renovación. Rutas y datos de entrada: `rutas/autenticacion.rutas.js` y `validacion/autenticacion.esquemas.js`.

Con su Bearer, el administrador prepara la operación; todas las rutas quedan bajo `/api/administracion` y `src/middleware/requerir_roles.js` exige el rol:

1. `GET /roles` obtiene los roles permitidos.
2. `POST /usuarios` crea al portador y al operador con estado, autorización, verificación, contraseña y roles. Un portador requiere `ESTUDIANTE`, `DOCENTE` o `TRABAJADOR`; el verificador requiere `SEGURIDAD`.
3. `GET /usuarios`, `GET/PATCH /usuarios/:id`, `PATCH /usuarios/:id/estado`, `PUT /usuarios/:id/roles` y `PUT /usuarios/:id/credencial-local` buscan o actualizan cada aspecto.
4. `POST /puntos-acceso` registra una puerta activa con código, coordenadas y radio. `GET /puntos-acceso` y `PATCH /puntos-acceso/:id` la consultan y modifican.
5. `GET/PUT /configuraciones` consulta o ajusta valores provisionales, como duración de QR. `GET /resumen`, `/accesos` y `/auditoria` quedan para el control posterior.

Usuarios: `modulos/usuarios/rutas/administracion_usuarios.rutas.js`, `validacion/usuarios.esquemas.js`, `controladores/usuarios.controlador.js` y `repositorios/repositorio_usuarios_mariadb.js`. Operación y auditoría: `modulos/administracion_operativa/`.

### B. Registro dual del estudiante

El estudiante abre `seguridad_estudiante/lib/pantallas/pantalla_verificacion_intranet.dart`. El controlador `controlador_verificacion_intranet.dart` obtiene el CAPTCHA, envía código, contraseña numérica y respuesta al módulo backend `modulos/registro_estudiante/`. Si la intranet confirma el perfil, recibe una autorización temporal; ninguna credencial queda guardada.

Después llama `POST /api/registro-estudiante/google/iniciar` y `abridor_oauth.dart` abre Google en el navegador del sistema. Google retorna al callback de Express, nunca a Flutter. `google_estudiante.servicio.js` valida OAuth/OpenID Connect, restringe `hd` y correo a `virtual.upt.pe`, extrae los diez dígitos del correo y usa `conciliacion_identidad.servicio.js` para comparar código y nombre con la intranet.

Si todo coincide, `repositorio_registro_estudiante_mariadb.js` crea o vincula al usuario mediante `google_sub`, asigna `ESTUDIANTE` y registra auditoría. El backend emite una sesión opaca y Flutter la adopta con `ControladorSesion.adoptarSesionVerificada()`. La configuración institucional requerida está en `CONFIGURACION_GOOGLE_OAUTH.md`.

### C. Inicio y restauración de sesión móvil

El portador no dispone de formulario de contraseña local: `seguridad_estudiante/lib/pantallas/pantalla_inicio_sesion.dart` siempre lo dirige al flujo dual de la sección anterior, tanto para registrarse como para volver a entrar. El operador sí escribe código/correo y contraseña en `seguridad_verificador/lib/pantallas/pantalla_inicio_sesion_seguridad.dart`. Las sesiones resultantes se persisten con `almacen_sesion_segura.dart`.

La API entrega acceso corto y renovación. Al volver a abrir la app, `ControladorSesion.restaurar()` consulta o renueva la sesión. `GET /autenticacion/sesion` comprueba el Bearer actual; `POST /autenticacion/renovar-sesion` rota ambos tokens e invalida los anteriores; `POST /autenticacion/cerrar-sesion` revoca la sesión en servidor y la app borra su copia local.

El filtrado visual de roles evita mostrar pantallas inadecuadas, pero no es una regla de seguridad: cada endpoint comprueba autenticación y rol nuevamente.

### D. Identidad digital y QR temporal

El portador abre la identidad. `ControladorIdentidadQr.cargarIdentidad()` pide `GET /api/identidad-digital`. El módulo `api-backend-entrada-upt/src/modulos/identidad_digital/` arma exclusivamente la identidad del dueño de la sesión: roles, verificación, estado y perfil. Se presenta en `seguridad_estudiante/lib/pantallas/pantalla_identidad_digital.dart`.

Al solicitar QR, `ControladorIdentidadQr.generarCodigoQr()` usa `seguridad_estudiante/lib/servicios/proveedor_ubicacion.dart`, pide permisos y envía ubicación a `POST /api/codigos-qr`. `modulos/codigos_qr/servicios/codigos_qr.servicio.js` exige usuario activo, autorizado, verificado y rol de portador; valida antigüedad y precisión de ubicación; después emite una credencial opaca, temporal y de un solo uso. `pantalla_codigo_qr.dart` sólo la representa y muestra su cuenta regresiva.

`GET /api/codigos-qr/actual` permite observar estado sin exponer nuevamente el QR. Si el portador cancela, `DELETE /api/codigos-qr/actual` revoca el pendiente; también expira al concluir su vigencia.

### E. Escaneo y decisión de ingreso

El operador `SEGURIDAD` abre `seguridad_verificador/lib/pantallas/pantalla_escaner.dart`. El widget `lib/widgets/visor_escaner_qr.dart` lee el código y `ControladorValidacionIngresos.validarCodigoQr()` obtiene una ubicación nueva, añade el punto de acceso configurado y envía `POST /api/ingresos/validar`.

El backend exige Bearer y `SEGURIDAD`. `modulos/ingresos/servicios/ingresos.servicio.js` valida formato, estado, vigencia, revocación, consumo previo, usuario, punto y ubicación. Registra toda respuesta en `registros_acceso`, incluso denegaciones. Si acepta, marca la credencial como usada en la misma operación: ese QR no puede autorizar un segundo ingreso. La app sólo presenta la respuesta del servidor.

`GET /api/ingresos/recientes`, mostrado por `seguridad_verificador/lib/pantallas/pantalla_historial.dart`, devuelve los últimos intentos del operador. Un QR aceptado y reutilizado devuelve `DENEGADO` con `CREDENCIAL_YA_UTILIZADA`, y queda registrado.

### F. Cierre y trazabilidad

Cada actor cierra sesión con `POST /api/autenticacion/cerrar-sesion`. El administrador revisa `GET /api/administracion/accesos` y su detalle `GET /accesos/:id`; filtra acciones con `GET /api/administracion/auditoria` y consulta contadores con `GET /resumen`. La trazabilidad conserva hechos operativos sin devolver contraseñas, hashes, tokens ni QR en listados.

## 4. Prueba reproducible de los endpoints deterministas

El contrato completo de cuerpos, respuestas y errores está en `ENDPOINTS_API_UPT.md`. `api-backend-entrada-upt/scripts/verificar_flujo_completo.js` ejecuta una vez todos los endpoints publicados en el orden del flujo:

| Grupo | Endpoints cubiertos |
| --- | --- |
| Públicos | `GET /api`, `GET /api/salud`, `GET /api/health` |
| Sesión | `POST /autenticacion/iniciar-sesion`, `/renovar-sesion`, `GET /sesion`, `POST /cerrar-sesion` |
| Portador | `GET /identidad-digital`, `POST /codigos-qr`, `GET/DELETE /codigos-qr/actual` |
| Operador | `POST /ingresos/validar`, `GET /ingresos/recientes` |
| Usuarios | `GET /administracion/roles`, `GET/POST /usuarios`, `GET/PATCH /usuarios/:id`, `PATCH /usuarios/:id/estado`, `PUT /usuarios/:id/roles`, `PUT /usuarios/:id/credencial-local` |
| Operación | `GET /administracion/resumen`, `GET /accesos`, `GET /accesos/:id`, `GET/POST /puntos-acceso`, `PATCH /puntos-acceso/:id`, `GET /auditoria`, `GET/PUT /configuraciones` |

Ejecutarlo así:

```bash
cd api-backend-entrada-upt
npm run test:flujo-completo
```

El script crea usuarios y un punto con nombres aleatorios, levanta una API efímera en un puerto libre, prueba HTTP y el cliente Dart real y, al final, cierra sesiones y elimina esos datos. Esto verifica la creación administrativa antes del ciclo QR y no depende de una cuenta preexistente.

Los seis endpoints de registro dual dependen de la intranet y de una cuenta
Google Workspace real. Sus contratos, conciliación, OAuth, persistencia y UI se
prueban con dobles controlados; la prueba manual real requiere las credenciales
de `CONFIGURACION_GOOGLE_OAUTH.md` y que el estudiante resuelva el CAPTCHA.

Para comprobar además análisis y pruebas unitarias de todos los paquetes:

```bash
./scripts/verificar_proyecto.sh
```

## 5. Límites del entorno de desarrollo

- Las ubicaciones móviles son declaraciones del dispositivo. El backend aplica tolerancias y radio, pero no constituyen por sí solas prueba de presencia.
- HTTP, `127.0.0.1`, radios y vigencias son provisionales. En producción se requiere HTTPS y el verificador rechaza `PRUEBA-LOCAL`.
- Contraseñas, tokens y credenciales reales no se guardan en código ni documentación. La excepción anterior es la única clave ficticia de la semilla local; la API conserva hashes y las aplicaciones usan almacenamiento seguro.
