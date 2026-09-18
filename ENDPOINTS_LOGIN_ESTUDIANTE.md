# Endpoints de login para la aplicación de estudiante

Este documento describe únicamente los endpoints que la aplicación Flutter de
estudiante necesita para iniciar, restaurar, renovar y cerrar una sesión. No
incluye identidad digital, generación de códigos QR ni otras operaciones de la
aplicación.

El contrato corresponde al backend existente. La aplicación no debe conectarse
directamente a MariaDB ni implementar la validación institucional por su
cuenta.

## URL base y reglas generales

Todas las rutas son relativas a la URL base de la API:

```text
https://api-moviles.fottuto.men/api
```

Para desarrollo local se puede usar:

```text
http://127.0.0.1:3000/api
```

La aplicación debe permitir configurar la URL mediante `URL_API_UPT`. En una
compilación de producción se debe usar HTTPS.

### Ejecutar un proyecto Flutter independiente

`URL_API_UPT` es una constante de compilación Dart, no una variable que Flutter
lea automáticamente de un archivo `.env`. Desde la carpeta del proyecto Flutter:

```bash
flutter pub get
flutter run -d chrome --web-port=63155 --dart-define=URL_API_UPT=https://api-moviles.fottuto.men/api
```

En Dart, leerla así y usarla en **todas** las peticiones:

```dart
const urlBase = String.fromEnvironment(
  'URL_API_UPT',
  defaultValue: 'https://api-moviles.fottuto.men/api',
);
final baseNormalizada = urlBase.replaceFirst(RegExp(r'/+$'), '');
final urlCaptcha = Uri.parse(
  '$baseNormalizada/registro-estudiante/intranet/captcha',
);
```

Los encabezados HTTP de este documento muestran la ruta completa `/api/...`.
Como la URL base **ya contiene `/api`**, concatenar sólo
`/registro-estudiante/...` o `/autenticacion/...`. No generar `/api/api/...`.
Tampoco usar `Uri.resolve('/registro-estudiante/...')` sobre esta base:
una ruta que empieza con `/` sustituye la ruta de la base y elimina `/api`.
Después de cambiar `--dart-define`, detener y volver a ejecutar la app.

| Ejecución | URL de la API |
| --- | --- |
| Chrome, Windows, Linux o Android usando el backend publicado | `https://api-moviles.fottuto.men/api` |
| Chrome o escritorio con la API local en la misma máquina | `http://127.0.0.1:3000/api` |
| Emulador Android estándar con la API en la máquina anfitriona | `http://10.0.2.2:3000/api` |
| Teléfono físico con la API local | IP LAN de la máquina que ejecuta la API, puerto `3000` y ruta `/api`; debe ser accesible desde el teléfono. |

`http://localhost:63155` en la barra de Chrome es el servidor de **Flutter Web**,
no la API. `127.0.0.1` apunta a la máquina/dispositivo que ejecuta el cliente;
no apunta automáticamente al servidor remoto. Para probar el login desde otro
proyecto, empezar con la URL HTTPS publicada evita configurar una API local.

Reglas de transporte:

- Las rutas de login de estudiante son públicas; no llevan `Authorization`.
- Las peticiones `POST` con cuerpo llevan `Content-Type: application/json`.
- Las respuestas JSON llevan `Accept: application/json` como cabecera
  recomendada.
- Los nombres de las propiedades usan `snake_case`.
- Los cuerpos de las peticiones son estrictos: no se deben enviar propiedades
  adicionales.
- Las respuestas JSON exitosas usan el envoltorio `{ "datos": ... }`, salvo
  `204 No Content`.
- Una respuesta de error usa `{ "error": { "codigo": string, "mensaje":
  string } }`.

### Tiempos de espera y lectura de respuestas

La intranet se consulta mediante un navegador en el **servidor**. Las duraciones
del cliente de este repositorio son:

| Operación | Tiempo de espera configurado |
| --- | --- |
| Obtener CAPTCHA | 45 segundos |
| Verificar intranet | 120 segundos |
| Iniciar Google, consultar estado y operaciones de sesión | 15 segundos |

No aplicar un timeout corto de cinco o diez segundos a la verificación de
intranet. Un timeout del cliente no garantiza que el servidor haya cancelado la
operación. No reenviar automáticamente credenciales con el mismo CAPTCHA ni
repetir automáticamente la renovación: las transacciones y los tokens pueden
haber sido consumidos aunque la respuesta no haya llegado.

El cliente HTTP debe aplicar estas reglas en este orden:

1. Distinguir fallo de transporte y timeout de una respuesta HTTP recibida.
2. Si recibe `204`, terminar sin ejecutar `jsonDecode`.
3. Decodificar los bytes JSON como UTF-8. Si recibe HTML o un JSON mal formado,
   informar `RESPUESTA_INVALIDA`; puede ser una URL equivocada o una respuesta
   del proxy, no necesariamente credenciales incorrectas.
4. En HTTP no exitoso, leer `error.codigo` y `error.mensaje`. Conservar también
   el estado HTTP; no intentar convertir esta respuesta a un modelo de éxito.
5. En éxito JSON, comprobar que `datos` es un objeto antes de deserializarlo.
   Leer las propiedades dentro de `datos`, no desde la raíz.
6. Validar propiedades y tipos; convertir una incompatibilidad del contrato en
   un error identificable. No dejar que un `TypeError` o `FormatException`
   termine únicamente en «Ocurrió un error inesperado al iniciar sesión».

En desarrollo registrar sólo etapa, método, ruta sin query, estado HTTP,
código de error y tipo de excepción. No registrar cuerpos, contraseñas,
CAPTCHA, tokens, UUID temporales ni URLs completas de OAuth.

