# Issue #18: Validaciones recientes por puerta y turno

Contrato de API para integrar la aplicación de seguridad. Revisión: **27 de octubre de 2026**.

Los recientes se limitan siempre al guardia autenticado y a su puerta asignada. Se añaden turnos explícitos, filtros y paginación; el historial ya no expone nombre ni código completo.

## Endpoints y permisos

| Método y ruta | Operación |
| --- | --- |
| `POST /api/seguridad/turnos` | Iniciar turno propio con ubicación. |
| `GET /api/seguridad/turnos/actual` | Turno abierto o datos null. |
| `GET /api/seguridad/turnos` | Últimos 50 turnos propios. |
| `POST /api/seguridad/turnos/:id/cerrar` | Cerrar turno propio, con JSON `{}`. |
| `GET /api/ingresos/recientes` | Recientes propios paginados. |

Todas requieren `SEGURIDAD`. Iniciar y consultar recientes requieren GPS/puerta válidos.

URL base: `https://api-moviles.fottuto.men/api`. Las rutas anteriores incluyen `/api`;
no dupliques ese prefijo al concatenar. Se requiere `Authorization: Bearer <token_acceso>`
de la API UPT, no un token de Google. Para cuerpos JSON utiliza `Content-Type: application/json`.
La respuesta lleva `Cache-Control: no-store`.

## Qué enviar

Inicio de turno:

```json
{
  "ubicacion": {
    "latitud": -18.013,
    "longitud": -70.251,
    "precision_metros": 5,
    "obtenida_en": "2026-10-27T15:00:00.000Z"
  }
}
```

Consulta de recientes (query string, no cuerpo):

```http
GET /api/ingresos/recientes?pagina=1&limite=20&punto_acceso_codigo=PUERTA-PRINCIPAL&turno_id=7&latitud=-18.013&longitud=-70.251&precision_metros=5&obtenida_en=2026-10-27T15%3A00%3A00.000Z
```

Los identificadores, fechas, URLs y coordenadas son ejemplos ficticios. Usa los valores
reales obtenidos durante la operación. La hora `obtenida_en` debe corresponder a la
captura actual del GPS del guardia. No hardcodees el GPS de los ejemplos.

## Qué recibir y cómo interpretarlo

```json
{
  "datos": [
    {
      "id": 125,
      "resultado": "AUTORIZADO",
      "motivo": "ACCESO_AUTORIZADO",
      "registrado_en": "2026-10-27T15:00:00.000Z",
      "turno_id": 7,
      "punto_acceso": {
        "codigo": "PUERTA-PRINCIPAL",
        "nombre": "Puerta principal"
      },
      "usuario": {
        "codigo_enmascarado": "******0001"
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


El turno contiene `id`, `usuario_seguridad_id`, `punto_acceso_id`, `iniciado_en`, `cerrado_en` nullable. El GET de turnos añade `punto_acceso_codigo`. Los recientes conservan el array `datos` y añaden `paginacion`.

## Reglas y límites del backend

- `pagina`: desde 1, máximo 100000. `limite`: 1 a 50, predeterminado 20.
- `punto_acceso_codigo` opcional; si se omite se usa la puerta asignada actual. No permite consultar otra puerta.
- `turno_id` opcional; debe ser propio y de esa puerta.
- `desde` y `hasta` opcionales, ISO 8601 con offset; filtros inclusivos y desde <= hasta.
- GPS plano en query: latitud, longitud, precision_metros y obtenida_en, todos obligatorios.
- Un solo turno abierto por guardia. Inicios concurrentes se serializan. Cerrar dos veces es idempotente.
- Cada nueva validación se asocia al turno abierto de ese guardia y esa puerta. Si no hay turno, se permite validar por compatibilidad y turno_id queda null.
- Los registros históricos no reciben un turno inventado retroactivamente. No se usan turnos horarios implícitos.
- Orden descendente por ID de validación; metadatos de paginación por conjunto filtrado.
- Usuario denegado o desconocido: usuario null; autorizado: solo código con los últimos cuatro caracteres visibles.

## Implementación en la app

1. Al comenzar labores, comprobar ubicación e iniciar turno; conservar su ID.
2. Al recuperar la app, consultar turno actual para no abrir otro accidentalmente.
3. En recientes construir query con Uri/queryParameters y las coordenadas actuales.
4. Permitir seleccionar un turno del listado propio y paginar.
5. Mostrar resultado, motivo, fecha, puerta y código enmascarado.
6. Usar id del registro para abrir sus incidencias, no para abrir la ficha completa del titular.
7. Al terminar, cerrar turno con cuerpo vacío JSON; si el guardia cambia de puerta debe cerrar el anterior y comenzar otro.

## Errores y recuperación

`409 TURNO_YA_ABIERTO`: recuperar el turno vigente. `404 TURNO_NO_ENCONTRADO`: ID ajeno/inexistente o de otra puerta. `403 SEGURIDAD_PUNTO_NO_ASIGNADO`: filtro fuera de su asignación. `400`: filtros/fechas inválidos o GPS incompleto. La lista vacía es un 200 con datos [] y total 0.

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

- Abrir turno, validar y comprobar turno_id en resultado e historial.
- Intentar abrir otro: 409. Cerrar y repetir cierre: ambos 200.
- Filtrar turno ajeno: 404.
- Cambiar filtro a otra puerta: 403.
- Comprobar paginación y ausencia de datos personales completos.



## Alcance y referencias

Este cambio implementa y prueba el backend. El formulario, navegación, cámara,
confirmaciones visuales y persistencia temporal deben conectarse en la app de seguridad;
no se modificó Flutter en este trabajo. Para acceder a estas rutas se debe desplegar la
API con la migración `014_operaciones_seguridad.sql`.

Consulta el [índice y contrato común](README.md), las [rutas de operación](../../src/modulos/control_acceso/control_acceso.rutas.js)
y las [pruebas de integración](../../test/control_acceso.prueba.js).
