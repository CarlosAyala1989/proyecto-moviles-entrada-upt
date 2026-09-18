# Endpoints de login para la aplicación de seguridad

Este documento describe únicamente los endpoints que la aplicación Flutter de
seguridad necesita para iniciar, restaurar, renovar y cerrar una sesión. No
incluye escaneo QR, validación de ingresos, ubicación, historial ni
administración.

El contrato corresponde al backend existente. La aplicación no debe conectarse
directamente a MariaDB ni decidir permisos de ingreso por su cuenta.

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

Reglas de transporte:

- `POST /autenticacion/iniciar-sesion` es público.
- `POST /autenticacion/renovar-sesion` es público a nivel HTTP, pero exige un
  token de renovación en el JSON.
- `GET /autenticacion/sesion` y `POST /autenticacion/cerrar-sesion` exigen un
  token de acceso Bearer.
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

## Tipos de datos

| Tipo del contrato | Tipo JSON | Tipo recomendado en Dart | Regla |
| --- | --- | --- | --- |
| Texto | `string` | `String` | Se conserva como texto. |
| Fecha | `string` | `DateTime` | ISO 8601 con zona horaria; usar `DateTime.parse`. |
| Entero | `number` entero | `int` | El identificador no tiene decimales. |
| Lista de textos | `array<string>` | `List<String>` | Contiene roles en mayúsculas. |
| Token | `string` | `String` | Opaco; no se debe decodificar ni interpretar. |

Las fechas pueden terminar en `Z` o incluir un desplazamiento, por ejemplo
`2026-09-17T15:30:00.000Z`.

## Política de roles

La aplicación actual de seguridad permite los roles `SEGURIDAD` y
`ADMINISTRADOR`.

El endpoint de inicio de sesión autentica una cuenta habilitada, pero no
recibe un parámetro `rol` y no debe confiar en un rol enviado por Flutter. La
app debe inspeccionar `usuario.roles` después de recibir la sesión y aceptar
sólo esos dos roles. Las operaciones del guardia siguen requiriendo el rol
`SEGURIDAD` en sus propios endpoints; el rol `ADMINISTRADOR` puede abrir el
panel administrativo cuando corresponda.

## 1. Iniciar sesión con credenciales locales

```http
POST /api/autenticacion/iniciar-sesion
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
  "identificador": "PRUEBA-SEG-001",
  "contrasena": "Prueba-Local-UPT!2026"
}
```

| Propiedad | Tipo | Obligatoria | Restricciones |
| --- | --- | --- | --- |
| `identificador` | `string` | Sí | Se recorta; entre 3 y 254 caracteres. Puede ser el código institucional o el correo institucional. |
| `contrasena` | `string` | Sí | Entre 1 y 128 caracteres. Se envía exactamente como la escribió el usuario; no se recorta automáticamente. |

No se debe enviar `rol`, `usuario_id`, `token_acceso`, `token_renovacion` ni
ninguna otra propiedad. El esquema del backend rechaza cuerpos con campos
desconocidos.

Respuesta exitosa: `201 Created`.

```json
{
  "datos": {
    "tipo_token": "Bearer",
    "token_acceso": "upt_acceso_4c2f...",
    "token_renovacion": "upt_renovacion_9a71...",
    "token_acceso_expira_en": "2026-09-17T15:45:00.000Z",
    "token_renovacion_expira_en": "2026-09-24T15:30:00.000Z",
    "usuario": {
      "id": 10,
      "codigo_institucional": "PRUEBA-SEG-001",
      "correo_institucional": "prueba-seg-001@seguridad.example.invalid",
      "nombres": "Usuario",
      "apellidos": "Seguridad",
      "roles": ["SEGURIDAD"]
    }
  }
}
```

### Campos de la respuesta

