# Catálogo completo de endpoints — API Entrada UPT

Este documento describe los **36 endpoints HTTP publicados** por el backend en
el estado actual del proyecto. Incluye los datos que el cliente envía, la
respuesta exitosa y el rol necesario.

## Convenciones

- URL local base: `http://127.0.0.1:3000/api`.
- Todo cuerpo se envía como `Content-Type: application/json`.
- Una ruta protegida recibe `Authorization: Bearer <token_acceso>`.
- Las fechas son cadenas ISO 8601 con zona, por ejemplo
  `2026-09-12T14:30:45.123Z`.
- Salvo las respuestas `204`, los resultados usan `{ "datos": ... }`.
- Los listados paginados añaden:

```json
{
  "paginacion": {
    "pagina": 1,
    "limite": 20,
    "total": 42,
    "total_paginas": 3
  }
}
```

- Un error usa esta forma:

```json
{
  "error": {
    "codigo": "CODIGO_DE_ERROR",
    "mensaje": "Descripción legible del error."
  }
}
```

### Objetos reutilizados

`UbicacionReportada`:

```json
{
  "latitud": -18.013,
  "longitud": -70.251,
  "precision_metros": 20,
  "obtenida_en": "2026-09-12T14:30:45.123Z"
}
```

Rangos: latitud `-90..90`, longitud `-180..180`, precisión `0..10000`.
`obtenida_en` debe incluir zona horaria y además cumplir las tolerancias
operativas configuradas.

`UsuarioAdministrado`:

```json
{
  "id": 10,
  "codigo_institucional": "20260001",
  "correo_institucional": "usuario@upt.example",
  "nombres": "María Elena",
  "apellidos": "Pérez Quispe",
  "nombre_institucional": "María Elena Pérez Quispe",
  "nombre_intranet": null,
  "foto_url": null,
  "estado": "ACTIVO",
  "estado_autorizacion": "AUTORIZADO",
  "identidad_verificada": true,
  "identidad_verificada_en": "2026-09-12T14:00:00.000Z",
  "ultimo_acceso_en": "2026-09-12T14:20:00.000Z",
  "creado_en": "2026-09-12T13:00:00.000Z",
  "actualizado_en": "2026-09-12T14:00:00.000Z",
  "roles": ["ESTUDIANTE"]
}
```

Los campos fecha pueden ser `null` cuando el evento todavía no ocurrió. La API
nunca devuelve contraseñas ni hashes.

`PuntoAcceso`:

```json
{
  "id": 2,
  "codigo": "PUERTA-PRINCIPAL",
  "nombre": "Puerta principal",
  "descripcion": "Ingreso peatonal",
  "latitud": -18.013,
  "longitud": -70.251,
  "radio_permitido_metros": 150,
  "estado": "ACTIVO",
  "creado_en": "2026-09-12T13:00:00.000Z",
  "actualizado_en": "2026-09-12T13:00:00.000Z"
}
```

## 1. Información pública y salud

### 1.1 `GET /api`

- Autenticación: no.
- Se envía: nada.
- Se recibe: `200 OK`.

```json
{
  "nombre": "API Entrada UPT",
  "version": "1.0.0"
}
```

### 1.2 `GET /api/salud`

- Autenticación: no.
- Se envía: nada.
- Se recibe: `200 OK`.

```json
{
  "estado": "correcto",
  "base_datos": "conectada",
  "fecha": "2026-09-12T14:30:45.123Z"
}
```

### 1.3 `GET /api/health`

Alias temporal de `/api/salud`. Envía y recibe exactamente los mismos datos.

## 2. Autenticación y sesión

### 2.1 `POST /api/autenticacion/iniciar-sesion`

- Autenticación: no.
- Se envía:

```json
{
  "identificador": "20260001",
  "contrasena": "contraseña-local"
}
```

`identificador` admite código o correo institucional. Se recibe `201 Created`:

```json
{
  "datos": {
    "tipo_token": "Bearer",
    "token_acceso": "upt_acceso_...",
    "token_renovacion": "upt_renovacion_...",
    "token_acceso_expira_en": "2026-09-12T14:45:45.123Z",
    "token_renovacion_expira_en": "2026-09-19T14:30:45.123Z",
    "usuario": {
      "id": 10,
      "codigo_institucional": "20260001",
      "correo_institucional": "usuario@upt.example",
      "nombres": "María Elena",
      "apellidos": "Pérez Quispe",
      "roles": ["ESTUDIANTE"]
    }
  }
}
```