## Tipos de datos

| Tipo del contrato | Tipo JSON | Tipo recomendado en Dart | Regla |
| --- | --- | --- | --- |
| Texto | `string` | `String` | No convertir silenciosamente a otro tipo. |
| UUID | `string` | `String` | Identificador con formato UUID. |
| Fecha | `string` | `DateTime` | ISO 8601 con zona horaria; usar `DateTime.parse`. |
| URL | `string` | `Uri` | URL absoluta entregada por el backend. |
| Base64 | `string` | `String` | Decodificar con `base64Decode` sólo para mostrar la imagen. |
| Entero | `number` entero | `int` | No contiene decimales. |
| Lista de textos | `array<string>` | `List<String>` | Puede contener más de un rol. |

Las fechas pueden terminar en `Z` o incluir un desplazamiento, por ejemplo
`2026-09-17T15:30:00.000Z`.

## Política de roles

La aplicación actual de estudiante permite los roles `ESTUDIANTE`, `DOCENTE` y
`TRABAJADOR`. El flujo dual de intranet y Google crea o vincula una identidad
con el rol `ESTUDIANTE`.

La API crea la sesión después de autenticar la identidad, pero el cliente debe
verificar que la respuesta tenga al menos uno de los roles permitidos por esta
aplicación. Si no lo tiene, debe eliminar la sesión local y cerrar la sesión
remota cuando sea posible.

## Flujo de login del estudiante

El login no usa un formulario de código/correo y contraseña local. El flujo es:

1. Solicitar un CAPTCHA de la intranet.
2. Mostrar la imagen y enviar el código institucional, la contraseña numérica
   de intranet y la respuesta del CAPTCHA.
3. Abrir en el navegador externo la URL de autorización de Google Workspace.
4. Consultar periódicamente el estado de la transacción Google.
5. Adoptar la sesión recibida cuando el estado sea `COMPLETA`.

El navegador vuelve al backend, no a una ruta de Flutter. La aplicación no
recibe ni guarda el `client_secret` de Google.

### Estados mínimos de la pantalla

| Estado | Comportamiento requerido |
| --- | --- |
| Cargando CAPTCHA | Solicitarlo al entrar a la pantalla; mostrar progreso y deshabilitar verificar. |
| CAPTCHA listo | Mostrar la imagen, conservar su UUID y vencimiento en memoria y permitir completar el formulario. |
| Fallo al cargar CAPTCHA | Mostrar el motivo y un botón para reintentar; no habilitar verificar sin imagen y UUID vigentes. |
| Verificando intranet | Deshabilitar doble envío y cambio de imagen; mostrar progreso hasta que termine la petición. |
| Intranet verificada | Conservar `verificacion_intranet_id`; pasar a preparar la autorización Google. No solicitar otro CAPTCHA por el éxito de este paso. |
| Google preparado | Conservar UUID, URL y vencimiento Google en memoria; habilitar un botón explícito «Continuar con Google». |
| Esperando Google | Mantener la pantalla Flutter abierta, consultar estado sin peticiones simultáneas y permitir reabrir la misma URL mientras siga vigente. |
| Sesión recibida | Detener polling, validar roles, guardar la sesión y navegar al inicio. |
| Error o vencimiento | Detener la operación correspondiente, mostrar el motivo y permitir reiniciar desde el paso válido. |

Mantener separados los UUID del CAPTCHA, de la verificación de intranet y de
Google. Aunque todos son UUID, no son intercambiables. Al cambiar de imagen,
reemplazar juntos imagen, UUID y vencimiento, y limpiar el texto del CAPTCHA.
No solicitar un CAPTCHA desde `build()`: hacerlo una vez al iniciar la pantalla
y después sólo por reintento explícito. Evitar peticiones simultáneas y descartar
respuestas antiguas al abandonar o reiniciar el flujo.

### 1. Obtener CAPTCHA de intranet

```http
GET /api/registro-estudiante/intranet/captcha
```

Autenticación: ninguna.

Petición:

- Cuerpo: ninguno.
- Parámetros de ruta: ninguno.
- Parámetros de consulta: ninguno.

Respuesta exitosa: `200 OK`.

```json
{
  "datos": {
    "transaccion_id": "0664b410-145e-4ef3-8d98-1055d8d57ee9",
    "imagen_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
    "tipo_imagen": "image/png",
    "expira_en": "2026-09-17T15:35:00.000Z"
  }
}
```

| Propiedad | Tipo | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `datos` | `object` | Sí | Resultado de la operación. |
| `datos.transaccion_id` | `string` UUID | Sí | Transacción que debe enviarse al endpoint de verificación. |
| `datos.imagen_base64` | `string` Base64 | Sí | Bytes de la imagen CAPTCHA codificados en Base64. |
| `datos.tipo_imagen` | `string` | Sí | MIME de la imagen; actualmente `image/png`. |
| `datos.expira_en` | `string` ISO 8601 | Sí | Fecha límite para usar esta transacción. |

La transacción de CAPTCHA dura aproximadamente cinco minutos y sólo puede
usarse una vez. Después de enviar la verificación, incluso si falla, se debe
solicitar una imagen nueva.

Esto se refiere a una verificación que entra al servicio de intranet; una
petición rechazada por validación de cuerpo (`400`) no llega a ese servicio.
Ante un timeout o pérdida de conexión no se sabe si el servidor consumió el
CAPTCHA: descartar el anterior y obtener otro antes de reenviar. Si la
verificación fue exitosa, avanzar a Google sin repetir la verificación.

`imagen_base64` contiene Base64 puro, **sin** prefijo `data:image/png;base64,`.
Para mostrarlo en Flutter, incluida la ejecución en Chrome:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';

