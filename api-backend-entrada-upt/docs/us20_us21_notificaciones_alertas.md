# US-20 y US-21: notificaciones de denegación y alertas personales

Referencias: [US-20, issue #21](https://github.com/CarlosAyala1989/app-seguridad-entrada-upt/issues/21)
y [US-21, issue #25](https://github.com/CarlosAyala1989/app-seguridad-entrada-upt/issues/25).

## Qué integra la aplicación de estudiante

El backend genera y conserva una bandeja personal. La app consulta esta bandeja,
muestra el aviso y confirma su lectura mediante los endpoints de este documento.
El mecanismo implementado es **notificación dentro de la app mediante consultas
HTTP**. No requiere Firebase, tokens de dispositivo ni permisos de notificación
del sistema operativo. No envía push cuando la app está cerrada: los avisos
permanecen guardados para consultarlos al volver a abrirla.

La app no crea los avisos ni decide si un intento es sospechoso. El backend lo
hace durante la validación existente `POST /api/ingresos/validar`, tanto para QR
en línea como para QR offline. Las cuatro rutas nuevas son:

| Método | Ruta | Función |
| --- | --- | --- |
| `GET` | `/api/notificaciones` | Listar la bandeja personal con filtros y paginación. |
| `GET` | `/api/notificaciones/resumen` | Consultar los contadores de notificaciones no leídas. |
| `GET` | `/api/notificaciones/:id` | Consultar el detalle de una notificación propia. |
| `PATCH` | `/api/notificaciones/:id/leida` | Confirmar la lectura de una notificación propia. |

## Reglas de generación

**US-20:** cada validación que se guarda con resultado `DENEGADO` y con un titular
identificado genera una notificación `DENEGACION_ACCESO`. Incluye causa general,
fecha/hora, puerta y canal de soporte. Un ingreso `AUTORIZADO` no genera avisos.

**US-21:** además del aviso de denegación, los siguientes eventos generan una
notificación `INTENTO_SOSPECHOSO` para el mismo titular:

| Evento detectado | Significado |
| --- | --- |
| `CREDENCIAL_YA_UTILIZADA` | Se intentó reutilizar un QR que ya fue consumido. Aplica a QR en línea y offline. |
| `INTEGRIDAD_CREDENCIAL_INVALIDA` | La referencia de la credencial o dispositivo es reconocible, pero su OTP, nonce o firma no pasa la verificación correspondiente. |
| `DISPOSITIVO_NO_VINCULADO` | Se presentó un código offline de un dispositivo reconocido que ya no está activo o vinculado. |

Son señales de **posible** uso sospechoso; no prueban un ataque. Un vencimiento o
una revocación normal genera únicamente el aviso de denegación. No se aplican
umbrales de frecuencia ni se bloquea automáticamente la cuenta por estas alertas.

Un intento sospechoso genera **dos notificaciones distintas** ligadas al mismo
`registro_acceso_id`: una denegación y una alerta. Así la app puede mostrarlas en
una bandeja común o en pestañas separadas por `tipo`.

Los códigos desconocidos sin titular (`usuario_id = NULL`) quedan en el registro
operativo, pero no se envían a otra cuenta. Los errores de petición que se
rechazan antes de registrar una decisión de acceso (`400`, `401`, `403`, ciertos
`422`) tampoco generan notificaciones. No se generan avisos retrospectivos por
registros anteriores a esta implementación.

## Convenciones y autenticación

- URL base local: `http://127.0.0.1:3000/api`. En producción usar la URL HTTPS de
  la API. La dirección de MySQL no es una URL de estos endpoints.
- Todas las rutas requieren `Authorization: Bearer <token_acceso>` de una sesión
  vigente. Se usa el mismo token del inicio/renovación de sesión existente.
- No se envía `usuario_id`: el backend lo obtiene exclusivamente del token.
- Cualquier rol habilitado puede consultar sus propios avisos. Ni seguridad ni
  administrador pueden consultar los avisos de otro titular mediante estas rutas.
- Las respuestas exitosas tienen HTTP `200`, JSON y `Cache-Control: no-store`.
- Los parámetros de consulta desconocidos producen `400 DATOS_INVALIDOS`.
- Las fechas recibidas incluyen zona horaria y las fechas devueltas están en UTC
  ISO 8601, con milisegundos y sufijo `Z`.

## 1. Listar notificaciones

```http
GET /api/notificaciones?pagina=1&limite=20&estado=NO_LEIDA
Authorization: Bearer <token_acceso>
Accept: application/json
```

No se envía cuerpo. Los parámetros siguientes son opcionales y se transmiten
como texto en la URL:

| Parámetro | Tipo lógico / Dart | Predeterminado | Regla |
| --- | --- | --- | --- |
| `pagina` | `integer` / `int` | `1` | Entero entre `1` y `1000000`. |
| `limite` | `integer` / `int` | `20` | Entero entre `1` y `100`. |
| `tipo` | `string` / `String` o enum | Ambos tipos | `DENEGACION_ACCESO` o `INTENTO_SOSPECHOSO`. |
| `estado` | `string` / `String` o enum | Ambos estados | `NO_LEIDA` o `LEIDA`. |
| `desde` | `string` ISO 8601 / `DateTime` convertido a texto | Sin límite inferior | Fecha/hora mínima de **creación de la notificación**, inclusiva. |
| `hasta` | `string` ISO 8601 / `DateTime` convertido a texto | Sin límite superior | Fecha/hora máxima de **creación de la notificación**, inclusiva. |

`desde` debe ser anterior o igual a `hasta` si se envían ambos. No son válidas las
fechas sin hora/zona, los valores vacíos o el texto `null`. Omitir los filtros
que no se utilizan. Ejemplo de fecha aceptada: `2026-10-23T00:00:00.000-05:00`.
Se pueden combinar los filtros.

Respuesta de ejemplo con una alerta y su aviso de denegación:

```json
{
  "datos": [
    {
      "id": 102,
      "usuario_id": 42,
      "registro_acceso_id": 501,
      "tipo": "INTENTO_SOSPECHOSO",
      "evento": "CREDENCIAL_YA_UTILIZADA",
      "titulo": "Posible uso sospechoso de tu credencial",
      "mensaje": "Detectamos un intento de validación que requiere tu atención. Si no lo reconoces, contacta con el canal de soporte.",
      "causa_general": "La credencial presentada ya fue utilizada.",
      "canal_soporte": "Acércate al personal de seguridad de la puerta.",
      "estado": "NO_LEIDA",
      "creada_en": "2026-10-23T15:00:00.125Z",
      "leida_en": null,
      "registrado_en": "2026-10-23T15:00:00.123Z",
      "punto_acceso": {
        "id": 3,
        "codigo": "PUERTA-PRINCIPAL",
        "nombre": "Puerta principal"
      }
    },
    {
      "id": 101,
      "usuario_id": 42,
      "registro_acceso_id": 501,
      "tipo": "DENEGACION_ACCESO",
      "evento": "ACCESO_DENEGADO",
      "titulo": "Ingreso denegado",
      "mensaje": "Se denegó un intento de ingreso con tu identidad. Consulta la causa y el canal de soporte.",
      "causa_general": "La credencial presentada ya fue utilizada.",
      "canal_soporte": "Acércate al personal de seguridad de la puerta.",
      "estado": "NO_LEIDA",
      "creada_en": "2026-10-23T15:00:00.124Z",
      "leida_en": null,
      "registrado_en": "2026-10-23T15:00:00.123Z",
      "punto_acceso": {
        "id": 3,
        "codigo": "PUERTA-PRINCIPAL",
        "nombre": "Puerta principal"
      }
    }
  ],
  "paginacion": {
    "pagina": 1,
    "limite": 20,
    "total": 2,
    "total_paginas": 1
  }
}
```

### Tipos de datos de la respuesta

| Campo | Tipo JSON | Tipo Dart | Descripción |
| --- | --- | --- | --- |
| `datos` | `array<object>` | `List<Notificacion>` | Notificaciones de esta página. |
| `datos[].id` | `number` entero positivo | `int` | Identificador de la notificación; usar para detalle y lectura. |
| `datos[].usuario_id` | `number` entero positivo | `int` | Titular, siempre el de la sesión actual. |
| `datos[].registro_acceso_id` | `number` entero positivo | `int` | Registro de acceso relacionado; permite agrupar aviso y alerta. |
| `datos[].tipo` | `string` | `String` o enum | `DENEGACION_ACCESO` o `INTENTO_SOSPECHOSO`. |
| `datos[].evento` | `string`, hasta 80 caracteres | `String` | `ACCESO_DENEGADO` para avisos; código del evento de la tabla US-21 para alertas. |
| `datos[].titulo` | `string`, hasta 150 caracteres | `String` | Título listo para mostrar. |
| `datos[].mensaje` | `string`, hasta 500 caracteres | `String` | Explicación y acción sugerida. |
| `datos[].causa_general` | `string`, hasta 250 caracteres | `String` | Causa del rechazo en lenguaje general. |
| `datos[].canal_soporte` | `string`, hasta 500 caracteres | `String` | Instrucción de soporte lista para mostrar; no necesariamente una URL. |
| `datos[].estado` | `string` | `String` o enum | `NO_LEIDA` o `LEIDA`. |
| `datos[].creada_en` | `string` ISO 8601 UTC | `DateTime` al parsear | Momento de creación de la notificación. |
| `datos[].leida_en` | `string` ISO 8601 UTC o `null` | `DateTime?` | Primera confirmación de lectura; `null` mientras no se lea. |
| `datos[].registrado_en` | `string` ISO 8601 UTC | `DateTime` al parsear | Momento del intento de acceso, independiente de la lectura. |
| `datos[].punto_acceso` | `object` | `PuntoAccesoNotificacion` | Puerta de la validación. |
| `datos[].punto_acceso.id` | `number` entero positivo | `int` | Identificador de la puerta. |
| `datos[].punto_acceso.codigo` | `string`, hasta 50 caracteres | `String` | Código de la puerta. |
| `datos[].punto_acceso.nombre` | `string`, hasta 150 caracteres | `String` | Nombre de la puerta. |
| `paginacion` | `object` | `Paginacion` | Metadatos de la consulta. |
| `paginacion.pagina` | `number` entero positivo | `int` | Página solicitada. |
| `paginacion.limite` | `number` entero positivo | `int` | Máximo de elementos por página. |
| `paginacion.total` | `number` entero, mínimo `0` | `int` | Notificaciones propias que cumplen los filtros, contando ambos tipos si no se filtran. |
| `paginacion.total_paginas` | `number` entero, mínimo `0` | `int` | Redondeo hacia arriba de `total / limite`. |

Todos los campos son obligatorios y no nulos salvo `leida_en`. El orden es
`creada_en` descendente, con desempate por `id` descendente. La API no devuelve
QR, secretos, hashes, coordenadas ni identidad del personal que validó.

Sin coincidencias:

```json
{
  "datos": [],
  "paginacion": {
    "pagina": 1,
    "limite": 20,
    "total": 0,
    "total_paginas": 0
  }
}
```

Si la página supera la última, devuelve `200` con `datos: []` y conserva el
total calculado. Consultar la lista no marca automáticamente como leído.

## 2. Consultar pendientes

```http
GET /api/notificaciones/resumen
Authorization: Bearer <token_acceso>
```

No recibe parámetros ni cuerpo. Respuesta `200`:

```json
{
  "datos": {
    "total_no_leidas": 2,
    "denegaciones_no_leidas": 1,
    "alertas_no_leidas": 1
  }
}
```

Los tres campos son JSON `number` entero, mínimo `0` (`int` en Dart).
`total_no_leidas` es la suma de los otros dos. Cuenta **notificaciones**, no
intentos únicos: un intento sospechoso puede aportar dos pendientes.
Sin avisos pendientes los tres valores son `0`.

## 3. Consultar detalle

```http
GET /api/notificaciones/102
Authorization: Bearer <token_acceso>
```

`id` es un entero positivo hasta `9007199254740991` (`int` en Dart). Es el ID de
la notificación, no el ID del acceso. No recibe parámetros de consulta ni cuerpo.
Respuesta `200`: `{ "datos": Notificacion }`, donde `Notificacion` tiene
exactamente los campos descritos en la tabla anterior. No cambia el estado.

Si el ID no existe o pertenece a otra cuenta, devuelve el mismo `404
NOTIFICACION_NO_ENCONTRADA`; no revela si otra persona tiene ese aviso.

## 4. Confirmar lectura

```http
PATCH /api/notificaciones/102/leida
Authorization: Bearer <token_acceso>
```

`id` tiene las mismas reglas que el detalle. No recibe parámetros de consulta.
Se puede enviar sin cuerpo o con un objeto vacío `{}`. Si se envía `{}`, usar
`Content-Type: application/json`. No enviar `estado`, `usuario_id` ni `leida_en`:
el backend fija el estado y la fecha.

Respuesta `200`: `{ "datos": Notificacion }`, con todos los campos del detalle.
Los campos que cambian son:

```json
{
  "estado": "LEIDA",
  "leida_en": "2026-10-23T15:02:00.000Z"
}
```

El fragmento anterior muestra sólo los cambios, no la respuesta completa.
La operación es idempotente: repetirla, incluso desde dos dispositivos, mantiene
la primera fecha de lectura. No existe una operación para volver a `NO_LEIDA`.
Un ID ajeno o inexistente devuelve `404 NOTIFICACION_NO_ENCONTRADA`.

## Ejemplos cURL

Sustituir `<token_acceso>` y el ID por valores reales de una sesión de prueba:

```bash
# Sólo alertas sospechosas pendientes.
curl --get 'http://127.0.0.1:3000/api/notificaciones' \
  --header 'Authorization: Bearer <token_acceso>' \
  --data-urlencode 'tipo=INTENTO_SOSPECHOSO' \
  --data-urlencode 'estado=NO_LEIDA' \
  --data-urlencode 'pagina=1' \
  --data-urlencode 'limite=20'

# Cantidad pendiente para el indicador de la campana.
curl 'http://127.0.0.1:3000/api/notificaciones/resumen' \
  --header 'Authorization: Bearer <token_acceso>'

# Detalle propio.
curl 'http://127.0.0.1:3000/api/notificaciones/102' \
  --header 'Authorization: Bearer <token_acceso>'

# Confirmación explícita de lectura, sin cuerpo.
curl --request PATCH 'http://127.0.0.1:3000/api/notificaciones/102/leida' \
  --header 'Authorization: Bearer <token_acceso>'
```

## Errores y tipos

Todos los errores contienen `error.codigo` y `error.mensaje`, ambos `string`:

```json
{
  "error": {
    "codigo": "NOTIFICACION_NO_ENCONTRADA",
    "mensaje": "La notificación solicitada no existe."
  }
}
```

| HTTP | `error.codigo` | Cuándo ocurre |
| --- | --- | --- |
| `400` | `DATOS_INVALIDOS` | ID, filtros, paginación o fechas inválidos; parámetro desconocido o cuerpo de lectura con campos no permitidos. |
| `400` | `JSON_INVALIDO` | Se envía un JSON malformado. |
| `401` | `AUTENTICACION_REQUERIDA` | Falta el Bearer o su formato no es válido. |
| `401` | `TOKEN_ACCESO_INVALIDO` | Token inexistente, vencido o sesión revocada. |
| `403` | `USUARIO_NO_HABILITADO` | Cuenta inactiva, bloqueada o sin autorización vigente. |
| `404` | `NOTIFICACION_NO_ENCONTRADA` | El ID no existe o no pertenece al titular. |
| `415` | `TIPO_CONTENIDO_NO_ADMITIDO` | Se envía cuerpo con tipo de contenido no soportado por la API. |
| `500` | `ERROR_INTERNO` | Fallo interno; no revela detalles técnicos. |

## Secuencia recomendada para Flutter

1. Al iniciar sesión o volver a primer plano, consultar `/notificaciones/resumen`.
   Mostrar el contador pendiente en la campana.
2. Abrir la bandeja con `/notificaciones?pagina=1&limite=20`. Usar `tipo` para
   separar avisos de US-20 y alertas de US-21 si la interfaz lo requiere.
3. Mostrar `titulo`, `mensaje`, `causa_general`, `canal_soporte`,
   `punto_acceso.nombre` y `registrado_en`. Usar `DateTime.parse(...).toLocal()`
   para presentar las fechas; `15:00Z` corresponde a `10:00` en Lima.
4. Solicitar el detalle al abrir un elemento y confirmar lectura sólo después
   de mostrarlo o cuando la persona pulse “Marcar como leída”.
5. Tras un `PATCH` exitoso, actualizar el elemento y consultar de nuevo el
   resumen. No descontar dos veces si se repite la petición.
6. Cargar la página siguiente mientras `pagina < total_paginas`. Al refrescar
   o cambiar filtros, reemplazar la lista desde la página 1. Deduplicar por `id`
   al anexar páginas: pueden llegar nuevos eventos mientras se consulta.
7. Para avisos visibles con la app abierta, consultar periódicamente los
   pendientes, por ejemplo cada 20–30 segundos; detener el temporizador al
   cerrar sesión o pasar a segundo plano. Deduplicar los avisos ya mostrados por
   `id`, ya que una notificación sigue siendo `NO_LEIDA` hasta confirmarla.
8. Ante `401`, aplicar la renovación de sesión existente. Ante `403`, mostrar
   la restricción. Ante falta de red, reintentar al recuperar conexión: los
   avisos permanecen en el servidor.

`canal_soporte` es texto, no asumir que es una dirección web o un correo. Como
todavía no existe un canal institucional definido, su valor predeterminado es
“Acércate al personal de seguridad de la puerta.”.

## Configuración, migración y compatibilidad

El backend acepta la variable opcional `CANAL_SOPORTE_ACCESO`, texto de 1 a 500
caracteres después de quitar espacios de los extremos. Si no se configura, usa
la instrucción presencial anterior. Una cadena vacía no es válida.

```dotenv
CANAL_SOPORTE_ACCESO=Acércate al personal de seguridad de la puerta.
```

Cuando se defina un correo, teléfono o enlace, cambiar esta variable en el
servidor y volver a desplegar la API. Se conserva el canal que tenía cada aviso
al generarse; los avisos nuevos usarán el nuevo valor.

La migración nueva `013_notificaciones_usuario.sql` crea la tabla
`notificaciones_usuario` con colación `utf8mb4_unicode_ci`. No modifica las
migraciones anteriores ni los contratos existentes. El arranque de la API la
aplica automáticamente antes de escuchar; también puede ejecutarse con
`npm run migrar`. Las consultas nuevas requieren esta migración aplicada.
Para disponer de las rutas en la API publicada también debe desplegarse el
código actualizado; aplicar solamente la migración no publica los endpoints.

Para conexiones SQL a través de una red con latencia, `DB_CONNECT_TIMEOUT_MS`
permite ajustar el tiempo de establecimiento de conexión; su valor predeterminado
es `10000` milisegundos. La conexión usa los mismos campos `DB_*` existentes.

Las notificaciones y el registro del rechazo se confirman en una misma
transacción. La clave única `(registro_acceso_id, tipo)` evita duplicados del
mismo evento. Cada intento nuevo tiene un registro distinto y puede generar
nuevas notificaciones, aunque utilice el mismo QR. Un rollback del código no
elimina la tabla ni sus datos; la API anterior puede seguir usando sus tablas.

## Pruebas reproducibles con datos aislados

Configurar una base de desarrollo y ejecutar desde `api-backend-entrada-upt/`:

```bash
npm run migrar
npm run sembrar:pruebas
NODE_ENV=test node --test test/notificaciones.prueba.js
npm test
npm run test:flujo-completo
```

Las semillas y la suite general deben ejecutarse sólo en la base de desarrollo.
La prueba específica crea usuarios, sesiones, dispositivos, puerta y accesos
con identificadores aleatorios propios y los elimina al terminar. Usa el flujo
HTTP real para comprobar denegación normal, QR reutilizado, QR alterado,
vencimiento, QR offline, dispositivo revocado, validaciones simultáneas,
privacidad, filtros, lectura idempotente y sesiones inválidas. También comprueba
rollback y deduplicación en la transacción de persistencia.

### Verificación realizada el 23/10/2026

| Comprobación | Resultado |
| --- | --- |
| `npm test`, con base y semillas aisladas en MariaDB 11.8.9 | 127 pruebas aprobadas, 0 fallos. |
| `test/notificaciones.prueba.js`, contra MySQL 8.4.11 | 18 pruebas aprobadas, 0 fallos. |
| `npm run test:flujo-completo`, en la base local aislada | 35 endpoints HTTP verificados, incluidas las cuatro rutas nuevas; integración existente del cliente Dart aprobada. |
| Migración en MySQL | Aplicada únicamente `013_notificaciones_usuario.sql`; una segunda ejecución no encontró migraciones pendientes. |
| `npm run verificar:bd`, en MariaDB | Conexión correcta y 16 tablas requeridas disponibles. |

Las pruebas remotas usaron exclusivamente usuarios, sesiones, dispositivos y
puerta de prueba propios, y los eliminaron al finalizar. No se ejecutaron semillas
ni la suite de configuración general sobre el servidor MySQL compartido.