| Propiedad | Tipo | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `datos` | `object` | Sí | Resultado de la autenticación. |
| `datos.tipo_token` | `string` | Sí | Actualmente siempre `Bearer`. |
| `datos.token_acceso` | `string` | Sí | Token opaco para la cabecera `Authorization`. Tiene duración corta. |
| `datos.token_renovacion` | `string` | Sí | Token opaco para renovar la sesión. Se envía en JSON, no como Bearer. |
| `datos.token_acceso_expira_en` | `string` ISO 8601 | Sí | Vencimiento del token de acceso; predeterminado: 15 minutos. |
| `datos.token_renovacion_expira_en` | `string` ISO 8601 | Sí | Vencimiento del token de renovación; predeterminado: 7 días. |
| `datos.usuario` | `object` | Sí | Identidad pública mínima de la cuenta. |

Campos de `datos.usuario`:

| Propiedad | Tipo | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `number` entero | Sí | Identificador interno del usuario. |
| `codigo_institucional` | `string` | Sí | Código o usuario institucional. |
| `correo_institucional` | `string` | Sí | Correo asociado a la cuenta. |
| `nombres` | `string` | Sí | Nombres del usuario. |
| `apellidos` | `string` | Sí | Apellidos del usuario. |
| `roles` | `array<string>` | Sí | Roles asignados, por ejemplo `["SEGURIDAD"]`. |

La app debe aceptar la sesión sólo si `roles` contiene `SEGURIDAD` o
`ADMINISTRADOR`. Si la cuenta se autentica correctamente pero no tiene ninguno
de esos roles, debe borrar los tokens y, si es posible, llamar a cerrar sesión.

La API sólo permite iniciar sesión a usuarios con `estado=ACTIVO` y
`estado_autorizacion=AUTORIZADO`. El cliente no puede activar una cuenta ni
corregir esos estados.

Errores relevantes:

| HTTP | Código | Motivo y acción |
| --- | --- | --- |
| `400` | `DATOS_INVALIDOS` | El cuerpo no cumple tipos, longitudes o contiene campos extras. Validar el formulario. |
| `400` | `JSON_INVALIDO` | El cuerpo no es JSON válido. Corregir el serializado. |
| `401` | `CREDENCIALES_INVALIDAS` | El identificador o la contraseña no son válidos. Mostrar un mensaje genérico. |
| `403` | `USUARIO_NO_HABILITADO` | La cuenta está inactiva o no autorizada. Informar y no reintentar automáticamente. |
| `429` | `INICIO_SESION_BLOQUEADO` | Se alcanzó el límite de intentos fallidos. Esperar el tiempo indicado por soporte. |
| `415` | `TIPO_CONTENIDO_NO_ADMITIDO` | La petición no usó `application/json`. |
| `500` | `ERROR_INTERNO` | Mostrar error genérico y permitir reintentar. |

El backend usa por defecto cinco intentos fallidos antes de un bloqueo de
aproximadamente quince minutos. Estos valores pueden cambiar mediante la
configuración del servidor; la app no debe asumirlos para calcular un contador
local.

## 2. Renovar sesión

```http
POST /api/autenticacion/renovar-sesion
```

Autenticación: no usa `Authorization`; el token va en el cuerpo.

Cabeceras:

```http
Accept: application/json
Content-Type: application/json
```

Cuerpo obligatorio:

```json
{
  "token_renovacion": "upt_renovacion_9a71..."
}
```

| Propiedad | Tipo | Restricciones |
| --- | --- | --- |
| `token_renovacion` | `string` | Se recorta; entre 40 y 200 caracteres; debe ser el último token recibido. |

Respuesta exitosa: `200 OK` con exactamente el mismo objeto `datos` de una
sesión iniciada, incluyendo `tipo_token`, ambos tokens, ambas fechas y
`usuario`.

La renovación rota ambos tokens en una sola operación. El cliente debe
reemplazar `token_acceso`, `token_renovacion`,
`token_acceso_expira_en` y `token_renovacion_expira_en` juntos, y descartar los
valores anteriores. Reutilizar el token de renovación anterior produce
`TOKEN_RENOVACION_INVALIDO`.

