# Issue #20: Bloquear y rehabilitar una identidad con motivo y vencimiento

Contrato de API para integrar la aplicación de seguridad. Revisión: **27 de octubre de 2026**.

Un bloqueo es una restricción adicional con historial propio. No sobrescribe estado o autorización previos del usuario: al vencer o rehabilitarse deja de restringir, sin restaurar credenciales ni conceder permisos anteriores por error.

## Endpoints y permisos

| Método y ruta | Permiso |
| --- | --- |
| `POST /api/administracion/usuarios/:id/bloqueos` | `ADMINISTRADOR`; bloqueo inmediato. |
| `GET /api/administracion/usuarios/:id/bloqueos` | `ADMINISTRADOR`; últimas 50 restricciones. |
| `POST /api/administracion/usuarios/:id/bloqueos/:bloqueo_id/rehabilitar` | `ADMINISTRADOR`. |

URL base: `https://api-moviles.fottuto.men/api`. Las rutas anteriores incluyen `/api`;
no dupliques ese prefijo al concatenar. Se requiere `Authorization: Bearer <token_acceso>`
de la API UPT, no un token de Google. Para cuerpos JSON utiliza `Content-Type: application/json`.
La respuesta lleva `Cache-Control: no-store`.

## Qué enviar

Crear bloqueo:

```json
{
  "motivo": "Restricción temporal pendiente de revisión.",
  "vigente_hasta": "2026-11-01T18:00:00-05:00",
  "confirmacion": true
}
```

Rehabilitar un bloqueo concreto:

```json
{
  "motivo": "Se completó la revisión de la identidad.",
  "confirmacion": true
}
```


Los identificadores, fechas, URLs y coordenadas son ejemplos ficticios. Usa los valores
reales obtenidos durante la operación. La hora `obtenida_en` debe corresponder a la
captura actual del GPS del guardia. No hardcodees el GPS de los ejemplos.

## Qué recibir y cómo interpretarlo

```json
{
  "datos": {
    "id": 4,
    "usuario_id": 42,
    "motivo": "Restricción temporal pendiente de revisión.",
    "creado_por": 11,
    "vigente_desde": "2026-10-27T15:00:00.000Z",
    "vigente_hasta": "2026-11-01T23:00:00.000Z",
    "rehabilitado_en": null,
    "rehabilitado_por": null,
    "motivo_rehabilitacion": null
  }
}
```


Crear devuelve `201`. Rehabilitar devuelve `200` y completa `rehabilitado_en`, `rehabilitado_por`, `motivo_rehabilitacion`. El GET devuelve array y añade el booleano `vigente` calculado al consultar.

## Reglas y límites del backend

- Motivo de bloqueo y rehabilitación: 10 a 500 caracteres. `confirmacion` debe ser literalmente true.
- Inicio inmediato asignado por el servidor. `vigente_hasta` es fecha futura o null para duración indefinida; no se aceptan bloqueos programados para empezar después.
- No se puede bloquear la propia cuenta administradora. No se crea un segundo bloqueo vigente sobre la misma identidad.
- Al bloquear se revocan sesiones, QR pendientes y secretos offline del titular. Se registra actor, motivo y vencimiento en auditoría.
- Se deniega la creación de una nueva sesión mientras el bloqueo está vigente, también si procede de Google.
- El validador vuelve a comprobar el bloqueo, por si una credencial sigue activa.
- La expiración se evalúa en cada operación y no requiere cron. No elimina el historial.
- Rehabilitar es idempotente; repetirlo conserva la primera rehabilitación. No activa usuarios INACTIVOS ni autoriza usuarios DENEGADOS.
- Las sesiones y secretos revocados no se recuperan al vencer: el titular debe iniciar sesión y vincular el teléfono de nuevo.
- La antigua ruta PATCH de estado sigue existiendo para gestión básica; para motivo/vigencia e historial se usan estas rutas.

## Implementación en la app

1. Encontrar el ID del usuario desde administración; no deducirlo de un nombre ni de un código enmascarado.
2. Mostrar su estado base y consultar el historial de bloqueos.
3. Pedir motivo y duración o «sin vencimiento».
4. Mostrar una confirmación explícita con la identidad objetivo; solo entonces enviar confirmacion true.
5. Conservar el ID del bloqueo devuelto para rehabilitar el registro correcto.
6. En rehabilitación, pedir un motivo nuevo y otra confirmación.
7. Refrescar estado e historial; explicar al titular que deberá reautenticarse si sus credenciales fueron revocadas.

## Errores y recuperación

`400`: motivo, fecha o confirmación inválidos. `404 USUARIO_NO_ENCONTRADO` o `BLOQUEO_NO_ENCONTRADO`: revisar referencia. `409 IDENTIDAD_YA_BLOQUEADA`: refrescar el historial antes de operar. `409 ADMINISTRADOR_NO_PUEDE_DESHABILITARSE`: objetivo propio. `403`: operación fuera del rol administrador. Inicio de sesión bloqueado: `403 IDENTIDAD_BLOQUEADA`.

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

- Bloquear y confirmar revocación de sesión y dispositivo offline.
- Comprobar que un secreto previo no vuelve a ser válido tras rehabilitar.
- Simular vencimiento en la base de pruebas y comprobar que permite un nuevo login sin cron.
- Verificar que estado base ACTIVO/INACTIVO no se reemplaza silenciosamente.
- Verificar permisos y confirmación literal requerida.



## Alcance y referencias

Este cambio implementa y prueba el backend. El formulario, navegación, cámara,
confirmaciones visuales y persistencia temporal deben conectarse en la app de seguridad;
no se modificó Flutter en este trabajo. Para acceder a estas rutas se debe desplegar la
API con la migración `014_operaciones_seguridad.sql`.

Consulta el [índice y contrato común](README.md), las [rutas de operación](../../src/modulos/control_acceso/control_acceso.rutas.js)
y las [pruebas de integración](../../test/control_acceso.prueba.js).
