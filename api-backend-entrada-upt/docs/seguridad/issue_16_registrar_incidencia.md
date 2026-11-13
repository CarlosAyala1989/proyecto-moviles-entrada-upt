# Issue #16: Registrar una incidencia vinculada a una validación

Contrato de API para integrar la aplicación de seguridad. Revisión: **27 de octubre de 2026**.

La API permite registrar una observación con tipo, validación asociada y responsable derivado de la sesión. Los reintentos con la misma clave son idempotentes.

## Endpoints y permisos

| Método y ruta | Permiso |
| --- | --- |
| `POST /api/ingresos/:id/incidencias` | Guardia que realizó la validación. |
| `GET /api/ingresos/:id/incidencias` | El mismo guardia; devuelve hasta las últimas 50. |
| `GET /api/administracion/incidencias?pagina=1&limite=20` | Administrador; lista global paginada. |

URL base: `https://api-moviles.fottuto.men/api`. Las rutas anteriores incluyen `/api`;
no dupliques ese prefijo al concatenar. Se requiere `Authorization: Bearer <token_acceso>`
de la API UPT, no un token de Google. Para cuerpos JSON utiliza `Content-Type: application/json`.
La respuesta lleva `Cache-Control: no-store`.

## Qué enviar

`:id` se obtiene de `datos.registro_id` del escaneo, o de `datos[].id` de recientes. No es el ID de usuario.

```json
{
  "tipo": "PROBLEMA_QR",
  "observacion": "La pantalla del teléfono no permitió leer el código.",
  "clave_idempotencia": "44ef69a2-2d03-4357-b52a-b1f75887e070"
}
```


Los identificadores, fechas, URLs y coordenadas son ejemplos ficticios. Usa los valores
reales obtenidos durante la operación. La hora `obtenida_en` debe corresponder a la
captura actual del GPS del guardia. No hardcodees el GPS de los ejemplos.

## Qué recibir y cómo interpretarlo

```json
{
  "datos": {
    "id": 8,
    "registro_acceso_id": 125,
    "responsable_id": 31,
    "tipo": "PROBLEMA_QR",
    "observacion": "La pantalla del teléfono no permitió leer el código.",
    "clave_idempotencia": "44ef69a2-2d03-4357-b52a-b1f75887e070",
    "creado_en": "2026-10-27T15:00:00.000Z"
  }
}
```


Primera creación: `201`. Repetición idéntica: `200`, con el mismo ID. El listado administrativo añade `paginacion` con `pagina`, `limite`, `total` y `total_paginas`.

## Reglas y límites del backend

- `tipo`: `DOCUMENTO_NO_COINCIDE`, `SUPLANTACION`, `PROBLEMA_QR` u `OTRA`.
- `observacion`: texto recortado, de 10 a 1000 caracteres.
- `clave_idempotencia`: UUID nuevo por incidencia lógica.
- Responsable y fecha son del servidor. No se aceptan campos para suplantar al responsable.
- Se admite una validación autorizada o denegada propia, incluso si el QR no permitió identificar a una persona.
- Registrar una incidencia no modifica el resultado del ingreso y no bloquea automáticamente la identidad.
- No hay edición/borrado de incidencias ni subida de fotos adjuntas en este contrato.

## Implementación en la app

1. Guardar `registro_id` al recibir el resultado del escaneo.
2. Mostrar «Registrar incidencia» desde ese resultado o un registro propio reciente.
3. Pedir tipo y observación; evitar datos personales no necesarios en el texto.
4. Generar el UUID antes de enviar y conservarlo si ocurre timeout.
5. Reintentar con ese mismo UUID y el mismo cuerpo; para otro incidente generar otro UUID.
6. Mostrar el número de incidencia y refrescar el listado propio.
7. En el perfil administrador puede consultarse el listado global con paginación.

## Errores y recuperación

`400`: tipo/observación/UUID inválidos o campos ajenos. `404 VALIDACION_NO_ENCONTRADA`: ID inexistente o de otro guardia. `409 IDEMPOTENCIA_EN_CONFLICTO`: se reutilizó el UUID para otro contenido o validación. Los guardias no pueden acceder al listado administrativo (`403`).

Los errores HTTP tienen la forma:

```json
{
  "error": {
    "codigo": "DATOS_INVALIDOS",
    "mensaje": "Los datos de cuerpo no son válidos."
  }
}
```

No conviertas un timeout, un error de conexión, un JSON incompleto o un HTTP 4xx/5xx
en una autorización. Un resultado de negocio `DENEGADO` puede responder HTTP 200;
se interpreta el cuerpo, no solo el estado HTTP.

## Comprobaciones de aceptación

- Crear sobre validación propia, repetirla y comprobar que solo hay una fila.
- Enviar dos peticiones simultáneas con el mismo UUID: una crea y la otra recupera.
- Intentar vincular una validación de otro guardia: debe responder 404.
- Verificar actor y auditoría sin almacenar la observación en el log HTTP.



## Alcance y referencias

Este cambio implementa y prueba el backend. El formulario, navegación, cámara,
confirmaciones visuales y persistencia temporal deben conectarse en la app de seguridad;
no se modificó Flutter en este trabajo. Para acceder a estas rutas se debe desplegar la
API con la migración `014_operaciones_seguridad.sql`.

Consulta el [índice y contrato común](README.md), las [rutas de operación](../../src/modulos/control_acceso/control_acceso.rutas.js)
y las [pruebas de integración](../../test/control_acceso.prueba.js).
