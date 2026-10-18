# US-14: historial personal de ingresos y rechazos

Historia de referencia: [US-14, issue #17](https://github.com/CarlosAyala1989/app-seguridad-entrada-upt/issues/17).

## Endpoint creado

```http
GET /api/ingresos/historial
Authorization: Bearer <token_acceso>
Accept: application/json
```

URL local: `http://127.0.0.1:3000/api/ingresos/historial`.
En el servidor publicado, usar la URL HTTPS de la API con la misma ruta.
La dirección de MySQL no es la URL HTTP de la API.

Devuelve exclusivamente los registros cuyo `usuario_id` corresponde a la sesión
actual, tanto `AUTORIZADO` como `DENEGADO`. Está disponible para cualquier usuario
autenticado y habilitado, incluidos estudiante, docente, trabajador, seguridad y
administrador. Para seguridad devuelve sus propios accesos como titular.

No requiere cuerpo JSON, GPS, código QR ni identificador de usuario. No acepta
`usuario_id`, `usuarioId` ni filtros de otro titular: los parámetros desconocidos
producen `400 DATOS_INVALIDOS`. Tampoco incluye rechazos de códigos desconocidos
que quedaron almacenados sin un usuario identificable (`usuario_id = NULL`).

## Datos que debe enviar la aplicación

Cabecera `Authorization`: `string`, obligatoria, con el prefijo `Bearer ` seguido
del `token_acceso` obtenido al iniciar o renovar la sesión existente. No enviar
el token de renovación en esta cabecera.

Todos los parámetros de consulta son opcionales. Se transmiten como texto en la
URL; `pagina` y `limite` representan enteros.

| Parámetro | Tipo lógico | Predeterminado | Valores y significado |
| --- | --- | --- | --- |
| `pagina` | `integer` (`int` en Dart) | `1` | Entre `1` y `1000000`, inclusive. |
| `limite` | `integer` (`int` en Dart) | `20` | Entre `1` y `100`, inclusive. |
| `resultado` | `string`, enumeración | Ambos resultados | `AUTORIZADO` o `DENEGADO`, en mayúsculas. |
| `desde` | `string`, fecha ISO 8601 con zona | Sin límite inferior | Fecha/hora mínima incluida. Ejemplo: `2026-10-18T00:00:00.000-05:00`. |
| `hasta` | `string`, fecha ISO 8601 con zona | Sin límite superior | Fecha/hora máxima incluida. Ejemplo: `2026-10-18T23:59:59.999-05:00`. |

Si se envían ambas fechas, `desde` debe ser anterior o igual a `hasta`. Una fecha
sin hora o sin zona horaria no es válida. Se pueden combinar todos los filtros;
el total de la respuesta corresponde a esa combinación para el titular actual.
Omitir los filtros que no se usan, en lugar de enviar cadenas vacías o `null`.

Ejemplo con cURL (sustituir el token por el de una sesión válida):

```bash
curl --get 'http://127.0.0.1:3000/api/ingresos/historial' \
  --header 'Authorization: Bearer <token_acceso>' \
  --header 'Accept: application/json' \
  --data-urlencode 'pagina=1' \
  --data-urlencode 'limite=20' \
  --data-urlencode 'resultado=DENEGADO' \
  --data-urlencode 'desde=2026-10-18T00:00:00.000-05:00' \
  --data-urlencode 'hasta=2026-10-18T23:59:59.999-05:00'
```

## Respuesta exitosa: `200 OK`

Ejemplo ilustrativo sin filtro de resultado, con dos registros:

```json
{
  "datos": [
    {
      "id": 502,
      "usuario_id": 42,
      "resultado": "DENEGADO",
      "motivo": "CREDENCIAL_YA_UTILIZADA",
      "registrado_en": "2026-10-18T15:01:00.000Z",
      "punto_acceso": {
        "id": 3,
        "codigo": "PUERTA-PRINCIPAL",
        "nombre": "Puerta principal"
      }
    },
    {
      "id": 501,
      "usuario_id": 42,
      "resultado": "AUTORIZADO",
      "motivo": "ACCESO_AUTORIZADO",
      "registrado_en": "2026-10-18T15:00:00.000Z",
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

| Campo | Tipo JSON | Tipo Dart | Descripción |
| --- | --- | --- | --- |
| `datos` | `array<object>` | `List<RegistroHistorial>` | Registros de la página solicitada. |
| `datos[].id` | `number` entero positivo | `int` | Identificador del registro. |
| `datos[].usuario_id` | `number` entero positivo | `int` | Titular del acceso; siempre el usuario de la sesión. |
| `datos[].resultado` | `string` | `String` o enum | `AUTORIZADO` (ingreso) o `DENEGADO` (rechazo). |
| `datos[].motivo` | `string` | `String` | Código de decisión, hasta 80 caracteres. |
| `datos[].registrado_en` | `string` ISO 8601 UTC | `DateTime` al parsear | Fecha/hora del acceso, con milisegundos y sufijo `Z`. |
| `datos[].punto_acceso` | `object` | `PuntoAccesoHistorial` | Punto donde se registró el intento. |
| `datos[].punto_acceso.id` | `number` entero positivo | `int` | Identificador del punto. |
| `datos[].punto_acceso.codigo` | `string` | `String` | Código del punto, hasta 50 caracteres. |
| `datos[].punto_acceso.nombre` | `string` | `String` | Nombre del punto, hasta 150 caracteres. |
| `paginacion` | `object` | `Paginacion` | Metadatos para cargar las siguientes páginas. |
| `paginacion.pagina` | `number` entero positivo | `int` | Página solicitada. |
| `paginacion.limite` | `number` entero positivo | `int` | Máximo de registros por página. |
| `paginacion.total` | `number` entero, mínimo `0` | `int` | Total de registros propios que cumplen los filtros. |
| `paginacion.total_paginas` | `number` entero, mínimo `0` | `int` | Redondeo hacia arriba de `total / limite`. |

Todos los campos de los registros son obligatorios y no nulos. El listado se
ordena por `registrado_en` descendente; si las fechas coinciden, por `id`
descendente. Las puertas inactivas mantienen sus registros históricos.
Se devuelve `Cache-Control: no-store`.

No se devuelven hashes, tokens, credenciales QR, coordenadas, detalle interno,
datos personales del operador ni información de otros titulares.

Sin actividad o sin coincidencias:

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

Una página posterior a la última también devuelve `200` con `datos: []`,
conservando el total y el número de páginas calculados.

## Errores

Todos los errores contienen `error.codigo` y `error.mensaje`, ambos `string`:

```json
{
  "error": {
    "codigo": "DATOS_INVALIDOS",
    "mensaje": "Los datos de consulta no son válidos."
  }
}
```

| HTTP | `error.codigo` | Situación |
| --- | --- | --- |
| `400` | `DATOS_INVALIDOS` | Paginación inválida, resultado desconocido, fechas inválidas/invertidas o parámetros no permitidos. |
| `401` | `AUTENTICACION_REQUERIDA` | Falta la cabecera Bearer o tiene formato incorrecto. |
| `401` | `TOKEN_ACCESO_INVALIDO` | Token inexistente, vencido o sesión revocada. |
| `403` | `USUARIO_NO_HABILITADO` | Cuenta inactiva, bloqueada o sin autorización vigente. |
| `500` | `ERROR_INTERNO` | Fallo interno; el mensaje público no revela detalles técnicos. |

## Integración en Flutter

1. Usar el cliente HTTP y la sesión existentes. Pedir inicialmente `pagina=1` y
   `limite=20`; la aplicación sólo se comunica con la API.
2. Mostrar fecha/hora, `punto_acceso.nombre` y el resultado de cada registro.
   Parsear `registrado_en` con `DateTime.parse(...)` y convertir a la zona local
   para presentación; por ejemplo `15:00Z` equivale a `10:00` en Lima.
3. Mostrar `AUTORIZADO` como “Ingreso autorizado” y `DENEGADO` como “Ingreso
   rechazado”. `motivo` es un código técnico: ejemplos son `ACCESO_AUTORIZADO`,
   `CREDENCIAL_YA_UTILIZADA`, `CREDENCIAL_EXPIRADA` o `USUARIO_NO_HABILITADO`.
   Usar un texto de respaldo para motivos nuevos.
4. Cargar `pagina + 1` mientras `pagina < total_paginas`. Al cambiar filtros o
   actualizar el historial, reemplazar la lista desde la página 1. Como llegan
   nuevos accesos entre peticiones, conviene deduplicar por `id` al anexar páginas.
5. Mostrar un estado vacío cuando no hay registros. Ante `401`, usar el flujo
   existente de renovación/inicio de sesión; ante `403`, informar la restricción.

## Persistencia y pruebas

Reutiliza `registros_acceso`, `puntos_acceso` y el índice existente
`idx_registros_usuario_fecha`. No necesita migración ni modifica el esquema.
Los rechazos y autorizaciones se siguen creando desde la validación existente
de QR, no desde la pantalla de historial.

Prueba reproducible con una base de desarrollo configurada y migrada:

```bash
NODE_ENV=test node --test test/historial_personal.prueba.js
```

La prueba crea usuarios, sesiones, una puerta y registros propios con sufijo
aleatorio; al terminar elimina exclusivamente sus datos. Incluye un QR real,
una validación autorizada y un segundo intento rechazado por reutilización.
La suite completa se ejecuta con `npm test` sobre una base de desarrollo aislada.

### Verificación realizada el 18/10/2026

| Verificación | Resultado |
| --- | --- |
| `npm test`, en MariaDB local con base y semillas aisladas | 109 pruebas aprobadas, 0 fallos. |
| `test/historial_personal.prueba.js`, contra el MySQL 8.4.11 indicado | 12 pruebas aprobadas, 0 fallos. |
| `npm run test:flujo-completo`, en la base local aislada | 31 endpoints verificados, incluido `/api/ingresos/historial`; prueba del cliente Dart aprobada. |

Las pruebas específicas contra MySQL utilizaron datos temporales propios y los
eliminaron al finalizar. Las semillas y las pruebas de configuración general se
ejecutaron únicamente en la base local aislada.
