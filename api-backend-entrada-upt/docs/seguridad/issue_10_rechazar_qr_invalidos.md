# Issue #10: Rechazar QR inválidos y consumidos

Contrato de API para integrar la aplicación de seguridad. Revisión: **27 de octubre de 2026**.

La validación de QR ya existente ahora aplica también bloqueos y reglas configurables. El QR normal se consume siempre en una autorización; una bandera histórica false no habilita reutilización.

## Endpoints y permisos

`POST /api/ingresos/validar`, exclusivamente con Bearer `SEGURIDAD`, asignación y GPS actual del guardia.

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

`codigo_qr` es la cadena completa leída por la cámara: QR normal `upt_qr_v1...` u offline `upt_offline_v2...`. No se envía solo el OTP de seis dígitos.

Los identificadores, fechas, URLs y coordenadas son ejemplos ficticios. Usa los valores
reales obtenidos durante la operación. La hora `obtenida_en` debe corresponder a la
captura actual del GPS del guardia. No hardcodees el GPS de los ejemplos.

## Qué recibir y cómo interpretarlo

```json
{
  "datos": {
    "registro_id": 125,
    "turno_id": 7,
    "puede_confirmar": false,
    "resultado": "DENEGADO",
    "motivo": "CREDENCIAL_YA_UTILIZADA",
    "mensaje": "Este código ya fue usado y no puede aceptarse nuevamente.",
    "accion_sugerida": "Espera la siguiente rotación y escanea el nuevo código.",
    "registrado_en": "2026-10-27T15:00:00.000Z",
    "punto_acceso": {
      "codigo": "PUERTA-PRINCIPAL",
      "nombre": "Puerta principal"
    }
  }
}
```


Una decisión persistida contiene `registro_id`, resultado, motivo, mensaje, acción, fecha, puerta y `puede_confirmar`. Una denegación no contiene identidad.

## Reglas y límites del backend

- Conserva integridad de referencia/OTP/nonce en QR normal y HMAC/OTP en QR offline.
- Rechaza códigos desconocidos, alterados, expirados, anulados o consumidos.
- Comprueba usuario, rol, sesión cuando corresponde, puerta y zona del guardia.
- Aplica reglas y bloqueo antes de consumir un QR válido.
- QR normal: transición de PENDIENTE a USADA en la misma transacción de la autorización.
- QR offline: uso único por dispositivo e intervalo de tiempo entre todas las puertas.
- Dos solicitudes concurrentes sobre el mismo QR no deben producir dos autorizaciones.
- El QR offline puede seguir siendo generado sin red; el guardia necesita conexión para validarlo.

## Implementación en la app

1. Conectar el callback de la cámara al HTTP real; retirar los botones que construyen resultados simulados.
2. Evitar envíos simultáneos del mismo fotograma mientras una petición está en curso.
3. Capturar ubicación reciente y obtener la puerta asignada mediante la comprobación de ubicación existente.
4. Mostrar el resultado devuelto; nunca fabricar AUTORIZADO localmente.
5. Ante fallo de red, mostrar operación no confirmada: el servidor pudo registrar la decisión antes de perderse la respuesta.
6. Al reintentar el mismo QR, respetar una eventual denegación por reutilización.
7. Si procede, registrar incidencia con el registro_id recibido.

## Errores y recuperación

HTTP `400` si la forma del JSON es inválida; `401` si la sesión no sirve; `403/422` por puerta, asignación o GPS. Si el JSON es válido y la API registra una denegación, devuelve 200 y el motivo de negocio: `TOKEN_INVALIDO`, `INTEGRIDAD_CREDENCIAL_INVALIDA`, `CREDENCIAL_EXPIRADA`, `CREDENCIAL_REVOCADA`, `CREDENCIAL_YA_UTILIZADA`, entre otros.

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

- Escanear el mismo código dos veces: una autorización como máximo.
- Alterar cada componente del QR y verificar rechazo.
- Probar expiración, revocación y dos solicitudes concurrentes.
- Probar horario denegado para QR normal/offline.
- Comprobar que la app no usa respuestas simuladas como evidencia de ingreso.



## Alcance y referencias

Este cambio implementa y prueba el backend. El formulario, navegación, cámara,
confirmaciones visuales y persistencia temporal deben conectarse en la app de seguridad;
no se modificó Flutter en este trabajo. Para acceder a estas rutas se debe desplegar la
API con la migración `014_operaciones_seguridad.sql`.

Consulta el [índice y contrato común](README.md), las [rutas de operación](../../src/modulos/control_acceso/control_acceso.rutas.js)
y las [pruebas de integración](../../test/control_acceso.prueba.js).
