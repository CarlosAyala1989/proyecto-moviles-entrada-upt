# Issue #24: Minimizar los datos visibles

Contrato de API para integrar la aplicación de seguridad. Revisión: **27 de octubre de 2026**.

La autorización conserva fotografía, nombre, código y tipo de usuario. Se eliminaron escuela y estado académico de las respuestas de validación normal y offline. Las denegaciones no incluyen identidad.

## Endpoints y permisos

| Método y ruta | Permiso |
| --- | --- |
| `POST /api/ingresos/validar` | `SEGURIDAD`, puerta asignada y ubicación válida. |
| `GET /api/ingresos/recientes` | `SEGURIDAD`, registros propios y puerta asignada. |

URL base: `https://api-moviles.fottuto.men/api`. Las rutas anteriores incluyen `/api`;
no dupliques ese prefijo al concatenar. Se requiere `Authorization: Bearer <token_acceso>`
de la API UPT, no un token de Google. Para cuerpos JSON utiliza `Content-Type: application/json`.
La respuesta lleva `Cache-Control: no-store`.

## Qué enviar

La petición de escaneo conserva su contrato; no recibe datos personales añadidos por la app.

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


`datos.identidad` contiene únicamente `foto_url` (string o null), `nombre_completo`, `codigo_institucional` y `tipo_usuario` (array). `escuela` y `estado_academico` ya no se envían. En recientes solo se conserva `usuario.codigo_enmascarado`; no se devuelve el nombre ni el código íntegro.

## Reglas y límites del backend

- No se devuelven QR, OTP, nonce, secretos ni coordenadas en la decisión.
- El QR identifica a la persona en el servidor; el cliente no envía un nombre para que la API lo acepte.
- Los logs HTTP registran método, plantilla de ruta, estado y duración, sin query string, cuerpo, Bearer o IP.
- Los errores imprevistos registran código y tipo, sin SQL, parámetros ni mensaje interno.
- La auditoría autorizada mantiene el actor y datos necesarios para trazabilidad; no es una pantalla pública. Los logs del proxy/Dokploy están fuera del logger de Express y deben configurarse por separado.

## Implementación en la app

1. Eliminar los campos académicos de las tarjetas de resultado y del modelo obligatorio del escaneo.
2. Mostrar la fotografía indicada por `foto_url` cuando exista; manejar URL nula o fallo de imagen con un estado explícito de fotografía no disponible.
3. No guardar la respuesta del escaneo como historial local de identidades.
4. Al volver a escanear o salir, limpiar QR y datos temporales.
5. En recientes mostrar código enmascarado, resultado, fecha y puerta; no intentar reconstruir el código completo.

## Errores y recuperación

`401`: renovar o iniciar sesión. `403`: revisar rol/asignación/zona. `400`: revisar JSON. Si falla la descarga de la fotografía, no fabricar una foto ni presentar el icono como una fotografía verificada.

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

- Autorizar un QR normal y uno offline y comprobar que ninguno incluye campos académicos.
- Escanear un QR inválido y comprobar que no aparece `identidad`.
- Revisar recientes y verificar que no contiene nombre ni código completo.
- Revisar que el cliente no imprima el QR ni el Bearer en sus logs.



## Alcance y referencias

Este cambio implementa y prueba el backend. El formulario, navegación, cámara,
confirmaciones visuales y persistencia temporal deben conectarse en la app de seguridad;
no se modificó Flutter en este trabajo. Para acceder a estas rutas se debe desplegar la
API con la migración `014_operaciones_seguridad.sql`.

Consulta el [índice y contrato común](README.md), las [rutas de operación](../../src/modulos/control_acceso/control_acceso.rutas.js)
y las [pruebas de integración](../../test/control_acceso.prueba.js).
