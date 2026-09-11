# Administración operativa e historial

El Hito 8 incorpora consultas operativas sobre los registros generados por la
validación de ingresos y completa la administración de puntos de acceso,
auditoría y configuraciones utilizadas por el backend.

Todas las rutas bajo `/api/administracion` requieren una sesión activa con el
rol `ADMINISTRADOR`. La API no devuelve contraseñas, tokens, huellas de tokens,
correos, direcciones IP ni el contenido interno de `detalle` en estas consultas.

## Endpoints

| Método | Ruta | Operación |
| --- | --- | --- |
| `GET` | `/api/administracion/resumen` | Totales operativos del día. |
| `GET` | `/api/administracion/accesos` | Historial paginado y filtrable. |
| `GET` | `/api/administracion/accesos/:id` | Detalle de un intento y ubicación declarada. |
| `GET` | `/api/administracion/puntos-acceso` | Lista paginada de puntos. |
| `POST` | `/api/administracion/puntos-acceso` | Registra un punto de acceso. |
| `PATCH` | `/api/administracion/puntos-acceso/:id` | Actualiza o deshabilita un punto. |
| `GET` | `/api/administracion/auditoria` | Historial administrativo protegido. |
| `GET` | `/api/administracion/configuraciones` | Configuraciones operativas no secretas. |
| `PUT` | `/api/administracion/configuraciones/:clave` | Cambia un valor permitido. |
| `GET` | `/api/ingresos/recientes` | Historial del propio operador de seguridad. |

Los puntos no se eliminan mediante la API porque pueden estar relacionados con
registros históricos. Se deshabilitan usando `estado=INACTIVO`. Cambiar su
ubicación, radio o estado revoca los códigos QR pendientes asociados.

## Consulta de accesos

Los filtros admitidos son:

- `pagina` y `limite`, con máximo de 100 registros.
- `usuario_id`.
- `punto_acceso_id`.
- `usuario_seguridad_id`.
- `resultado`: `AUTORIZADO` o `DENEGADO`.
- `motivo`.
- `desde` y `hasta` en ISO 8601 con zona horaria.

Ejemplo reproducible después de iniciar sesión como administrador:

```bash
export API_UPT='http://127.0.0.1:3000/api'
export TOKEN_ADMINISTRADOR='reemplazar-por-el-token-administrativo'

curl --get "$API_UPT/administracion/accesos" \
  --header "authorization: Bearer $TOKEN_ADMINISTRADOR" \
  --data-urlencode 'resultado=DENEGADO' \
  --data-urlencode 'desde=2026-09-01T00:00:00-05:00' \
  --data-urlencode 'hasta=2026-09-30T23:59:59-05:00' \
  --data-urlencode 'pagina=1' \
  --data-urlencode 'limite=20'
```

Respuesta abreviada:

```json
{
  "datos": [
    {
      "id": 1,
      "resultado": "DENEGADO",
      "motivo": "CREDENCIAL_YA_UTILIZADA",
      "registrado_en": "fecha ISO 8601",
      "usuario": {
        "id": 10,
        "codigo_institucional": "CODIGO-PRUEBA",
        "nombre_completo": "Usuario De Prueba"
      },
      "punto_acceso": {
        "id": 2,
        "codigo": "PUERTA-PRINCIPAL",
        "nombre": "Puerta principal"
      },
      "personal_seguridad": {
        "id": 20,
        "codigo_institucional": "SEGURIDAD-PRUEBA",
        "nombre_completo": "Personal De Seguridad"
      }
    }
  ],
  "paginacion": {
    "pagina": 1,
    "limite": 20,
    "total": 1,
    "total_paginas": 1
  }
}
```

El detalle expone las coordenadas declaradas sólo a administradores. Como se
documentó en el Hito 7, estas coordenadas pueden ser manipuladas y no prueban
por sí solas la presencia física.

## Puntos de acceso

Registrar un punto:

```bash
curl --request POST "$API_UPT/administracion/puntos-acceso" \
  --header "authorization: Bearer $TOKEN_ADMINISTRADOR" \
  --header 'content-type: application/json' \
  --data '{
    "codigo": "PUERTA-PRINCIPAL",
    "nombre": "Puerta principal",
    "descripcion": "Valor de desarrollo; pendiente de validación institucional.",
    "latitud": -18.013,
    "longitud": -70.251,
    "radio_permitido_metros": 150,
    "estado": "ACTIVO"
  }'
```

Deshabilitarlo sin perder el historial:

```bash
curl --request PATCH "$API_UPT/administracion/puntos-acceso/ID" \
  --header "authorization: Bearer $TOKEN_ADMINISTRADOR" \
  --header 'content-type: application/json' \
  --data '{"estado":"INACTIVO"}'
```

Las coordenadas del ejemplo son referenciales y no constituyen ubicaciones
oficiales aprobadas por la UPT.

## Auditoría y configuraciones

Consultar acciones realizadas sobre puntos:

```bash
curl --get "$API_UPT/administracion/auditoria" \
  --header "authorization: Bearer $TOKEN_ADMINISTRADOR" \
  --data-urlencode 'entidad=PUNTO_ACCESO' \
  --data-urlencode 'pagina=1' \
  --data-urlencode 'limite=20'
```

Consultar configuraciones:

```bash
curl "$API_UPT/administracion/configuraciones" \
  --header "authorization: Bearer $TOKEN_ADMINISTRADOR"
```

Actualizar la duración del QR:

```bash
curl --request PUT \
  "$API_UPT/administracion/configuraciones/DURACION_QR_SEGUNDOS" \
  --header "authorization: Bearer $TOKEN_ADMINISTRADOR" \
  --header 'content-type: application/json' \
  --data '{"valor":45}'
```

Los rangos permitidos son provisionales:

| Clave | Rango editable |
| --- | --- |
| `DURACION_QR_SEGUNDOS` | 15 a 300 segundos. |
| `ANTIGUEDAD_MAXIMA_UBICACION_SEGUNDOS` | 5 a 120 segundos. |
| `DESFASE_FUTURO_UBICACION_SEGUNDOS` | 1 a 30 segundos. |
| `PRECISION_MAXIMA_UBICACION_METROS` | 5 a 500 metros. |
| `QR_UN_SOLO_USO` | Sólo lectura y obligatorio para este flujo. |

Cada creación o actualización de puntos y cada cambio de configuración genera
un registro de auditoría. Los roles siguen siendo un catálogo fijo; su
asignación a usuarios se realiza con las rutas del Hito 3.

## Historial reciente de seguridad

Cada operador puede consultar hasta sus últimos 50 intentos:

```bash
export TOKEN_SEGURIDAD='reemplazar-por-el-token-de-seguridad'
curl "$API_UPT/ingresos/recientes?limite=20" \
  --header "authorization: Bearer $TOKEN_SEGURIDAD"
```

La consulta queda limitada al usuario autenticado. Los intentos denegados no
incluyen identidad, incluso si internamente el token pudo relacionarse con un
usuario. Los autorizados incluyen únicamente código y nombre para el contexto
operativo reciente.