### 2.2 `POST /api/autenticacion/renovar-sesion`

- Autenticación: token de renovación dentro del cuerpo; no usa Bearer.
- Se envía:

```json
{
  "token_renovacion": "upt_renovacion_..."
}
```

- Se recibe: `200 OK` con el mismo objeto `datos` de inicio de sesión y **dos
  tokens nuevos**. Los tokens anteriores quedan invalidados inmediatamente.

### 2.3 `GET /api/autenticacion/sesion`

- Autenticación: cualquier sesión Bearer válida.
- Se envía: sólo la cabecera Bearer.
- Se recibe: `200 OK`.

```json
{
  "datos": {
    "usuario": {
      "id": 10,
      "codigo_institucional": "20260001",
      "correo_institucional": "usuario@upt.example",
      "nombres": "María Elena",
      "apellidos": "Pérez Quispe",
      "roles": ["ESTUDIANTE"]
    }
  }
}
```

### 2.4 `POST /api/autenticacion/cerrar-sesion`

- Autenticación: cualquier sesión Bearer válida.
- Se envía: sólo la cabecera Bearer.
- Se recibe: `204 No Content`, sin cuerpo. El token queda revocado.

## 3. Registro con intranet y Google Workspace

La intranet inicia una verificación temporal y Google la completa. Sólo el
último paso crea o vincula la cuenta y emite una sesión. La contraseña de
intranet, el CAPTCHA y los tokens de Google no se almacenan.

### 3.1 `GET /api/registro-estudiante/intranet/captcha`

- Autenticación: no.
- Se envía: nada.
- Se recibe: `200 OK`.

```json
{
  "datos": {
    "transaccion_id": "0664b410-145e-4ef3-8d98-1055d8d57ee9",
    "imagen_base64": "R0lGODlh...",
    "tipo_imagen": "image/png",
    "expira_en": "2026-09-14T12:05:00.000Z"
  }
}
```

La aplicación muestra `imagen_base64` como imagen y conserva
`transaccion_id` sólo hasta enviar el siguiente paso.

### 3.2 `POST /api/registro-estudiante/intranet/verificar`

- Autenticación: no.
- Se envía:

```json
{
  "transaccion_id": "0664b410-145e-4ef3-8d98-1055d8d57ee9",
  "codigo": "2022074266",
  "contrasena": "123456",
  "captcha": "12345"
}
```

`codigo` tiene diez dígitos, `contrasena` es numérica de hasta seis dígitos y
`captcha` contiene el número mostrado en la imagen. La transacción se consume
incluso cuando falla el intento. Se recibe `200 OK`:

```json
{
  "datos": {
    "codigo": "2022074266",
    "nombre_apellidos": "AYALA RAMOS, CARLOS DANIEL",
    "verificacion_intranet_id": "8bcdbcea-0682-4c77-a828-21855d6bcdfa",
    "verificacion_expira_en": "2026-09-14T12:10:00.000Z"
  }
}
```

Errores principales: `CAPTCHA_EXPIRADO` (`410`),
`CREDENCIALES_INTRANET_INVALIDAS` (`401`) y
`PERFIL_INTRANET_NO_ENCONTRADO` (`422`).

### 3.3 `POST /api/registro-estudiante/google/iniciar`

Recibe el `verificacion_intranet_id` y crea una autorización OAuth de diez
minutos:

```json
{
  "verificacion_intranet_id": "8bcdbcea-0682-4c77-a828-21855d6bcdfa"
}
```

Responde `201 Created` con `transaccion_id`, `url_autorizacion` y `expira_en`.
Flutter debe abrir la URL en el navegador externo y conservar la transacción.

### 3.4 `GET /api/registro-estudiante/google/callback`

Callback exclusivo de Google. Express valida `state`, PKCE, firma, audiencia,
expiración, `nonce`, `email_verified` y `hd=virtual.upt.pe`; después compara el
código y nombre con la intranet. Después redirige con `303` a una página limpia,
para que el código de autorización no permanezca en la URL visible. Flutter no
llama directamente a esta ruta.

### 3.5 `GET /api/registro-estudiante/google/resultado`

Página HTML sin recursos externos que indica si el navegador ya puede cerrarse.
No contiene tokens ni datos personales.

### 3.6 `GET /api/registro-estudiante/google/estado/:transaccion_id`

