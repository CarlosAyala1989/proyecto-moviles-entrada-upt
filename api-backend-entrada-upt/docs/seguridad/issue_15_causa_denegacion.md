# Issue #15: Causa general y acción sugerida de una denegación

Contrato de API para integrar la aplicación de seguridad. Revisión: **27 de octubre de 2026**.

La decisión conserva su motivo estable y mensaje, y añade `accion_sugerida` para orientar al operador en todos los casos. No divulga el motivo confidencial del bloqueo ni la identidad en una denegación.

## Endpoints y permisos

`POST /api/ingresos/validar`, con los permisos operativos de seguridad.

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
    "puede_confirmar": false,
    "resultado": "DENEGADO",
    "motivo": "FUERA_HORARIO_PERMITIDO",
    "mensaje": "El ingreso no está permitido en este horario.",
    "accion_sugerida": "Indica al titular que consulte su horario de acceso autorizado.",
    "registrado_en": "2026-10-27T15:00:00.000Z",
    "punto_acceso": {
      "codigo": "PUERTA-PRINCIPAL",
      "nombre": "Puerta principal"
    }
  }
}
```


`motivo` es el código estable para lógica; `mensaje` y `accion_sugerida` son textos para mostrar. No vincular la lógica a una coincidencia exacta de mensajes. Guardar registro_id si se registra incidencia.

## Reglas y límites del backend

- Token inválido/alterado: solicitar QR nuevo; si se repite, incidencia.
- QR vencido: solicitar código vigente.
- Reutilizado: esperar nueva rotación.
- Sesión inválida: pedir nuevo inicio de sesión con conexión.
- Dispositivo desvinculado: pedir vinculación en línea.
- Hora offline incorrecta: sincronizar la hora del titular.
- Horario no permitido: consultar horario autorizado.
- Puerta/zona: comprobar asignación y ubicación del guardia.
- Cuenta, rol, identidad incompleta o bloqueo: contactar administración; incidencia cuando corresponda.
- Existe una acción genérica segura para causas no reconocidas, sin conceder permiso.
- Si un rechazo ocurre antes de registrar la decisión (por autenticación, GPS o JSON), se recibe error HTTP y puede no haber registro_id.

## Implementación en la app

1. Presentar título «Ingreso denegado», causa general y siguiente paso.
2. Ocultar cualquier identidad del escaneo anterior.
3. Mantener motivo para diagnóstico controlado; no imprimir QR o secretos.
4. Ofrecer «Escanear de nuevo» y «Registrar incidencia» solo cuando exista registro_id.
5. Para motivos futuros desconocidos, mostrar mensaje/acción recibidos o una indicación genérica sin autorizar.
6. No pedir al operador que ignore las reglas o fuerce el ingreso.

## Errores y recuperación

Los motivos de negocio se reciben con HTTP 200 y resultado DENEGADO. Los 401/403/422 se muestran como fallos de operación con mensaje de error y sin asumir que existe una validación registrada. Timeout o desconexión no significa que se haya autorizado ni que no exista un registro en servidor.

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

- Provocar expiración, reutilización, integridad inválida y horario denegado.
- Comprobar que cada decisión tiene accion_sugerida no vacía.
- Probar un motivo desconocido en el cliente: debe continuar denegando.
- Confirmar que el motivo de bloqueo administrativo no se filtra en la pantalla del guardia.



## Alcance y referencias

Este cambio implementa y prueba el backend. El formulario, navegación, cámara,
confirmaciones visuales y persistencia temporal deben conectarse en la app de seguridad;
no se modificó Flutter en este trabajo. Para acceder a estas rutas se debe desplegar la
API con la migración `014_operaciones_seguridad.sql`.

Consulta el [índice y contrato común](README.md), las [rutas de operación](../../src/modulos/control_acceso/control_acceso.rutas.js)
y las [pruebas de integración](../../test/control_acceso.prueba.js).
