# Issue #14: Búsqueda manual controlada para seguridad

Contrato de API para integrar la aplicación de seguridad. Revisión: **27 de octubre de 2026**.

Existe una búsqueda exacta operativa, con motivo obligatorio, geocerca y auditoría. No autoriza ingresos ni sustituye la validación criptográfica del QR.

## Endpoints y permisos

`POST /api/seguridad/identidades/buscar`, Bearer `SEGURIDAD`, asignación activa y ubicación válida.

URL base: `https://api-moviles.fottuto.men/api`. Las rutas anteriores incluyen `/api`;
no dupliques ese prefijo al concatenar. Se requiere `Authorization: Bearer <token_acceso>`
de la API UPT, no un token de Google. Para cuerpos JSON utiliza `Content-Type: application/json`.
La respuesta lleva `Cache-Control: no-store`.

## Qué enviar

```json
{
  "codigo": "2026000001",
  "motivo": "Verificar identidad ante dificultad de lectura.",
  "ubicacion": {
    "latitud": -18.013,
    "longitud": -70.251,
    "precision_metros": 5,
    "obtenida_en": "2026-10-27T15:00:00.000Z"
  }
}
```

Enviar alternativamente `correo` en lugar de `codigo`, nunca ambos. No hay búsqueda por nombres, prefijos ni comodines en este endpoint.

Los identificadores, fechas, URLs y coordenadas son ejemplos ficticios. Usa los valores
reales obtenidos durante la operación. La hora `obtenida_en` debe corresponder a la
captura actual del GPS del guardia. No hardcodees el GPS de los ejemplos.

## Qué recibir y cómo interpretarlo

```json
{
  "datos": {
    "id": 42,
    "foto_url": "https://example.invalid/foto-ficticia.png",
    "nombre_completo": "ANA MARIA PRUEBA FICTICIA",
    "codigo_institucional": "2026000001",
    "estado": "ACTIVO",
    "estado_autorizacion": "AUTORIZADO",
    "identidad_verificada": true,
    "bloqueo_vigente": false,
    "permite_ingreso": false
  }
}
```


Coincidencia: objeto mínimo con ID, fotografía, nombre, código y estado. Sin coincidencia: `200 {"datos":null}`. No se devuelve correo, escuela, estado académico, historial, secretos ni códigos QR.

## Reglas y límites del backend

- Exactamente uno entre codigo y correo. Código: 3 a 30 caracteres alfanuméricos, punto, guion o guion bajo. Correo válido hasta 254 caracteres.
- Motivo: 10 a 500 caracteres. Ubicación anidada obligatoria.
- Código comparado en mayúsculas y correo en minúsculas; no se usa LIKE.
- Límite compartido por usuario: 20 búsquedas exitosamente procesadas por minuto móvil, incluidas las que no hallan usuario. Se guarda en auditoría y funciona entre réplicas.
- Auditoría: actor, criterio CODIGO/CORREO, motivo e ID encontrado o SIN_COINCIDENCIA. No conserva el código/correo literal buscado en ese detalle.
- `permite_ingreso` siempre es false: encontrar una cuenta, aunque esté activa, no constituye autorización. `bloqueo_vigente` es informativo y no contiene su motivo confidencial.

## Implementación en la app

1. Sustituir el generador de usuarios de ejemplo por la llamada HTTP.
2. Elegir código o correo y pedir la justificación.
3. Comprobar ubicación antes de buscar.
4. Deshabilitar el botón mientras se procesa; no buscar en cada pulsación del teclado.
5. Tratar datos null como «Sin coincidencias», sin inventar una persona.
6. Mostrar únicamente los campos mínimos. Mantener separado el botón/flujo de escaneo.
7. Para una incidencia usar una validación propia existente; esta búsqueda no crea un registro de ingreso.

## Errores y recuperación

`400 DATOS_INVALIDOS`: se enviaron ambos criterios, ninguno, formato inválido o motivo insuficiente. `403`: rol/asignación/zona. `429 LIMITE_BUSQUEDA_MANUAL`: esperar y evitar reintentos automáticos; la ventana móvil expira conforme a la hora del servidor.

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

- Buscar código exacto y correo exacto del mismo usuario ficticio.
- Probar código inexistente y verificar datos null.
- Enviar % o ambos criterios: 400.
- Operar fuera de zona: 403.
- Superar el límite: 429.
- Confirmar que la app nunca muestra «Autorizado» a partir de esta respuesta.



## Alcance y referencias

Este cambio implementa y prueba el backend. El formulario, navegación, cámara,
confirmaciones visuales y persistencia temporal deben conectarse en la app de seguridad;
no se modificó Flutter en este trabajo. Para acceder a estas rutas se debe desplegar la
API con la migración `014_operaciones_seguridad.sql`.

Consulta el [índice y contrato común](README.md), las [rutas de operación](../../src/modulos/control_acceso/control_acceso.rutas.js)
y las [pruebas de integración](../../test/control_acceso.prueba.js).