Mientras el navegador está abierto responde `PENDIENTE` o `PROCESANDO`. Ante
un fallo responde `ERROR` y un objeto `error`. Al completar responde una sola
vez `COMPLETA` con `sesion`, usando el mismo contrato de autenticación de la
sección 2.1. La lectura exitosa consume la transacción.

## 4. Identidad digital

### 4.1 `GET /api/identidad-digital`

- Autenticación: sesión Bearer activa y autorizada.
- Se envía: sólo la cabecera Bearer; no acepta un `usuario_id`.
- Se recibe: `200 OK`.

```json
{
  "datos": {
    "id": 10,
    "codigo_institucional": "20260001",
    "correo_institucional": "usuario@upt.example",
    "nombres": "María Elena",
    "apellidos": "Pérez Quispe",
    "nombre_completo": "María Elena Pérez Quispe",
    "foto_url": null,
    "roles": ["ESTUDIANTE"],
    "verificacion": {
      "estado": "VERIFICADA",
      "verificada_en": "2026-09-12T14:00:00.000Z"
    },
    "acceso": {
      "estado_usuario": "ACTIVO",
      "estado_autorizacion": "AUTORIZADO"
    },
    "perfil_academico": {
      "escuela": "Ingeniería de Sistemas",
      "facultad": "Ingeniería",
      "estado_academico": "REGULAR",
      "periodo_academico": "2026-II"
    },
    "preparacion_codigo_qr": {
      "puede_solicitar": true,
      "requisitos": {
        "usuario_activo": true,
        "acceso_autorizado": true,
        "identidad_verificada": true,
        "rol_portador": true
      }
    },
    "actualizado_en": "2026-09-12T14:00:00.000Z"
  }
}
```

`perfil_academico` completo puede ser `null`.

## 5. Códigos QR temporales

Estas rutas requieren Bearer. Para generar, el usuario debe estar activo,
autorizado, verificado y tener al menos uno de los roles `ESTUDIANTE`,
`DOCENTE` o `TRABAJADOR`.

### 5.1 `POST /api/codigos-qr`

- Se envía:

```json
{
  "ubicacion": {
    "latitud": -18.013,
    "longitud": -70.251,
    "precision_metros": 20,
    "obtenida_en": "2026-09-12T14:30:45.123Z"
  }
}
```

- Se recibe: `201 Created`.

```json
{
  "datos": {
    "codigo_qr": "upt_qr_v1.referencia.otp.nonce",
    "formato": "UPT_QR_V1",
    "estado": "PENDIENTE",
    "emitida_en": "2026-09-12T14:30:45.200Z",
    "expira_en": "2026-09-12T14:31:30.200Z",
    "duracion_segundos": 45,
    "un_solo_uso": true,
    "ubicacion": {
      "resultado": "DENTRO_DE_ZONA_CONFIGURADA",
      "precision_reportada_metros": 20,
      "distancia_calculada_metros": 2.4,
      "punto_acceso": {
        "codigo": "PUERTA-PRINCIPAL",
        "nombre": "Puerta principal"
      }
    }
  }
}
```

### 5.2 `GET /api/codigos-qr/actual`

- Se envía: sólo Bearer.
- Se recibe: `200 OK`. No vuelve a exponer `codigo_qr`.

```json
{
  "datos": {
    "estado": "PENDIENTE",
    "emitida_en": "2026-09-12T14:30:45.200Z",
    "expira_en": "2026-09-12T14:31:30.200Z",
    "revocada_en": null,
    "punto_acceso": {
      "codigo": "PUERTA-PRINCIPAL",
      "nombre": "Puerta principal"
    }
  }
}
```

`datos` es `null` si el usuario nunca tuvo una credencial. `estado` puede ser
`PENDIENTE`, `USADA`, `EXPIRADA` o `REVOCADA`; `punto_acceso` puede ser `null`.

### 5.3 `DELETE /api/codigos-qr/actual`

- Se envía: sólo Bearer.
- Se recibe: `204 No Content`, sin cuerpo. Revoca las credenciales pendientes
  del usuario.

## 6. Validación e historial del personal de seguridad

### 6.1 `POST /api/ingresos/validar`

- Autenticación: Bearer con rol `SEGURIDAD`.
- Se envía:

```json
{
  "codigo_qr": "upt_qr_v1.referencia.otp.nonce",
  "punto_acceso_codigo": "PUERTA-PRINCIPAL",
  "ubicacion": {
    "latitud": -18.013,
    "longitud": -70.251,
    "precision_metros": 20,
    "obtenida_en": "2026-09-12T14:30:50.123Z"
  }
}
```

