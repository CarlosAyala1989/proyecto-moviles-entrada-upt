# Cambio de API: escuela profesional del estudiante

Fecha de revisión: 26 de octubre de 2026.

URL base configurada en las aplicaciones:
`https://api-moviles.fottuto.men/api`.

Los UUID, tokens, fechas y datos personales de los ejemplos son ilustrativos.
En una prueba real deben utilizarse los valores que entregue cada petición.

## 1. Qué cambió

La verificación de intranet ahora obtiene **nombre completo, código institucional
y escuela profesional**. El campo nuevo de la respuesta es
`datos.escuela_profesional`.

La escuela se extrae en el servidor del texto del enlace del menú académico cuya
URL tiene el parámetro `ir`. Se espera hasta diez segundos para que aparezca y se
contemplan menús contraídos. La extracción de nombre y código conserva las
alternativas de texto, HTML y OCR.

La app muestra los tres datos después de verificar la intranet y antes de iniciar
Google. La cuenta se registra o actualiza al completar Google correctamente;
mostrar el resumen todavía no crea una cuenta ni entrega una sesión.

## 2. Endpoints afectados y relacionados

Todas las rutas de esta tabla se agregan a la URL base anterior.

| Método y ruta | Relación con el cambio | Datos que envía la app |
| --- | --- | --- |
| `GET /registro-estudiante/intranet/captcha` | Sin cambio. Entrega la transacción y la imagen necesarias para verificar. | Sin cuerpo ni Bearer. |
| `POST /registro-estudiante/intranet/verificar` | **Respuesta ampliada** con `datos.escuela_profesional`. | Los mismos cuatro campos de antes: `transaccion_id`, `codigo`, `contrasena`, `captcha`. |
| `POST /registro-estudiante/google/iniciar` | Contrato sin cambio. El servidor conserva la escuela en la verificación temporal. | Solo `verificacion_intranet_id`. |
| `GET /registro-estudiante/google/callback` | Cambio interno: después de conciliar la identidad, guarda la escuela disponible. | La app no llama manualmente a esta ruta; Google retorna al backend. |
| `GET /registro-estudiante/google/estado/:transaccion_id` | Contrato sin cambio. Permite recuperar la sesión al completar Google. | UUID de la operación Google en la ruta, sin cuerpo. |
| `GET /identidad-digital` | Su contrato ya tenía `perfil_academico.escuela`; ahora puede contener la escuela obtenida en el registro. | Bearer del usuario autenticado, sin cuerpo. |
| `POST /ingresos/validar` | Su contrato ya tenía `identidad.escuela`; puede reflejar el dato guardado al autorizar un ingreso. | Lo envía el verificador con su Bearer, QR, puerta y ubicación. |

No se añadió un endpoint nuevo para guardar la escuela.

## 3. Verificar la intranet

### Petición: no hay campos nuevos

```http
POST /api/registro-estudiante/intranet/verificar
Content-Type: application/json
```

```json
{
  "transaccion_id": "0664b410-145e-4ef3-8d98-1055d8d57ee9",
  "codigo": "2022074266",
  "contrasena": "123456",
  "captcha": "12345"
}
```

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `transaccion_id` | `string` UUID | Se obtiene de `GET /registro-estudiante/intranet/captcha`. |
| `codigo` | `string` | Exactamente diez dígitos. |
| `contrasena` | `string` | Entre uno y seis dígitos; contraseña de la intranet. |
| `captcha` | `string` | Entre uno y cinco dígitos de la imagen entregada. |

Los números se envían como cadenas, para preservar los ceros iniciales.
El cuerpo es estricto: enviar propiedades como `escuela_profesional`,
`nombre_apellidos` o `usuario_id` produce `400 DATOS_INVALIDOS`.
La escuela se obtiene exclusivamente desde la intranet.

### Respuesta: `200 OK`

```json
{
  "datos": {
    "codigo": "2022074266",
    "nombre_apellidos": "AYALA RAMOS, CARLOS DANIEL",
    "escuela_profesional": "Ingeniería de Sistemas",
    "verificacion_intranet_id": "8bcdbcea-0682-4c77-a828-21855d6bcdfa",
    "verificacion_expira_en": "2026-10-26T19:10:00.000Z"
  }
}
```

| Campo recibido | Tipo | Uso |
| --- | --- | --- |
| `codigo` | `string` | Código comprobado por la intranet. |
| `nombre_apellidos` | `string` | Nombre con el formato del portal, normalmente `APELLIDOS, NOMBRES`. |
| `escuela_profesional` | `string` o `null` | **Dato nuevo**. Nombre de la escuela o `null` si no se pudo encontrar. |
| `verificacion_intranet_id` | `string` UUID | Se envía al iniciar Google; no es un token de sesión. |
| `verificacion_expira_en` | `string` ISO 8601 | La verificación dura aproximadamente diez minutos. |

