# Issue #19: Buscar por código o correo desde administración

Contrato de API para integrar la aplicación de seguridad. Revisión: **27 de octubre de 2026**.

La búsqueda administrativa ya existía. Se conserva y se documenta su conexión real para reemplazar los datos de ejemplo de la aplicación. Para el guardia se utiliza la búsqueda controlada del issue #14.

## Endpoints y permisos

| Método y ruta | Permiso |
| --- | --- |
| `GET /api/administracion/usuarios?buscar=...` | `ADMINISTRADOR`. |
| `GET /api/administracion/usuarios/:id` | `ADMINISTRADOR`. |
| `POST /api/seguridad/identidades/buscar` | `SEGURIDAD`; alternativa exacta y mínima del issue #14. |

URL base: `https://api-moviles.fottuto.men/api`. Las rutas anteriores incluyen `/api`;
no dupliques ese prefijo al concatenar. Se requiere `Authorization: Bearer <token_acceso>`
de la API UPT, no un token de Google. Para cuerpos JSON utiliza `Content-Type: application/json`.
La respuesta lleva `Cache-Control: no-store`.

## Qué enviar

```http
GET /api/administracion/usuarios?buscar=2026000001&pagina=1&limite=20
Authorization: Bearer <token_admin>
```

Para correo, usar queryParameters para codificar `buscar=persona@virtual.upt.pe`; no concatenar texto sin codificar. Se puede filtrar además por `estado`.

Los identificadores, fechas, URLs y coordenadas son ejemplos ficticios. Usa los valores
reales obtenidos durante la operación. La hora `obtenida_en` debe corresponder a la
captura actual del GPS del guardia. No hardcodees el GPS de los ejemplos.

## Qué recibir y cómo interpretarlo

```json
{
  "datos": [
    {
      "id": 42,
      "codigo_institucional": "2026000001",
      "correo_institucional": "persona.ficticia@example.invalid",
      "nombres": "ANA MARIA",
      "apellidos": "PRUEBA FICTICIA",
      "estado": "ACTIVO",
      "estado_autorizacion": "AUTORIZADO",
      "roles": [
        "ESTUDIANTE"
      ]
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


El ejemplo es un fragmento de la ficha administrativa: el contrato existente también incluye otros campos públicos del usuario y sus fechas. La respuesta no contiene contraseña ni hashes. La consulta de detalle devuelve datos como objeto, no array.

## Reglas y límites del backend

- `buscar`: texto hasta 150 caracteres, aplicado por la búsqueda administrativa existente a código, correo, nombres o apellidos. No es la búsqueda exacta del guardia.
- pagina predeterminada 1; limite 1 a 100, predeterminado 20.
- Estado: PENDIENTE, ACTIVO, INACTIVO, BLOQUEADO o RECHAZADO.
- El estado base del usuario no sustituye el historial de bloqueos temporales: consultarlo mediante issue #20.
- Esta ruta no se abre al rol SEGURIDAD.
- El logger HTTP ya no imprime query strings de búsquedas.
- No fue necesario duplicar un endpoint administrativo que ya cubría la búsqueda.

## Implementación en la app

1. Detectar perfil administrador y mostrar la vista correspondiente.
2. Conectar el campo de código/correo a la consulta real con paginación.
3. Manejar datos [] sin rellenar resultados locales.
4. Abrir ficha por el id devuelto.
5. Desde la ficha consultar los bloqueos con las rutas del issue #20.
6. Si quien opera es un guardia, no llamar a administración: usar el formulario exacto, motivo y GPS del issue #14.

## Errores y recuperación

`401`: falta sesión válida. `403`: no es administrador. `400`: filtros no permitidos, estado inválido o límite fuera de rango. `404 USUARIO_NO_ENCONTRADO`: ficha inexistente. La ausencia en una búsqueda responde datos [] con paginación.

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

- Buscar por código y por correo con el perfil administrador.
- Verificar ficha por ID y estado devuelto.
- Repetir con guardia y comprobar 403.
- Eliminar datos locales de demostración de los recorridos reales.
- Confirmar que no se deduce autorización de ingreso desde el listado administrativo.



## Alcance y referencias

Este cambio implementa y prueba el backend. El formulario, navegación, cámara,
confirmaciones visuales y persistencia temporal deben conectarse en la app de seguridad;
no se modificó Flutter en este trabajo. Para acceder a estas rutas se debe desplegar la
API con la migración `014_operaciones_seguridad.sql`.

Consulta el [índice y contrato común](README.md), las [rutas de operación](../../src/modulos/control_acceso/control_acceso.rutas.js)
y las [pruebas de integración](../../test/control_acceso.prueba.js).