- Se recibe una decisión procesada con `200 OK`. Autorizada:

```json
{
  "datos": {
    "resultado": "AUTORIZADO",
    "motivo": "ACCESO_AUTORIZADO",
    "mensaje": "Ingreso autorizado.",
    "registrado_en": "2026-09-12T14:30:50.200Z",
    "punto_acceso": {
      "codigo": "PUERTA-PRINCIPAL",
      "nombre": "Puerta principal"
    },
    "identidad": {
      "foto_url": null,
      "nombre_completo": "María Elena Pérez Quispe",
      "codigo_institucional": "20260001",
      "tipo_usuario": ["ESTUDIANTE"],
      "escuela": "Ingeniería de Sistemas",
      "estado_academico": "REGULAR"
    }
  }
}
```

Una decisión denegada también es `200`, pero omite `identidad`:

```json
{
  "datos": {
    "resultado": "DENEGADO",
    "motivo": "CREDENCIAL_YA_UTILIZADA",
    "mensaje": "El código QR ya fue utilizado.",
    "registrado_en": "2026-09-12T14:30:51.200Z",
    "punto_acceso": {
      "codigo": "PUERTA-PRINCIPAL",
      "nombre": "Puerta principal"
    }
  }
}
```

### 6.2 `GET /api/ingresos/recientes`

- Autenticación: Bearer con rol `SEGURIDAD`.
- Se envía en query: `limite` opcional, entero `1..50`, por defecto `20`.
- Se recibe: `200 OK`; sólo registros creados por el operador autenticado.

```json
{
  "datos": [
    {
      "id": 100,
      "resultado": "AUTORIZADO",
      "motivo": "ACCESO_AUTORIZADO",
      "registrado_en": "2026-09-12T14:30:50.200Z",
      "punto_acceso": {
        "codigo": "PUERTA-PRINCIPAL",
        "nombre": "Puerta principal"
      },
      "usuario": {
        "codigo_institucional": "20260001",
        "nombre_completo": "María Elena Pérez Quispe"
      }
    },
    {
      "id": 101,
      "resultado": "DENEGADO",
      "motivo": "CREDENCIAL_YA_UTILIZADA",
      "registrado_en": "2026-09-12T14:30:51.200Z",
      "punto_acceso": {
        "codigo": "PUERTA-PRINCIPAL",
        "nombre": "Puerta principal"
      },
      "usuario": null
    }
  ]
}
```

## 7. Administración de usuarios

Todas las rutas de esta sección requieren Bearer con rol `ADMINISTRADOR`.

### 7.1 `GET /api/administracion/roles`

- Se envía: sólo Bearer.
- Se recibe: `200 OK`.

```json
{
  "datos": [
    {
      "id": 1,
      "nombre": "ESTUDIANTE",
      "descripcion": "Usuario estudiante"
    }
  ]
}
```

Los nombres vigentes son `ESTUDIANTE`, `DOCENTE`, `TRABAJADOR`, `SEGURIDAD` y
`ADMINISTRADOR`.

### 7.2 `GET /api/administracion/usuarios`

- Query que se puede enviar:
  - `pagina`: entero positivo, por defecto `1`.
  - `limite`: entero `1..100`, por defecto `20`.
  - `buscar`: texto de hasta 150 caracteres; busca código, correo y nombres.
  - `estado`: `PENDIENTE`, `ACTIVO`, `INACTIVO`, `BLOQUEADO` o `RECHAZADO`.
- Se recibe: `200 OK`, `datos` es una lista de `UsuarioAdministrado` y se añade
  `paginacion`.

### 7.3 `POST /api/administracion/usuarios`

- Se envía:

```json
{
  "codigo_institucional": "20260001",
  "correo_institucional": "usuario@upt.example",
  "nombres": "María Elena",
  "apellidos": "Pérez Quispe",
  "nombre_institucional": "María Elena Pérez Quispe",
  "nombre_intranet": null,
  "foto_url": null,
  "estado": "ACTIVO",
  "estado_autorizacion": "AUTORIZADO",
  "identidad_verificada": true,
  "contrasena": "Clave-Local-Segura!2026",
  "roles": ["ESTUDIANTE"]
}
```

Obligatorios: código, correo, nombres, apellidos y al menos un rol. Los nombres
opcionales y `foto_url` pueden omitirse. `estado`, `estado_autorizacion` e
`identidad_verificada` tienen valores por defecto `PENDIENTE`, `PENDIENTE` y
`false`. `contrasena` es opcional; si se envía debe tener 14–128 caracteres,
mayúscula, minúscula, número y símbolo.