Widget construirImagenCaptcha(Map<String, dynamic> datos) {
  final bytes = base64Decode(datos['imagen_base64'] as String);
  return Image.memory(
    bytes,
    height: 70,
    filterQuality: FilterQuality.none,
    errorBuilder: (context, error, stackTrace) =>
        const Text('No se pudo mostrar el CAPTCHA. Solicita otro.'),
  );
}
```

Pasar `respuesta['datos']` a esta función, después de validar el contrato.
No usar `Image.network(imagen_base64)`: ese valor no es una URL. Si la imagen no
aparece, revisar primero la petición del CAPTCHA y luego su decodificación;
no continuar con un formulario que sólo muestre el campo de texto del CAPTCHA.

Errores relevantes:

| HTTP | Código | Tratamiento en Flutter |
| --- | --- | --- |
| `429` | `INTRANET_SATURADA` | Informar que hay demasiadas verificaciones y permitir reintentar. |
| `503` | `INTRANET_NO_DISPONIBLE` | Informar que la intranet no está disponible. |
| `500` | `ERROR_INTERNO` | Mostrar error genérico y permitir reintentar. |

### 2. Verificar credenciales de intranet

```http
POST /api/registro-estudiante/intranet/verificar
```

Autenticación: ninguna.

Cabeceras:

```http
Accept: application/json
Content-Type: application/json
```

Cuerpo obligatorio:

```json
{
  "transaccion_id": "0664b410-145e-4ef3-8d98-1055d8d57ee9",
  "codigo": "2022074266",
  "contrasena": "123456",
  "captcha": "3868"
}
```

| Propiedad | Tipo | Restricciones |
| --- | --- | --- |
| `transaccion_id` | `string` UUID | Debe ser el UUID entregado por el CAPTCHA vigente. |
| `codigo` | `string` | Exactamente 10 dígitos. Ejemplo: `2022074266`. |
| `contrasena` | `string` | Entre 1 y 6 caracteres, todos numéricos. Es la contraseña de intranet, no una contraseña local de Flutter. |
| `captcha` | `string` | Entre 1 y 5 caracteres, todos numéricos. |

Respuesta exitosa: `200 OK`.

```json
{
  "datos": {
    "codigo": "2022074266",
    "nombre_apellidos": "AYALA RAMOS, CARLOS DANIEL",
    "verificacion_intranet_id": "8bcdbcea-0682-4c77-a828-21855d6bcdfa",
    "verificacion_expira_en": "2026-09-17T15:40:00.000Z"
  }
}
```

| Propiedad | Tipo | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `datos.codigo` | `string` | Sí | Código de 10 dígitos confirmado por la intranet. |
| `datos.nombre_apellidos` | `string` | Sí | Nombre devuelto por la intranet, normalmente `APELLIDOS, NOMBRES`. |
| `datos.verificacion_intranet_id` | `string` UUID | Sí | Identificador temporal para iniciar Google. |
| `datos.verificacion_expira_en` | `string` ISO 8601 | Sí | La autorización temporal dura aproximadamente diez minutos. |

La aplicación debe borrar de memoria la contraseña y el CAPTCHA después de
usar la petición. No debe guardar ninguno de los dos valores en almacenamiento
local.

Errores relevantes:

| HTTP | Código | Motivo |
| --- | --- | --- |
| `400` | `DATOS_INVALIDOS` | Tipo, formato, longitud o propiedades del cuerpo incorrectos. |
| `401` | `CREDENCIALES_INTRANET_INVALIDAS` | Código, contraseña o CAPTCHA no válidos. |
| `410` | `CAPTCHA_EXPIRADO` | La transacción ya venció o ya fue consumida. Solicitar otro CAPTCHA. |
| `422` | `NAVEGACION_INTRANET_INVALIDA` | La intranet no mostró el perfil esperado. |
| `422` | `PERFIL_INTRANET_NO_ENCONTRADO` | Se inició sesión, pero no se pudo obtener el perfil. |
| `422` | `CODIGO_INTRANET_NO_COINCIDE` | El código devuelto no coincide con el enviado. |
| `503` | `INTRANET_NO_DISPONIBLE` | La intranet o el navegador del backend no pudo completar la consulta. |

### 3. Iniciar autorización con Google Workspace

```http
POST /api/registro-estudiante/google/iniciar
```

Autenticación: ninguna.

Cuerpo obligatorio:

```json
{
  "verificacion_intranet_id": "8bcdbcea-0682-4c77-a828-21855d6bcdfa"
}
```

| Propiedad | Tipo | Restricciones |
| --- | --- | --- |
| `verificacion_intranet_id` | `string` UUID | Debe ser la verificación vigente recibida del endpoint anterior. |

Respuesta exitosa: `201 Created`.

```json
{
  "datos": {
    "transaccion_id": "b46b2f2d-89e2-437b-aa27-10cb3b8f493c",
    "url_autorizacion": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "expira_en": "2026-09-17T15:50:00.000Z"
  }
}
```

| Propiedad | Tipo | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `datos.transaccion_id` | `string` UUID | Sí | Identificador que se usará al consultar el estado. |
| `datos.url_autorizacion` | `string` URL absoluta | Sí | URL completa que se debe abrir en el navegador externo. |
| `datos.expira_en` | `string` ISO 8601 | Sí | Tiempo máximo aproximado de la operación: diez minutos. |

La app debe abrir exactamente `url_autorizacion` con el navegador del sistema.
No debe reconstruir la URL, añadir parámetros, abrir Google con credenciales
propias ni intentar manejar el `code` OAuth dentro de Flutter.

En Flutter Web, seguir la sección «Chrome y Flutter Web» para abrir una pestaña
desde una interacción del usuario. El callback sigue perteneciendo al backend;
no hace falta implementar Google Sign-In en Flutter para este contrato.

Errores relevantes:

| HTTP | Código | Motivo |
| --- | --- | --- |
| `400` | `DATOS_INVALIDOS` | El UUID no tiene el formato esperado. |
| `410` | `VERIFICACION_INTRANET_EXPIRADA` | Se debe reiniciar el flujo desde un CAPTCHA nuevo. |
| `429` | `GOOGLE_OAUTH_SATURADO` | Hay demasiadas verificaciones Google en curso. |
| `503` | `GOOGLE_OAUTH_NO_CONFIGURADO` | El backend no tiene configurado Google Workspace. |

### 4. Callback de Google controlado por el backend

```http
GET /api/registro-estudiante/google/callback
```

Este endpoint no lo llama directamente Flutter. Google lo llama en el
navegador usando la URL configurada por el backend.

Parámetros de consulta que puede enviar Google:

| Parámetro | Tipo | Presencia | Descripción |
| --- | --- | --- | --- |
| `state` | `string` | Normalmente sí | Estado OAuth que vincula el callback con la transacción iniciada. |
| `code` | `string` | En éxito | Código temporal entregado por Google. |
| `error` | `string` | En cancelación o rechazo | Motivo de error OAuth. |

El backend procesa esos valores, valida estado, PKCE, nonce, dominio
`virtual.upt.pe`, correo, código y nombre. Después responde con `303 See Other`
al endpoint HTML:

```text
/api/registro-estudiante/google/resultado?estado=correcto
/api/registro-estudiante/google/resultado?estado=error
```

La aplicación no debe esperar tokens en la URL del navegador ni registrar la
URL completa, porque puede contener datos temporales de OAuth.

### 5. Página de resultado del callback

```http
GET /api/registro-estudiante/google/resultado?estado=correcto|error
```

Este endpoint tampoco lo llama Flutter mediante el cliente JSON. Devuelve
`200 OK` con una página HTML breve para el navegador:

- `estado=correcto`: indica que la identidad fue verificada y que se puede
  cerrar la pestaña.
- `estado=error`: indica que la verificación no se completó y que se debe
  volver a la aplicación para consultar el motivo.

La sesión se obtiene desde el siguiente endpoint de consulta de estado.

### 6. Consultar el estado de Google

```http
GET /api/registro-estudiante/google/estado/{transaccion_id}
```

Autenticación: ninguna.

| Parámetro | Tipo | Restricciones |
| --- | --- | --- |
| `transaccion_id` | `string` UUID | Es el UUID recibido en `google/iniciar`. |

Respuestas pendientes: `200 OK`.

```json
{
  "datos": {
    "estado": "PENDIENTE"
  }
}
```

```json
{
  "datos": {
    "estado": "PROCESANDO"
  }
}
```

Valores posibles de `datos.estado`:

| Estado | Tipo de respuesta | Acción de Flutter |
| --- | --- | --- |
| `PENDIENTE` | `estado: string` | Esperar y consultar de nuevo. |
| `PROCESANDO` | `estado: string` | Esperar y consultar de nuevo. |
| `COMPLETA` | Incluye `sesion: object` | Adoptar la sesión y finalizar el polling. |
| `ERROR` | Incluye `error: object` | Mostrar el error y finalizar el polling. |

Respuesta completa:

```json
{
  "datos": {
    "estado": "COMPLETA",
    "sesion": {
      "tipo_token": "Bearer",
      "token_acceso": "upt_acceso_...",
      "token_renovacion": "upt_renovacion_...",
      "token_acceso_expira_en": "2026-09-17T15:55:00.000Z",
      "token_renovacion_expira_en": "2026-09-24T15:50:00.000Z",
      "usuario": {
        "id": 10,
        "codigo_institucional": "2022074266",
        "correo_institucional": "ca2022074266@virtual.upt.pe",
        "nombres": "CARLOS DANIEL",
        "apellidos": "AYALA RAMOS",
        "roles": ["ESTUDIANTE"]
      }
    }
  }
}
```

Respuesta con error de negocio OAuth:

```json
{
  "datos": {
    "estado": "ERROR",
    "error": {
      "codigo": "GOOGLE_DOMINIO_NO_AUTORIZADO",
      "mensaje": "Sólo se admiten cuentas Google Workspace de virtual.upt.pe."
    }
  }
}
```

Cuando el estado sea `COMPLETA`, la consulta consume la transacción. No se
debe volver a consultar ese UUID después de adoptar la sesión. El polling debe
esperar al menos dos segundos entre peticiones, sin consultas simultáneas, y
detenerse al llegar a `expira_en`. Volver a comprobar el vencimiento después de
la espera y antes de enviar cada petición. Detenerse también en `ERROR`, al
reiniciar el flujo o al destruir el controlador.

No usar `Timer.periodic` con callbacks HTTP que puedan solaparse. La primera
respuesta `COMPLETA` consume la transacción: si su respuesta se pierde o el
guardado local falla, una nueva consulta puede devolver `410` y no recuperará
la sesión. No prometer recuperación automática de una transacción consumida.

Errores HTTP relevantes:

| HTTP | Código | Motivo |
| --- | --- | --- |
| `400` | `DATOS_INVALIDOS` | El parámetro no es un UUID válido. |
| `410` | `GOOGLE_OAUTH_EXPIRADO` | La transacción expiró o ya fue consumida. |

Los errores devueltos dentro de `datos.error` pueden incluir:
`GOOGLE_OAUTH_CANCELADO`, `GOOGLE_OAUTH_RESPUESTA_INVALIDA`,
`GOOGLE_ID_TOKEN_AUSENTE`, `GOOGLE_ID_TOKEN_INVALIDO`,
`GOOGLE_CORREO_NO_VERIFICADO`, `GOOGLE_DOMINIO_NO_AUTORIZADO`,
`GOOGLE_CORREO_NO_AUTORIZADO`, `GOOGLE_PERFIL_INCOMPLETO`,
`CORREO_INSTITUCIONAL_INVALIDO`, `CODIGO_INTRANET_INVALIDO`,
`CODIGOS_NO_COINCIDEN`, `NOMBRE_INTRANET_INVALIDO`,
`NOMBRES_NO_COINCIDEN` e `IDENTIDAD_INSTITUCIONAL_EN_CONFLICTO`.

## Modelo de sesión recibido

El objeto `sesion` recibido desde Google tiene esta forma y también es la
forma devuelta por el endpoint de renovación:

| Propiedad | Tipo | Obligatoria | Uso |
| --- | --- | --- | --- |
| `tipo_token` | `string` | Sí | Valor actual: `Bearer`. |
| `token_acceso` | `string` | Sí | Token opaco para `Authorization: Bearer`. |
| `token_renovacion` | `string` | Sí | Token opaco que se envía sólo al endpoint de renovación. |
| `token_acceso_expira_en` | `string` ISO 8601 | Sí | Vencimiento; duración predeterminada: 15 minutos. |
| `token_renovacion_expira_en` | `string` ISO 8601 | Sí | Vencimiento; duración predeterminada: 7 días. |
| `usuario` | `object` | Sí | Datos públicos mínimos del usuario autenticado. |

`usuario` contiene:

| Propiedad | Tipo | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `number` entero | Sí | Identificador interno del usuario. |
| `codigo_institucional` | `string` | Sí | Código institucional de 10 dígitos para estudiantes. |
| `correo_institucional` | `string` | Sí | Correo institucional confirmado. |
| `nombres` | `string` | Sí | Nombres del usuario. |
| `apellidos` | `string` | Sí | Apellidos del usuario. |
| `roles` | `array<string>` | Sí | Roles asignados, por ejemplo `["ESTUDIANTE"]`. |

Nunca se devuelven `contrasena`, `contrasena_hash`, `google_sub`, tokens
decodificables ni credenciales internas.

## Mantenimiento de la sesión

### 7. Renovar sesión

```http
POST /api/autenticacion/renovar-sesion
```

Autenticación: no usa `Authorization`; el token va en el cuerpo.

Cabeceras:

```http
Accept: application/json
Content-Type: application/json
```

Cuerpo:

```json
{
  "token_renovacion": "upt_renovacion_..."
}
```

| Propiedad | Tipo | Restricciones |
| --- | --- | --- |
| `token_renovacion` | `string` | Se recorta, debe medir entre 40 y 200 caracteres y ser el último token recibido. |

Respuesta exitosa: `200 OK` con el mismo modelo `sesion` descrito arriba.
La API rota ambos tokens. El token de acceso y el token de renovación
anteriores quedan inválidos inmediatamente, por lo que se deben reemplazar
juntos en el almacenamiento seguro.

Errores relevantes:

| HTTP | Código | Acción |
| --- | --- | --- |
| `400` | `DATOS_INVALIDOS` | Borrar la sesión local si el cuerpo no es válido. |
| `401` | `TOKEN_RENOVACION_INVALIDO` | Borrar la sesión local y mostrar el login. |
| `403` | `USUARIO_NO_HABILITADO` | Borrar la sesión local e informar que la cuenta está deshabilitada. |

### 8. Consultar la sesión actual

```http
GET /api/autenticacion/sesion
```

Autenticación: token de acceso Bearer.

Petición:

```http
Authorization: Bearer upt_acceso_...
Accept: application/json
```

Respuesta exitosa: `200 OK`.

```json
{
  "datos": {
    "usuario": {
      "id": 10,
      "codigo_institucional": "2022074266",
      "correo_institucional": "ca2022074266@virtual.upt.pe",
      "nombres": "CARLOS DANIEL",
      "apellidos": "AYALA RAMOS",
      "roles": ["ESTUDIANTE"]
    }
  }
}
```

La aplicación debe usar esta ruta al restaurar una sesión cuyo token de acceso
siga vigente. Si el acceso está cerca de vencer, debe renovar primero con el
token de renovación.

Errores relevantes:

| HTTP | Código | Acción |
| --- | --- | --- |
| `401` | `AUTENTICACION_REQUERIDA` | Falta la cabecera Bearer; borrar la sesión local. |
| `401` | `TOKEN_ACCESO_INVALIDO` | Token vencido, revocado o inexistente; intentar renovar o mostrar login. |
| `403` | `USUARIO_NO_HABILITADO` | La cuenta dejó de estar activa o autorizada; borrar la sesión local. |

### 9. Cerrar sesión

```http
POST /api/autenticacion/cerrar-sesion
```

Autenticación: token de acceso Bearer.

Petición:

```http
Authorization: Bearer upt_acceso_...
Accept: application/json
```

Cuerpo: ninguno.

Respuesta exitosa: `204 No Content`, sin cuerpo JSON.

La app debe borrar siempre la sesión del almacenamiento seguro, aunque la red
no esté disponible. Si la petición llega al backend, el token queda revocado.

## Reglas de almacenamiento y estados de Flutter

- Guardar `token_acceso`, `token_renovacion` y ambas fechas en almacenamiento
  seguro del dispositivo.
- No guardar contraseña de intranet, CAPTCHA, `url_autorizacion` ni el código
  OAuth.
- Al iniciar, restaurar la sesión desde almacenamiento seguro.
- Si el token de renovación venció, eliminar la sesión sin hacer llamadas
  protegidas.
- Renovar antes de usar un token de acceso vencido y reemplazar ambos tokens de
  forma atómica.
- Ante `CREDENCIALES_INTRANET_INVALIDAS`, `CAPTCHA_EXPIRADO` o un error de
  Google, volver al paso correspondiente sin reutilizar transacciones.
- Ante un error de red, conservar una sesión todavía válida y permitir
  reintentar; ante un token inválido, eliminarla.

## Android: Google confirma la identidad, pero Flutter muestra un error

La página HTML «Identidad verificada» es el resultado esperado del callback;
no es un error ni una redirección pendiente hacia Flutter. En el backend actual,
el callback marca `COMPLETA` después de vincular la identidad y crear la sesión.
La página no entrega tokens a la aplicación: Flutter debe recogerlos mediante
`GET /api/registro-estudiante/google/estado/{transaccion_id}`. No usar la página
HTML de resultado como una respuesta JSON ni como comprobación de la sesión.

Si se ve esa página y, al volver, la app muestra «No se pudo conectar con el
servicio», investigar la etapa posterior a la apertura de Google. El texto del
cliente no demuestra una pérdida de conexión. El navegador y la app realizan
peticiones por separado; que uno acceda a la API no garantiza que el otro esté
usando la misma URL, tenga permiso de red o haya leído correctamente el JSON.

### Conservar y consultar la transacción correcta

1. Guardar en el controlador `transaccion_id` y `expira_en` devueltos por
   **`google/iniciar`**, antes de abrir el navegador. No usar el UUID del
   CAPTCHA, `verificacion_intranet_id` ni el parámetro OAuth `state`.
2. Abrir Google sin cerrar/reemplazar la pantalla Flutter ni destruir su
   controlador. `await launchUrl(...)` informa del lanzamiento; no espera a
   que el usuario termine de autenticarse.
3. Mantener un único coordinador de consultas de estado. Al abrir una actividad
   de navegador externo, Android puede poner Flutter en segundo plano. Si la
   app pausa sus consultas, retomarlas al recibir `AppLifecycleState.resumed`,
   comprobando primero el vencimiento y que no haya una petición en curso.
4. No crear un segundo bucle al volver del navegador. El callback de ciclo de
   vida y el bucle existente deben compartir el control de exclusión y la
   condición de finalización; respetar al menos dos segundos entre peticiones.
5. En `COMPLETA`, detener consultas **antes** de esperar el guardado o la
   navegación. Leer la sesión de `respuesta['datos']['sesion']`, validar roles,
   guardarla y navegar. No llamar a `renovar-sesion` como paso obligatorio:
   ya se recibió una sesión nueva.
6. En un fallo de guardado, conservar el diagnóstico de almacenamiento. No
   volver a consultar la transacción consumida para intentar obtener tokens.

Si el sistema termina el proceso Flutter mientras está abierto el navegador,
el estado que sólo estaba en memoria se pierde. Sin una estrategia explícita
de recuperación del UUID Google y vencimiento, reiniciar el flujo y explicar
lo sucedido; no prometer restauración automática. No persistir contraseña,
CAPTCHA ni URL OAuth como solución.

Referencia: [ciclo de vida oficial de Flutter](https://api.flutter.dev/flutter/dart-ui/AppLifecycleState.html).

### Distinguir red, contrato y almacenamiento

En Android, revisar la salida de `flutter run` / consola Debug del IDE; F12 de
Chrome no muestra las peticiones de una aplicación Flutter nativa. Registrar
etapas separadas: `consulta_estado_google`, `lectura_sesion`, `guardado_sesion`
y `navegacion`, con HTTP/código o tipo de excepción y sin cuerpos ni tokens.

| Resultado de la consulta de estado | Interpretación y acción |
| --- | --- |
| `200`, `PENDIENTE` / `PROCESANDO` | Seguir esperando dentro del plazo. |
| `200`, `COMPLETA` | Detener consultas y procesar `datos.sesion`. Si luego falla, revisar modelo, roles, almacenamiento o navegación. |
| `200`, `ERROR` | Mostrar `datos.error`; no convertirlo a «sin conexión». |
| `400` | Revisar UUID y ruta. |
| `410`, `GOOGLE_OAUTH_EXPIRADO` | Puede haber vencido, haberse consumido por otra consulta o haberse perdido el estado del servidor. No significa necesariamente «sin conexión». |
| Sin respuesta HTTP, `ClientException` o `SocketException` | Revisar URL efectiva, permiso de Internet, DNS, TLS y conexión de la app/emulador. |
| `FormatException` o `TypeError` | Revisar JSON/modelo, no atribuir automáticamente el fallo a la red. |
| Excepción del almacenamiento después de `COMPLETA` | Autenticación y guardado son etapas distintas; mostrar un error de guardado. |

El backend actual mantiene las transacciones temporales de intranet y Google
en memoria del proceso. Un reinicio las pierde; varias réplicas sin afinidad
pueden atender una consulta en un proceso que no conoce el UUID. Si se observa
`410` antes del vencimiento y se descartaron consultas duplicadas, revisar
reinicios/réplicas del despliegue. Esta es una limitación del backend actual,
no una prueba de que esa sea la causa en un caso concreto.

En un proyecto Android independiente, incluir dentro de `<manifest>` y fuera
de `<application>` en `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