Cuando la escuela no aparece, se conserva una respuesta exitosa con
`"escuela_profesional": null`; la app debe mostrar
**No disponible en la intranet**. No debe completar el dato con una escuela fija.
Los errores de credenciales, CAPTCHA, extracción de identidad o expiración
conservan su comportamiento anterior.

El CAPTCHA dura cinco minutos y la API consume su transacción en el intento de
verificación, incluso si falla el acceso. Después de un fallo se solicita una
imagen nueva. La contraseña y el CAPTCHA se borran de los campos de la app.

## 4. Continuar con Google y persistencia

Después de mostrar el resumen, la app espera que el estudiante pulse
**Continuar con Google institucional**. Entonces envía:

```http
POST /api/registro-estudiante/google/iniciar
Content-Type: application/json
```

```json
{
  "verificacion_intranet_id": "8bcdbcea-0682-4c77-a828-21855d6bcdfa"
}
```

No se reenvían nombre, código ni escuela. El backend recupera la verificación
temporal que ya conserva esos datos. La respuesta `201 Created` sigue entregando
`transaccion_id`, `url_autorizacion` y `expira_en` para abrir Google y consultar
`GET /registro-estudiante/google/estado/:transaccion_id`.

Después del retorno Google y de conciliar correctamente nombre y código:

1. Si la escuela está disponible, se crea o actualiza
   `perfiles_academicos.escuela` para ese usuario.
2. Facultad, estado académico y periodo existentes se conservan.
3. Si todavía no hay perfil académico, se crea con la escuela y con los valores
   predeterminados del esquema: estado `PENDIENTE`, facultad y periodo `null`.
4. Si la escuela llega en `null`, no se borra una escuela previamente guardada.
5. Una cuenta anterior puede obtener o actualizar su escuela al repetir el flujo
   de intranet y Google. No se hizo una carga retroactiva de todas las cuentas.

La columna `escuela` ya existía: este cambio no requiere una migración nueva.

## 5. Consultar la escuela después del registro

```http
GET /api/identidad-digital
Authorization: Bearer <token_acceso>
```

Fragmento de una respuesta con perfil recién creado:

```json
{
  "datos": {
    "codigo_institucional": "2022074266",
    "nombre_completo": "CARLOS DANIEL AYALA RAMOS",
    "perfil_academico": {
      "escuela": "Ingeniería de Sistemas",
      "facultad": null,
      "estado_academico": "PENDIENTE",
      "periodo_academico": null
    }
  }
}
```

Este fragmento omite los demás campos existentes de la identidad. En esta ruta
la escuela se llama `datos.perfil_academico.escuela`, no
`datos.escuela_profesional`. `perfil_academico` también puede ser `null` si la
cuenta no tiene perfil.

En una autorización de `POST /ingresos/validar`, la ruta del dato existente es
`datos.identidad.escuela`. El nombre de esa respuesta corresponde a la identidad
registrada después de Google y puede tener el orden `NOMBRES APELLIDOS`.

## 6. Adaptación de Dart

El modelo `PerfilIntranet` ahora incluye:

```dart
final String? escuelaProfesional;

// Dentro de PerfilIntranet.desdeJson:
escuelaProfesional: json['escuela_profesional'] as String?,
```

El campo es nullable para aceptar tanto `null` como respuestas de una API
anterior que todavía no lo incluya. La pantalla de intranet del proyecto
personal ya muestra por separado:

- Nombre completo: `perfil.nombreApellidos`.
- Código institucional: `perfil.codigo`.
- Escuela profesional: `perfil.escuelaProfesional` o el mensaje de ausencia.

Al verificar se oculta el formulario y se presenta el resumen. Google se inicia
únicamente al pulsar su botón. **Volver a verificar intranet** solicita otro
CAPTCHA y permite repetir el proceso.

## 7. Archivos de referencia

- [Extracción en la intranet](api-backend-entrada-upt/src/modulos/registro_estudiante/servicios/intranet_upt.servicio.js).
- [Validación estricta de peticiones](api-backend-entrada-upt/src/modulos/registro_estudiante/validacion/registro_estudiante.esquemas.js).
- [Conciliación y retorno Google](api-backend-entrada-upt/src/modulos/registro_estudiante/servicios/google_estudiante.servicio.js).
- [Persistencia de la escuela](api-backend-entrada-upt/src/modulos/registro_estudiante/repositorios/repositorio_registro_estudiante_mariadb.js).
- [Modelo Dart](paquetes/cliente_api_upt/lib/modelos/perfil_intranet.dart).
- [Resumen antes de Google](seguridad_estudiante/lib/pantallas/pantalla_verificacion_intranet.dart).
- [Contrato completo del registro](ENDPOINTS_LOGIN_ESTUDIANTE.md).
- [Guía del QR offline](GUIA_IMPLEMENTACION_QR_OFFLINE.md).
