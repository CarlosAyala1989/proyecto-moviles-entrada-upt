# Issue #9: Resultado claro y comprobación de datos mínimos

Contrato de API para integrar la aplicación de seguridad. Revisión: **27 de octubre de 2026**.

La decisión incluye un indicador explícito `puede_confirmar`, ID de validación y fotografía disponible. El repositorio no autoriza si faltan nombre o código; el servicio rechaza también una autorización incoherente sin identidad mínima.

## Endpoints y permisos

`POST /api/ingresos/validar`, con Bearer `SEGURIDAD`, puerta asignada y GPS actual.

URL base: `https://api-moviles.fottuto.men/api`. Las rutas anteriores incluyen `/api`;
no dupliques ese prefijo al concatenar. Se requiere `Authorization: Bearer <token_acceso>`
de la API UPT, no un token de Google. Para cuerpos JSON utiliza `Content-Type: application/json`.
La respuesta lleva `Cache-Control: no-store`.

## Qué enviar

```json
{
  "codigo_qr": "<cadena completa recién escaneada>",
  "punto_acceso_codigo": "PUERTA-PRINCIPAL",
  "ubicacion": {
    "latitud": -18.013,
    "longitud": -70.251,
    "precision_metros": 5,
    "obtenida_en": "2026-10-27T15:00:00.000Z"
  }
}
```


Los identificadores, fechas, URLs y coordenadas son ejemplos ficticios. Usa los valores
reales obtenidos durante la operación. La hora `obtenida_en` debe corresponder a la
captura actual del GPS del guardia. No hardcodees el GPS de los ejemplos.

## Qué recibir y cómo interpretarlo

```json
{
  "datos": {
    "registro_id": 125,
    "turno_id": 7,
    "puede_confirmar": true,
    "resultado": "AUTORIZADO",
    "motivo": "ACCESO_AUTORIZADO",
    "mensaje": "La identidad y la ubicación fueron confirmadas.",
    "accion_sugerida": "Verifica visualmente la fotografía y los datos antes de permitir el paso.",
    "registrado_en": "2026-10-27T15:00:00.000Z",
    "punto_acceso": {
      "codigo": "PUERTA-PRINCIPAL",
      "nombre": "Puerta principal"
    },
    "identidad": {
      "foto_url": "https://example.invalid/foto-ficticia.png",
      "nombre_completo": "ANA MARIA PRUEBA FICTICIA",
      "codigo_institucional": "2026000001",
      "tipo_usuario": [
        "ESTUDIANTE"
      ]
    }
  }
}
```


`puede_confirmar` solo es true en AUTORIZADO con nombre, código y al menos un tipo de usuario. La fotografía es nullable porque el catálogo puede no tenerla; la app debe distinguir ese caso de un fallo o de una foto verificada. `registro_id` identifica la decisión persistida y `turno_id` es nullable.

## Reglas y límites del backend

- Resultado de negocio: AUTORIZADO o DENEGADO.
- Un HTTP 200 con datos incompletos no basta para permitir el paso.
- Si faltan datos mínimos del titular, se registra una denegación DATOS_IDENTIDAD_INCOMPLETOS sin consumir la credencial.
- Si un adaptador devolviese AUTORIZADO sin identidad mínima, el servicio responde 502 y la app debe detenerse.
- No hay un segundo endpoint para que el cliente cambie una denegación a autorización.
- La fotografía se proporciona como URL existente, no se modifica ni descarga en el backend durante el escaneo.
- Los datos académicos se eliminaron del contrato de validación.

## Implementación en la app

1. Decodificar el JSON real y comprobar resultado, puede_confirmar e identidad antes de habilitar confirmación visual.
2. Mostrar estado por texto e icono además del color.
3. Cargar foto_url con estado de carga y error; no mostrar un icono genérico como si fuese la foto recibida.
4. Presentar nombre, código y tipo de usuario para el cotejo visual.
5. En denegación ocultar la identidad de una operación anterior y mostrar causa/acción actuales.
6. Usar registro_id para la opción de incidencia.
7. Al iniciar otro escaneo limpiar los datos anteriores.

## Errores y recuperación

`502 RESPUESTA_VALIDACION_INCOMPLETA`: no confirmar; informar operación no completada y revisar integración. `DATOS_IDENTIDAD_INCOMPLETOS` llega como motivo de DENEGADO/200. `401/403/422` son errores de operación, no autorizaciones.

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

- Verificar que el flujo muestra fotografía real de un usuario ficticio con URL válida en el entorno de prueba.
- Probar foto nula y descarga fallida de imagen.
- Probar identidad nula, nombre vacío o código ausente: no debe confirmarse.
- Verificar que el resultado no hereda la identidad del escaneo anterior.

Condición defensiva sugerida en Dart (adaptar al modelo):

```dart
final identidad = datos['identidad'] as Map<String, dynamic>?;
final puedeConfirmar = datos['resultado'] == 'AUTORIZADO' &&
    datos['puede_confirmar'] == true &&
    identidad != null &&
    (identidad['nombre_completo'] as String? ?? '').trim().isNotEmpty &&
    (identidad['codigo_institucional'] as String? ?? '').trim().isNotEmpty &&
    (identidad['tipo_usuario'] as List<dynamic>? ?? []).isNotEmpty;
```

No sustituir un campo ausente por true. El modelo antiguo que solo compara
`resultado == 'AUTORIZADO'` debe actualizarse en la aplicación del equipo.

## Alcance y referencias

Este cambio implementa y prueba el backend. El formulario, navegación, cámara,
confirmaciones visuales y persistencia temporal deben conectarse en la app de seguridad;
no se modificó Flutter en este trabajo. Para acceder a estas rutas se debe desplegar la
API con la migración `014_operaciones_seguridad.sql`.

Consulta el [índice y contrato común](README.md), las [rutas de operación](../../src/modulos/control_acceso/control_acceso.rutas.js)
y las [pruebas de integración](../../test/control_acceso.prueba.js).