Usar la URL HTTPS publicada para estas pruebas. Si sólo se configura el permiso
en los manifiestos de debug/profile, no se aplica necesariamente al APK release.
CORS corresponde a clientes de navegador; no es el mecanismo que bloquea las
peticiones de una app Android nativa.

Referencia: [permiso Android para peticiones HTTP en Flutter](https://docs.flutter.dev/cookbook/networking/fetch-data).

## Chrome y Flutter Web

Ejecutar en Chrome es una opción válida, pero requiere tratar estas diferencias
respecto de una app nativa:

### CORS y conexión con la API

El origen incluye esquema, host y puerto: `http://localhost:63155` es distinto
de `http://localhost:3000` y de `http://127.0.0.1:63155`. El navegador exige que
la API autorice las peticiones entre esos orígenes. El backend usa
`cors({ origin: entorno.corsOrigin })`; `CORS_ORIGIN` tiene `*` como valor
predeterminado. En su configuración actual se lee como un único texto, no como
una lista de orígenes separados por comas.

Este contrato transporta tokens mediante Bearer y JSON; no requiere cookies
entre orígenes. No activar `BrowserClient.withCredentials = true`: un origen
permitido con `*` no admite peticiones con ese modo de credenciales.

El preflight `OPTIONS` de un POST JSON debe permitir el origen, el método y
`content-type`; las llamadas protegidas también requieren `authorization`.
Una respuesta visible en curl/Postman no confirma por sí sola que Chrome podrá
leerla. CORS se configura en la API/proxy, no añadiendo
`Access-Control-Allow-Origin` a la petición Flutter. Usar API HTTPS cuando la
app Web se publique bajo HTTPS.

Comprobación sin credenciales desde una terminal (`curl.exe` en PowerShell):

```bash
curl -i -X OPTIONS 'https://api-moviles.fottuto.men/api/registro-estudiante/intranet/verificar' -H 'Origin: http://localhost:63155' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type'
```

El 18 de septiembre de 2026, esta comprobación contra la API publicada devolvió
`204`, `Access-Control-Allow-Origin: *`, métodos que incluyen `POST` y permiso
para `content-type`. Es evidencia del preflight en ese momento; no demuestra
que el CAPTCHA, las credenciales o Google funcionen, ni que el proyecto externo
esté usando esta URL o estas cabeceras.

Referencia: [documentación Flutter sobre peticiones entre orígenes](https://docs.flutter.dev/platform-integration/web/web-images).

### Abrir Google sin perder la aplicación

En Web, hacer `await verificarIntranet()`, `await iniciarGoogle()` y luego
`launchUrl()` dentro del mismo botón puede perder la activación temporal del
usuario y bloquear la nueva pestaña. Preparar la URL primero y, cuando esté
lista, mostrar un botón para abrirla. Su callback debe invocar `launchUrl`
directamente, antes de esperar otra petición:

```dart
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

Future<bool> abrirGooglePreparado(Uri url) {
  return launchUrl(
    url,
    mode: kIsWeb
        ? LaunchMode.platformDefault
        : LaunchMode.externalApplication,
    webOnlyWindowName: '_blank',
  );
}
```

El botón debe recibir la URL ya obtenida de `google/iniciar`. Mantener la
pestaña Flutter original para hacer polling. No usar `_self` sin implementar
restauración: al navegar al backend se descarga la aplicación y se pierde el
controlador que consulta el estado. No guardar la URL OAuth para resolverlo.
En Web, que `launchUrl` devuelva `true` no garantiza que la pestaña se abrió;
mostrar también la opción de volver a abrir Google y revisar el indicador de
pestañas bloqueadas del navegador.

Referencia: [limitaciones oficiales de url_launcher_web](https://pub.dev/documentation/url_launcher_web/latest/).

### Almacenamiento de sesión en Web

`flutter_secure_storage` requiere HTTPS o localhost en Web. Inicializar Flutter
con `WidgetsFlutterBinding.ensureInitialized()` antes de usar plugins fuera de
la construcción de la app. Manejar por separado fallos de autenticación y de
lectura/guardado de sesión. Un fallo al guardar después de `COMPLETA` no significa
que las credenciales sean incorrectas.

Mantener fijo `--web-port` durante desarrollo: el almacenamiento del navegador
pertenece al origen y cambiar de puerto puede hacer que una sesión guardada
deje de estar disponible para la nueva ejecución.

Referencia: [configuración oficial de flutter_secure_storage](https://pub.dev/packages/flutter_secure_storage).

## Diagnóstico de «Ocurrió un error inesperado al iniciar sesión»

Ese texto es del cliente y no identifica una causa. En Chrome abrir **F12 →
Network**, activar **Preserve log** y filtrar por `registro-estudiante`. Abrir
también **Console**. Reproducir el problema y localizar la **primera** etapa que
falla; no asumir que llegó a Google por el texto del botón.

| Evidencia | Revisar / corregir |
| --- | --- |
| No aparece GET `intranet/captcha` | Inicialización de la pantalla; debe cargar antes de verificar. |
| Petición a `localhost:63155`, `/api/api/...` o una ruta sin `/api` | Construcción de URL y valor de `URL_API_UPT`. |
| `ERR_CONNECTION_REFUSED` | Se intenta usar una API local apagada o en otra máquina/puerto. |
| Console indica CORS y falla `OPTIONS` | Origen permitido, cabeceras, configuración de API/proxy y modo de credenciales del cliente. |
| Console indica mixed content o error TLS | Usar API HTTPS válida; revisar certificado y URL. |
| CAPTCHA responde `503 INTRANET_NO_DISPONIBLE` | Intranet o navegador del servidor; cambiar Chrome por Android no resuelve ese fallo del backend. |
| CAPTCHA responde `200`, pero no se ve la imagen | Leer `datos.imagen_base64`, usar `base64Decode` + `Image.memory` y revisar errores de formato. |
| Verificación responde `400 DATOS_INVALIDOS` | JSON estricto, nombres exactos y valores como String; no enviar números ni claves adicionales. |
| Verificación responde `401` o `410` | Mostrar `error.mensaje`, descartar CAPTCHA consumido/vencido y solicitar otro. |
| Cliente agota la espera durante intranet | Aplicar los tiempos específicos anteriores; descartar el CAPTCHA antes de reenviar. |
| `google/iniciar` responde `201`, pero no se abre Google | Preparar URL y abrir con un segundo clic directo; revisar bloqueo de pestañas. |
| Estado Google responde `200` con `datos.estado = ERROR` | Leer `datos.error`; es distinto de un error HTTP en la raíz. |
| Estado devuelve `COMPLETA` y luego falla la app | Modelo `datos.sesion`, roles, almacenamiento y navegación; detener consultas duplicadas. |
| `TypeError`, `FormatException` o fallo de plugin | Deserialización, respuesta HTML/JSON inesperada o configuración del plugin. Conservar la etapa en el diagnóstico. |

Para investigar un proyecto independiente se necesitan la ruta fallida, su
estado HTTP y código/mensaje de error, o el tipo de excepción si no hubo
respuesta. Compartir esos datos y el código del cliente/controlador sin
credenciales ni tokens. La captura del aviso genérico por sí sola no permite
confirmar si el fallo se debe a Chrome.

## Prompt para un agente de código

```text
Actúa como un agente senior de Flutter y construye la aplicación de login de
estudiante para el proyecto seguridad_estudiante, usando exclusivamente el
contrato de ENDPOINTS_LOGIN_ESTUDIANTE.md y el backend ya existente.

Implementa el flujo institucional completo:

1. GET /api/registro-estudiante/intranet/captcha para cargar y mostrar la
   imagen Base64 usando el MIME recibido.
2. POST /api/registro-estudiante/intranet/verificar con
   transaccion_id, codigo de exactamente 10 dígitos, contrasena numérica de 1
   a 6 caracteres y captcha numérico de 1 a 5 caracteres.
3. POST /api/registro-estudiante/google/iniciar con
   verificacion_intranet_id.
4. Abre url_autorizacion en el navegador externo. No pongas client_secret en
   Flutter ni intentes procesar el callback OAuth dentro de la app.
5. Consulta GET /api/registro-estudiante/google/estado/{transaccion_id} con
   al menos dos segundos entre peticiones, sin solapamientos. Continúa en
   PENDIENTE/PROCESANDO y termina en COMPLETA, ERROR o vencimiento. En
   COMPLETA, adopta la sesión recibida y no vuelvas a consultar ese UUID.
6. Implementa el ciclo de sesión con POST
   /api/autenticacion/renovar-sesion, GET /api/autenticacion/sesion y POST
   /api/autenticacion/cerrar-sesion.

Usa modelos tipados para UUID y textos como String, fechas ISO 8601 como
DateTime, URL como Uri, usuario.roles como List<String> y usuario.id como int.
Respeta los envoltorios datos y error, los códigos HTTP y los códigos de error
del documento. La aplicación acepta los roles ESTUDIANTE, DOCENTE y TRABAJADOR;
rechaza cualquier otra sesión, borra sus tokens y revoca la sesión remota si
es posible.

No construyas un formulario de contraseña local: el login del estudiante usa
intranet y Google. Borra de memoria la contraseña y el CAPTCHA después de
usarlos y nunca los guardes. Persiste sólo la sesión en almacenamiento seguro.
Renueva ambos tokens juntos porque la API rota token_acceso y
token_renovacion simultáneamente. Maneja estados de carga, expiración,
reintentos, errores de conexión y cierre local aunque la red falle.

Organiza el código en modelos, cliente HTTP, servicio/controlador de sesión,
almacenamiento seguro, navegación y pantallas. Lee la URL base desde
URL_API_UPT; usa https en release y permite
http://127.0.0.1:3000/api en desarrollo. No modifiques el backend, no uses
MariaDB y no agregues endpoints inventados.

El proyecto puede ser independiente de este repositorio. Lee URL_API_UPT con
String.fromEnvironment y proporciona el comando flutter run con --dart-define.
La base ya contiene /api: no lo dupliques ni lo elimines al construir rutas.
Usa tiempos de espera de 45 s para CAPTCHA, 120 s para verificar intranet y
15 s para las demás solicitudes. Muestra la imagen antes de habilitar verificar.
Separa los tres UUID temporales y evita doble envío y respuestas obsoletas.

Si se ejecuta en Chrome, sigue la sección Chrome y Flutter Web: no actives
withCredentials para este contrato; prepara la URL Google y abre una nueva
pestaña desde un clic directo posterior, sin await HTTP previo al launchUrl.
Mantén la pestaña Flutter para polling y permite reabrir la URL vigente. No
interpretes true de launchUrl como garantía de apertura en Web. Usa un puerto
Web fijo y configura almacenamiento compatible con HTTPS/localhost.

Distingue error HTTP, error de negocio en datos.error, fallo de conexión,
timeout, respuesta inválida y fallo de almacenamiento. No ocultes todos con
un único catch genérico. Registra en desarrollo etapa, ruta sin query, HTTP,
código y tipo de excepción sin incluir secretos ni identificadores temporales.
No reintentes automáticamente operaciones que consumen CAPTCHA o rotan tokens.

En Android sigue la sección Android: conserva la transacción Google al abrir
el navegador y coordina el regreso a resumed sin crear otro bucle de polling.
Detén consultas antes de guardar COMPLETA. No clasifiques un 410, un error de
deserialización o de almacenamiento como fallo de conexión. Incluye permiso
INTERNET en el manifiesto principal para que también se aplique en release.

Agrega pruebas significativas con MockClient para validar cuerpos, cabeceras,
deserialización, polling y errores. Ejecuta dart format lib test, flutter
analyze y flutter test, y corrige cualquier fallo antes de entregar.
```
