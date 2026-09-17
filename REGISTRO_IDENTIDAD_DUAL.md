# Registro de estudiante con identidad dual

## Objetivo

El estudiante no completa nombre, correo, código ni contraseña local. La API crea o vincula su cuenta solo cuando una identidad de Google Workspace y una identidad de la intranet prueban pertenecer a la misma persona. Este mismo flujo se ejecuta para el primer registro y para volver a iniciar sesión después de cerrar la cuenta.

## Datos y regla de conciliación

Google debe entregar un ID token ya validado por el servidor, con `sub`, `email`, `email_verified`, `hd` y `name`. Se acepta exclusivamente `hd=virtual.upt.pe` y un correo con forma `<prefijo-alfabético><10-dígitos>@virtual.upt.pe`. El prefijo procede del nombre del estudiante: por ejemplo, `ca2022074266` o `dc2021051033`; no se fija a `ca`. El código son los diez dígitos anteriores a `@virtual.upt.pe`.

La intranet debe entregar al servidor una respuesta verificable con `codigo` y `nombre_apellidos`. El formato actual observado en [estudiante_2022074266.json](/VMQEMU/SCRAP/estudiante_2022074266.json) es `APELLIDOS, NOMBRES` y `2022074266`.

En `api-backend-entrada-upt/src/modulos/registro_estudiante/servicios/conciliacion_identidad.servicio.js`, `conciliarIdentidadEstudiante` exige que ambos códigos sean iguales y que todos los tokens del nombre coincidan, sin depender de mayúsculas, tildes ni del orden apellidos/nombres. Por ejemplo, `CARLOS DANIEL AYALA RAMOS` coincide con `AYALA RAMOS, CARLOS DANIEL`.

## Flujo de producción

1. El estudiante pide `GET /api/registro-estudiante/intranet/captcha`. La API conserva su cookie de intranet por cinco minutos y devuelve la imagen CAPTCHA y un identificador de transacción. Flutter muestra la imagen y solicita código, contraseña numérica y CAPTCHA. Nada de ello se persiste.
2. Flutter envía los tres datos por `POST /api/registro-estudiante/intranet/verificar`. Node conserva el mismo contexto de Chrome que generó el CAPTCHA, pulsa visualmente cada dígito del teclado aleatorio, completa el CAPTCHA, abre la opción 17 de `#menu-block` —el mismo paso de `ScrapEstudiante.py`— y obtiene `codigo` y `nombre_apellidos` del encabezado autenticado. Primero usa el texto/DOM y, si el portal no expone esos datos como texto, aplica Tesseract a una captura. El CAPTCHA no se resuelve automáticamente.
3. La respuesta incluye un `verificacion_intranet_id` de diez minutos. Flutter lo envía a `POST /api/registro-estudiante/google/iniciar`, abre `url_autorizacion` en el navegador externo y consulta el estado de la transacción.
4. Google retorna exclusivamente a Express. El backend intercambia el código con PKCE y valida firma, emisor, audiencia, expiración, `nonce`, `email_verified`, el correo y `hd=virtual.upt.pe`; no confía en datos de perfil enviados por Flutter.
5. El backend concilia nombre y código. Si ambos coinciden, usa como datos definitivos el correo, `given_name`, `family_name`, foto y `sub` firmados por Google; conserva el nombre de intranet sólo como evidencia de conciliación, asigna el rol `ESTUDIANTE`, registra auditoría y emite la sesión propia de la API. Los tokens de Google e intranet se descartan.
6. Ante una diferencia, no se crea ni actualiza el usuario; la aplicación recibe un error de conciliación sin contraseñas, tokens ni CAPTCHA.

## Implementación

El flujo OAuth está en `api-backend-entrada-upt/src/modulos/registro_estudiante/servicios/google_estudiante.servicio.js`; la persistencia está en `repositorios/repositorio_registro_estudiante_mariadb.js` y la columna única `google_sub` se crea con `migraciones/009_identidad_google.sql`. Flutter lo consume desde `seguridad_estudiante/lib/controladores/controlador_verificacion_intranet.dart` y abre el navegador con `servicios/abridor_oauth.dart`.

La conciliación, OAuth simulado, persistencia real en MariaDB, contrato HTTP y adopción de sesión están cubiertos por `test/conciliacion_identidad.prueba.js`, `test/google_estudiante.prueba.js`, `test/registro_google_mariadb.prueba.js` y las pruebas Flutter/Dart correspondientes. Para usar Google real sólo faltan las credenciales institucionales descritas en [CONFIGURACION_GOOGLE_OAUTH.md](CONFIGURACION_GOOGLE_OAUTH.md).

El adaptador Node reproduce el comportamiento de `/VMQEMU/SCRAP/ScrapEstudiante.py` mediante `playwright-core`, Chrome/Chromium y Tesseract: usa una sesión temporal, muestra el CAPTCHA al estudiante y respeta el teclado aleatorio. No guarda contraseñas y no intenta resolver ni eludir el CAPTCHA. Para múltiples instancias de API, las transacciones temporales deben migrarse de memoria a Redis con expiración de cinco minutos; además, el mismo proceso debe conservar el contexto del navegador mientras dura la transacción.

Flutter no abre la intranet, no interpreta HTML y no ejecuta Python: únicamente consume los dos endpoints de Express y muestra/envía los campos. El cliente permite hasta 45 segundos para obtener el CAPTCHA y 120 segundos para completar la verificación; el resto de endpoints conserva el límite general de 15 segundos.

Google recomienda verificar el token en el servidor, comprobar `hd` para restringir el dominio y usar `sub` como identificador estable: [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) y [referencia de credenciales](https://developers.google.com/identity/openid-connect/reference).
