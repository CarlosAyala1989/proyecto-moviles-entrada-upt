# Issue #22: Reglas configurables por rol, estado, horario y vigencia

Contrato de API para integrar la aplicación de seguridad. Revisión: **27 de octubre de 2026**.

Las reglas administrables se aplican durante cada validación, para QR normal y offline. El backend evalúa el reloj de la base de datos y el horario local de Lima.

## Endpoints y permisos

| Método y ruta | Permiso |
| --- | --- |
| `GET /api/administracion/reglas-acceso?pagina=1&limite=20` | `ADMINISTRADOR`. |
| `POST /api/administracion/reglas-acceso` | `ADMINISTRADOR`; crear. |
| `PUT /api/administracion/reglas-acceso/:id` | `ADMINISTRADOR`; sustituir configuración completa. |

URL base: `https://api-moviles.fottuto.men/api`. Las rutas anteriores incluyen `/api`;
no dupliques ese prefijo al concatenar. Se requiere `Authorization: Bearer <token_acceso>`
de la API UPT, no un token de Google. Para cuerpos JSON utiliza `Content-Type: application/json`.
La respuesta lleva `Cache-Control: no-store`.

## Qué enviar

```json
{
  "nombre": "Ingreso estudiantil de mañana",
  "rol": "ESTUDIANTE",
  "estado_usuario": "ACTIVO",
  "accion": "PERMITIR",
  "punto_acceso_id": 1,
  "dias_semana": [
    1,
    2,
    3,
    4,
    5
  ],
  "hora_inicio": "07:00",
  "hora_fin": "13:00",
  "vigente_desde": "2026-10-27T00:00:00-05:00",
  "vigente_hasta": "2026-12-31T23:59:59-05:00",
  "activo": true
}
```

Para editar, enviar los mismos campos al PUT. Para desactivar, enviar la configuración completa con `activo: false`; no enviar IDs/fechas de auditoría del objeto recibido.

Los identificadores, fechas, URLs y coordenadas son ejemplos ficticios. Usa los valores
reales obtenidos durante la operación. La hora `obtenida_en` debe corresponder a la
captura actual del GPS del guardia. No hardcodees el GPS de los ejemplos.

## Qué recibir y cómo interpretarlo

```json
{
  "datos": {
    "id": 3,
    "nombre": "Ingreso estudiantil de mañana",
    "rol": "ESTUDIANTE",
    "estado_usuario": "ACTIVO",
    "accion": "PERMITIR",
    "punto_acceso_id": 1,
    "dias_semana": [
      1,
      2,
      3,
      4,
      5
    ],
    "hora_inicio": "07:00",
    "hora_fin": "13:00",
    "vigente_desde": "2026-10-27T00:00:00-05:00",
    "vigente_hasta": "2026-12-31T23:59:59-05:00",
    "activo": true,
    "creado_por": 11,
    "actualizado_por": 11,
    "creado_en": "2026-10-27T15:00:00.000Z",
    "actualizado_en": "2026-10-27T15:00:00.000Z"
  }
}
```


Crear responde `201`; editar, `200`. El GET retorna un array en `datos` y metadatos de paginación. `activo` es booleano y `dias_semana` es array de enteros.

## Reglas y límites del backend

- Rol: `ESTUDIANTE`, `DOCENTE` o `TRABAJADOR`. Estado: `ACTIVO`, `PENDIENTE`, `BLOQUEADO`, `INACTIVO` o `RECHAZADO`.
- Las comprobaciones obligatorias de usuario activo, autorización e identidad verificada ocurren antes: una regla PERMITIR no habilita a un usuario bloqueado/inactivo.
- `punto_acceso_id: null` significa todas las puertas; un ID limita la regla a esa puerta.
- Días ISO: lunes 1 a domingo 7, sin repetidos. Horas `HH:mm`, inicio incluido y fin excluido.
- Si inicio y fin son iguales, cubre el día completo. Si inicio es mayor al fin, cruza medianoche y el tramo de madrugada pertenece al día de inicio.
- `vigente_desde` se incluye y `vigente_hasta` se excluye; null significa sin vencimiento. Se reciben fechas con offset o Z.
- Solo participan reglas activas, dentro de su vigencia, con rol/estado/puerta correspondientes.
- Cualquier DENEGAR coincidente prevalece sobre PERMITIR.
- Si hay al menos una PERMITIR aplicable al rol/estado/puerta y vigencia, debe coincidir al menos uno de sus horarios. Fuera de ellos se deniega.
- Sin reglas aplicables se conserva el comportamiento base. La regla de un rol ajeno no restringe al titular.
- Las reglas no consumen el QR al denegar. Se auditan las creaciones/ediciones con el administrador.

## Implementación en la app

1. Restringir el formulario y navegación al administrador.
2. Cargar reglas con paginación y permitir crear/editar sin reenviar campos solo de lectura.
3. Ofrecer selectores de rol, estado, puerta, días, horas y vigencia.
4. Mostrar que las horas se interpretan en `America/Lima` y explicar los intervalos nocturnos.
5. Pedir confirmación visual antes de guardar una regla que afecte múltiples puertas.
6. Desactivar mediante PUT completo con activo false; no borrar el historial.
7. En escaneo mostrar la acción sugerida ante denegación por horario/regla.

## Errores y recuperación

`400 DATOS_INVALIDOS`: horas, días, rol, estado o vigencia inválidos. `400 RELACION_NO_ENCONTRADA`: puerta inexistente. `404 REGLA_NO_ENCONTRADA`: ID inválido. `403`: usuario sin rol administrador. En un escaneo se recibe `REGLA_ACCESO_DENEGADA` o `FUERA_HORARIO_PERMITIDO` con `resultado: DENEGADO` y HTTP 200.

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

- Probar ventanas normales y cruce de medianoche, incluidos límites exactos.
- Probar regla futura, desactivada, de otro rol y de otro estado: no debe afectar.
- Hacer coincidir PERMITIR y DENEGAR: debe prevalecer DENEGAR.
- Repetir con QR offline.
- Cambiar la hora del teléfono del guardia no debe modificar la hora de evaluación de las reglas.

No se implementan excepciones por feriados ni recurrencias mensuales. Los cambios entran en vigor en la siguiente validación; una decisión ya registrada no se reescribe.

## Alcance y referencias

Este cambio implementa y prueba el backend. El formulario, navegación, cámara,
confirmaciones visuales y persistencia temporal deben conectarse en la app de seguridad;
no se modificó Flutter en este trabajo. Para acceder a estas rutas se debe desplegar la
API con la migración `014_operaciones_seguridad.sql`.

Consulta el [índice y contrato común](README.md), las [rutas de operación](../../src/modulos/control_acceso/control_acceso.rutas.js)
y las [pruebas de integración](../../test/control_acceso.prueba.js).
