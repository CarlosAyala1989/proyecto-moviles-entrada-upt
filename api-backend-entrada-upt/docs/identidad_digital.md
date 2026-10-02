# Identidad digital del usuario

El Hito 5 incorpora la consulta de la identidad digital propia mediante:

```text
GET /api/identidad-digital
```

La ruta aplica el perfil descrito por la
[arquitectura del sistema](https://github.com/CarlosAyala1989/app-seguridad-entrada-upt/blob/main/ARQUITECTURA_SISTEMA_IDENTIDAD_DIGITAL_UPT.md):
fotografía, nombre, código, correo, escuela, tipo de usuario, verificación y
estado de acceso.

## Reglas de acceso

- Requiere un token de acceso Bearer activo y vigente.
- El usuario debe continuar `ACTIVO` y `AUTORIZADO`.
- El identificador se obtiene exclusivamente de la sesión validada.
- No acepta `usuario_id` ni otro parámetro para elegir una identidad.
- No existe una ruta pública o autenticada `/api/identidad-digital/:id`.
- No expone contraseñas, hashes, tokens ni los nombres internos utilizados para
  una futura comparación institucional.

El perfil académico puede ser `null` para docentes, trabajadores o usuarios
cuyo registro todavía no lo incluya.

## Petición reproducible

Después de iniciar sesión según `docs/autenticacion_temporal.md`, conserva el
token únicamente en una variable local:

```bash
export TOKEN_ACCESO='reemplazar-por-el-token-recibido'
curl http://127.0.0.1:3000/api/identidad-digital \
  --header "authorization: Bearer $TOKEN_ACCESO"
```

Respuesta esperada:

```json
{
  "datos": {
    "id": 10,
    "codigo_institucional": "PRUEBA-EST-001",
    "correo_institucional": "estudiante@example.invalid",
    "nombres": "María Elena",
    "apellidos": "Pérez Quispe",
    "nombre_completo": "María Elena Pérez Quispe",
    "foto_url": "https://example.invalid/foto.png",
    "roles": ["ESTUDIANTE"],
    "verificacion": {
      "estado": "VERIFICADA",
      "verificada_en": "fecha ISO 8601"
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
    "actualizado_en": "fecha ISO 8601"
  }
}
```

`preparacion_codigo_qr.puede_solicitar` solo informa si se cumplen los
requisitos ya conocidos. No es una autorización permanente ni una decisión
del cliente. En el Hito 6 el backend deberá volver a comprobar sesión, usuario,
verificación, rol, ubicación y las demás reglas antes de emitir una credencial.

En este hito no se genera una imagen QR, un OTP, un nonce ni un token de
credencial.