Errores relevantes:

| HTTP | Código | Acción |
| --- | --- | --- |
| `400` | `DATOS_INVALIDOS` | Eliminar la sesión local si el token guardado no tiene el formato mínimo. |
| `401` | `TOKEN_RENOVACION_INVALIDO` | El token venció, fue rotado, revocado o no existe; mostrar login. |
| `403` | `USUARIO_NO_HABILITADO` | La cuenta fue deshabilitada; borrar la sesión local. |
| `415` | `TIPO_CONTENIDO_NO_ADMITIDO` | Corregir la cabecera JSON. |

## 3. Consultar la sesión actual

```http
GET /api/autenticacion/sesion
```

Autenticación: token de acceso Bearer.

Petición:

```http
Authorization: Bearer upt_acceso_4c2f...
Accept: application/json
```

Cuerpo: ninguno.

Respuesta exitosa: `200 OK`.

```json
{
  "datos": {
    "usuario": {
      "id": 10,
      "codigo_institucional": "PRUEBA-SEG-001",
      "correo_institucional": "prueba-seg-001@seguridad.example.invalid",
      "nombres": "Usuario",
      "apellidos": "Seguridad",
      "roles": ["SEGURIDAD"]
    }
  }
}
```

| Propiedad | Tipo | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `datos` | `object` | Sí | Resultado de la consulta. |
| `datos.usuario` | `object` | Sí | Usuario asociado al token actual. |
| `datos.usuario.id` | `number` entero | Sí | Identificador interno. |
| `datos.usuario.codigo_institucional` | `string` | Sí | Código o usuario institucional. |
| `datos.usuario.correo_institucional` | `string` | Sí | Correo asociado. |
| `datos.usuario.nombres` | `string` | Sí | Nombres actuales. |
| `datos.usuario.apellidos` | `string` | Sí | Apellidos actuales. |
| `datos.usuario.roles` | `array<string>` | Sí | Roles actuales; volver a comprobar la política de roles. |

Usar esta ruta al restaurar la app cuando el token de acceso aún sea válido y
no requiera renovación. Si está vencido o próximo a vencer, usar primero el
token de renovación.

Errores relevantes:

| HTTP | Código | Acción |
| --- | --- | --- |
| `401` | `AUTENTICACION_REQUERIDA` | Falta o está mal formada la cabecera Bearer. Renovar o mostrar login. |
| `401` | `TOKEN_ACCESO_INVALIDO` | Token vencido, revocado o inexistente. Intentar renovación una sola vez. |
| `403` | `USUARIO_NO_HABILITADO` | La cuenta dejó de estar activa o autorizada. Borrar la sesión local. |

## 4. Cerrar sesión

```http
POST /api/autenticacion/cerrar-sesion
```

Autenticación: token de acceso Bearer.

Petición:

```http
Authorization: Bearer upt_acceso_4c2f...
Accept: application/json
```

Cuerpo: ninguno.

Respuesta exitosa: `204 No Content`, sin cuerpo JSON.

El cliente debe borrar siempre la sesión del almacenamiento seguro, incluso si
la petición falla por falta de red. Cuando el backend recibe la petición,
revoca la sesión activa y el token ya no debe reutilizarse.

Errores relevantes:

| HTTP | Código | Acción |
| --- | --- | --- |
| `401` | `AUTENTICACION_REQUERIDA` | No hay Bearer; borrar igualmente la sesión local. |
| `401` | `TOKEN_ACCESO_INVALIDO` | La sesión ya no es válida; borrar igualmente la sesión local. |
| `403` | `USUARIO_NO_HABILITADO` | La cuenta fue deshabilitada; borrar la sesión local. |

## Ciclo recomendado en Flutter