- Se recibe: `201 Created` con `{ "datos": UsuarioAdministrado }`.

### 7.4 `GET /api/administracion/usuarios/:id`

- Se envía: `id` entero positivo en la ruta y Bearer.
- Se recibe: `200 OK` con `{ "datos": UsuarioAdministrado }`.

### 7.5 `PATCH /api/administracion/usuarios/:id`

- Se envía: `id` y al menos uno de estos campos:

```json
{
  "codigo_institucional": "20260001",
  "correo_institucional": "usuario@upt.example",
  "nombres": "María Elena",
  "apellidos": "Pérez Quispe",
  "nombre_institucional": "María Elena Pérez Quispe",
  "nombre_intranet": "María Pérez",
  "foto_url": "https://example.invalid/foto.png"
}
```

Los tres últimos aceptan `null` donde corresponda. Se recibe `200 OK` con el
`UsuarioAdministrado` actualizado.

### 7.6 `PATCH /api/administracion/usuarios/:id/estado`

- Se envía: `id` y al menos uno de:

```json
{
  "estado": "ACTIVO",
  "estado_autorizacion": "AUTORIZADO",
  "identidad_verificada": true
}
```

Estados de autorización: `PENDIENTE`, `AUTORIZADO`, `DENEGADO`. Se recibe
`200 OK` con el `UsuarioAdministrado` actualizado. Deshabilitar al usuario
revoca sesiones y QR pendientes.

### 7.7 `PUT /api/administracion/usuarios/:id/roles`

- Se envía `id` y el reemplazo completo de roles:

```json
{
  "roles": ["ESTUDIANTE", "DOCENTE"]
}
```

- Se recibe: `200 OK` con el `UsuarioAdministrado` actualizado. También revoca
  QR pendientes.

### 7.8 `PUT /api/administracion/usuarios/:id/credencial-local`

- Se envía:

```json
{
  "contrasena": "Nueva-Clave-Local!2026"
}
```

- Se recibe: `204 No Content`, sin cuerpo. Revoca las sesiones y QR pendientes
  de ese usuario.

## 8. Administración operativa

Todas estas rutas requieren Bearer con rol `ADMINISTRADOR`.

### 8.1 `GET /api/administracion/resumen`

- Se envía: sólo Bearer.
- Se recibe: `200 OK`.

```json
{
  "datos": {
    "usuarios_total": 100,
    "usuarios_activos": 90,
    "identidades_pendientes": 10,
    "puntos_acceso_activos": 3,
    "accesos_autorizados_hoy": 250,
    "accesos_denegados_hoy": 12
  }
}
```

### 8.2 `GET /api/administracion/accesos`

- Query que se puede enviar:
  - `pagina` y `limite` (`1..100`).
  - `usuario_id`, `punto_acceso_id`, `usuario_seguridad_id`: enteros positivos.
  - `resultado`: `AUTORIZADO` o `DENEGADO`.
  - `motivo`: texto de hasta 80 caracteres.
  - `desde`, `hasta`: fechas ISO 8601 con zona; `desde <= hasta`.
- Se recibe: `200 OK`, lista paginada:

```json
{
  "datos": [
    {
      "id": 100,
      "resultado": "AUTORIZADO",
      "motivo": "ACCESO_AUTORIZADO",
      "registrado_en": "2026-09-12T14:30:50.200Z",
      "usuario": {
        "id": 10,
        "codigo_institucional": "20260001",
        "nombre_completo": "María Elena Pérez Quispe"
      },
      "punto_acceso": {
        "id": 2,
        "codigo": "PUERTA-PRINCIPAL",
        "nombre": "Puerta principal"
      },
      "personal_seguridad": {
        "id": 20,
        "codigo_institucional": "SEG-001",
        "nombre_completo": "Personal Seguridad"
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

`usuario` puede ser `null` en intentos con una credencial desconocida.

### 8.3 `GET /api/administracion/accesos/:id`

- Se envía: `id` entero positivo y Bearer.
- Se recibe: `200 OK` con el mismo registro anterior y, además:

```json
{
  "ubicacion_escaneo": {
    "latitud": -18.013,
    "longitud": -70.251,
    "precision_metros": 20,
    "obtenida_en": "2026-09-12T14:30:50.123Z",
    "distancia_punto_acceso_metros": 2.4
  }
}
```

Cada campo de ubicación puede ser `null` para registros sin esa información.

### 8.4 `GET /api/administracion/puntos-acceso`

- Query que se puede enviar: `pagina`, `limite` (`1..100`), `buscar` (código o
  nombre) y `estado` (`ACTIVO` o `INACTIVO`).
- Se recibe: `200 OK`; `datos` es una lista de `PuntoAcceso` y se añade
  `paginacion`.

### 8.5 `POST /api/administracion/puntos-acceso`

- Se envía:

```json
{
  "codigo": "PUERTA-PRINCIPAL",
  "nombre": "Puerta principal",
  "descripcion": "Ingreso peatonal",
  "latitud": -18.013,
  "longitud": -70.251,
  "radio_permitido_metros": 150,
  "estado": "ACTIVO"
}
```

`descripcion` es opcional y por defecto `null`; `estado` es opcional y por
defecto `ACTIVO`. Radio: mayor que 0 y máximo 10000.

- Se recibe: `201 Created` con `{ "datos": PuntoAcceso }`.

### 8.6 `PATCH /api/administracion/puntos-acceso/:id`

- Se envía: `id` y al menos uno de los mismos campos admitidos al crear.
- Se recibe: `200 OK` con el `PuntoAcceso` actualizado. Cambiar coordenadas,
  radio o estado revoca los QR pendientes asociados.

### 8.7 `GET /api/administracion/auditoria`

- Query que se puede enviar: `pagina`, `limite` (`1..100`),
  `usuario_actor_id`, `accion`, `entidad`, `desde` y `hasta`.
- Se recibe: `200 OK`, lista paginada:

```json
{
  "datos": [
    {
      "id": 500,
      "accion": "USUARIO_ACTUALIZADO",
      "entidad": "USUARIO",
      "entidad_id": "10",
      "registrado_en": "2026-09-12T14:00:00.000Z",
      "usuario_actor": {
        "id": 1,
        "codigo_institucional": "ADMIN-001",
        "nombre_completo": "Administrador UPT"
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

`usuario_actor` puede ser `null` para acciones sin actor asociado.

### 8.8 `GET /api/administracion/configuraciones`

- Se envía: sólo Bearer.
- Se recibe: `200 OK` con las cinco configuraciones operativas no secretas:

```json
{
  "datos": [
    {
      "clave": "DURACION_QR_SEGUNDOS",
      "valor": 45,
      "tipo": "ENTERO",
      "descripcion": "Duración provisional de cada código QR.",
      "editable": true,
      "actualizado_en": "2026-09-12T14:00:00.000Z"
    }
  ]
}
```

Claves: `DURACION_QR_SEGUNDOS`, `QR_UN_SOLO_USO`,
`ANTIGUEDAD_MAXIMA_UBICACION_SEGUNDOS`,
`DESFASE_FUTURO_UBICACION_SEGUNDOS` y
`PRECISION_MAXIMA_UBICACION_METROS`. `valor` se recibe como número o booleano
según `tipo`.

### 8.9 `PUT /api/administracion/configuraciones/:clave`

- Se envía una clave editable en la ruta y:

```json
{
  "valor": 45
}
```

- Se recibe: `200 OK` con `{ "datos": Configuracion }`, usando la misma forma
  del elemento anterior.

Rangos editables:

| Clave | Rango |
| --- | --- |
| `DURACION_QR_SEGUNDOS` | entero `15..300` |
| `ANTIGUEDAD_MAXIMA_UBICACION_SEGUNDOS` | entero `5..120` |
| `DESFASE_FUTURO_UBICACION_SEGUNDOS` | entero `1..30` |
| `PRECISION_MAXIMA_UBICACION_METROS` | número `5..500` |

`QR_UN_SOLO_USO` es de sólo lectura y responde `403` si se intenta cambiar.

## Verificación automática del flujo completo

Desde el backend:

```bash
cd api-backend-entrada-upt
npm run test:flujo-completo
```

La prueba levanta Express en un puerto local aleatorio, usa la MariaDB
configurada, recorre los 30 endpoints deterministas, ejecuta además el flujo
móvil mediante el `ClienteApi` real de Dart y elimina/restaura todos los datos
temporales al terminar. Los seis endpoints de registro dual tienen pruebas de
contrato, conciliación, OAuth simulado y persistencia; probarlos contra los dos
proveedores reales requiere el CAPTCHA y las credenciales institucionales.