1. Al abrir la app, recuperar del almacenamiento seguro el objeto de sesión.
2. Si no existe o `token_renovacion_expira_en` ya pasó, mostrar login.
3. Si el acceso sigue vigente, llamar a `GET /autenticacion/sesion` para
   actualizar el usuario y validar roles.
4. Si el acceso está vencido o está dentro de la ventana de renovación,
   llamar a `POST /autenticacion/renovar-sesion`.
5. Antes de cada operación protegida, usar un token de acceso vigente. La
   renovación del cliente compartido puede anticiparse aproximadamente treinta
   segundos al vencimiento.
6. Ante `TOKEN_RENOVACION_INVALIDO`, `USUARIO_NO_HABILITADO` o una sesión sin
   rol permitido, borrar los datos locales y volver a la pantalla de login.
7. Al cerrar sesión, intentar revocar en el backend y borrar siempre la copia
   local.

No guardar contraseñas en texto plano. No decodificar tokens como si fueran JWT;
son tokens opacos. No incluir tokens en logs, mensajes de error, capturas ni
analítica.

## Prompt para un agente de código

```text
Actúa como un agente senior de Flutter y construye la aplicación de
autenticación para el proyecto seguridad_verificador, usando exclusivamente el
contrato de ENDPOINTS_LOGIN_SEGURIDAD.md y el backend ya existente.

Implementa:

1. Una pantalla de login con identificador y contraseña. El identificador
   puede ser código institucional o correo; triméalo antes de enviarlo. Envía
   POST /api/autenticacion/iniciar-sesion con JSON estricto que contenga sólo
   identificador y contrasena.
2. Modelos tipados para la respuesta datos, la sesión y el usuario. Usa String
   para textos y tokens, int para usuario.id, List<String> para roles y
   DateTime.parse para las fechas ISO 8601.
3. Una política de cliente que acepte sólo los roles SEGURIDAD y
   ADMINISTRADOR. Si la API autentica una cuenta sin esos roles, elimina los
   tokens y revoca la sesión remota si es posible.
4. Persistencia de token_acceso, token_renovacion y ambas fechas en
   almacenamiento seguro. Nunca guardes la contraseña ni escribas tokens en
   logs.
5. Restauración de sesión mediante GET /api/autenticacion/sesion cuando el
   acceso sigue vigente y mediante POST /api/autenticacion/renovar-sesion
   cuando el acceso venció o está próximo a vencer. La renovación debe
   reemplazar ambos tokens juntos porque la API los rota de forma atómica.
6. Cierre de sesión mediante POST /api/autenticacion/cerrar-sesion con
   Authorization: Bearer <token_acceso>. Borra la sesión local aunque la red
   falle.
7. Manejo claro de DATOS_INVALIDOS, CREDENCIALES_INVALIDAS,
   USUARIO_NO_HABILITADO, INICIO_SESION_BLOQUEADO,
   TOKEN_RENOVACION_INVALIDO, TOKEN_ACCESO_INVALIDO,
   AUTENTICACION_REQUERIDA, errores de conexión, timeout y JSON inválido.
   No expongas mensajes que revelen si una cuenta existe más allá del mensaje
   entregado por la API.

Organiza el código en modelos, cliente HTTP, servicio/controlador de sesión,
almacenamiento seguro, navegación y pantallas. Lee la URL base desde
URL_API_UPT; usa https en release y permite
http://127.0.0.1:3000/api en desarrollo. No modifiques el backend, no uses
MariaDB y no agregues endpoints inventados. El login debe quedar listo para
que las pantallas posteriores reciban una sesión autenticada.

Agrega pruebas significativas con MockClient para verificar métodos, rutas,
cabeceras, cuerpos, deserialización, política de roles, renovación con
rotación, restauración, logout y errores. Ejecuta dart format lib test,
flutter analyze y flutter test, y corrige cualquier fallo antes de entregar.
```
