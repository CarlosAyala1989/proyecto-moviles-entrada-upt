# Autenticación temporal y autorización

El Hito 4 implementa autenticación local para usuarios previamente registrados
y habilitados por un administrador. Es una capa sustituible: no depende de
Google, de la intranet UPT ni de identificadores aportados por el cliente como
prueba de identidad.

## Contrato HTTP

| Método | Ruta | Autenticación | Resultado |
| --- | --- | --- | --- |
| `POST` | `/api/autenticacion/iniciar-sesion` | Pública | Emite tokens de acceso y renovación. |
| `POST` | `/api/autenticacion/renovar-sesion` | Token de renovación en JSON | Rota ambos tokens. |
| `GET` | `/api/autenticacion/sesion` | Bearer | Consulta la identidad mínima de la sesión. |
| `POST` | `/api/autenticacion/cerrar-sesion` | Bearer | Revoca la sesión y responde `204`. |

El inicio acepta como `identificador` el código o correo institucional. Solo
los usuarios con `estado=ACTIVO` y `estado_autorizacion=AUTORIZADO` pueden
obtener o utilizar sesiones.

## Prueba HTTP reproducible

No escribas la contraseña en el historial de la terminal. Define localmente
los valores de un usuario de desarrollo ya registrado:

```bash
export API_UPT='http://127.0.0.1:3000/api'
export IDENTIFICADOR_UPT='ADMIN-DESARROLLO'
read -r -s -p 'Contraseña local: ' CONTRASENA_UPT
echo
```

```bash
curl --request POST "$API_UPT/autenticacion/iniciar-sesion" \
  --header 'content-type: application/json' \
  --data "{\"identificador\":\"$IDENTIFICADOR_UPT\",\"contrasena\":\"$CONTRASENA_UPT\"}"
```

La respuesta esperada es `201 Created` y sigue esta forma; los valores se
muestran recortados deliberadamente:

```json
{
  "datos": {
    "tipo_token": "Bearer",
    "token_acceso": "upt_acceso_...",
    "token_renovacion": "upt_renovacion_...",
    "token_acceso_expira_en": "fecha ISO 8601",
    "token_renovacion_expira_en": "fecha ISO 8601",
    "usuario": {
      "id": 1,
      "codigo_institucional": "ADMIN-DESARROLLO",
      "roles": ["ADMINISTRADOR"]
    }
  }
}
```

Usar el token de acceso:

```bash
export TOKEN_ACCESO='reemplazar-por-el-token-recibido'
curl "$API_UPT/autenticacion/sesion" \
  --header "authorization: Bearer $TOKEN_ACCESO"
```

Renovar la sesión rota inmediatamente el token anterior:

```bash
export TOKEN_RENOVACION='reemplazar-por-el-token-recibido'
curl --request POST "$API_UPT/autenticacion/renovar-sesion" \
  --header 'content-type: application/json' \
  --data "{\"token_renovacion\":\"$TOKEN_RENOVACION\"}"
```

Cerrar la sesión:

```bash
curl --request POST "$API_UPT/autenticacion/cerrar-sesion" \
  --header "authorization: Bearer $TOKEN_ACCESO"
```

## Medidas aplicadas

- Contraseñas almacenadas mediante bcrypt con factor de costo 12.
- Tokens opacos generados criptográficamente; MariaDB conserva solo SHA-256.
- Token de acceso de 15 minutos y renovación de 7 días por defecto.
- Rotación atómica de los dos tokens durante la renovación.
- Revocación al cerrar sesión o cambiar la contraseña local.
- Revalidación del estado y roles del usuario en cada petición protegida.
- Respuesta genérica para usuario inexistente o contraseña incorrecta.
- Bloqueo temporal de 15 minutos después de 5 intentos fallidos por defecto.
- Registro de intentos usando el hash del identificador, no el identificador
  escrito por el cliente.

Los valores provisionales se configuran mediante
`DURACION_TOKEN_ACCESO_MINUTOS`, `DURACION_TOKEN_RENOVACION_DIAS`,
`MAX_INTENTOS_INICIO_SESION` y `DURACION_BLOQUEO_MINUTOS`. No constituyen
reglas oficiales de la UPT.

## Errores relevantes

| Estado | Código | Motivo |
| --- | --- | --- |
| `401` | `CREDENCIALES_INVALIDAS` | Identificador o contraseña incorrectos. |
| `401` | `AUTENTICACION_REQUERIDA` | Falta la cabecera Bearer. |
| `401` | `TOKEN_ACCESO_INVALIDO` | Token ausente en base de datos, revocado o vencido. |
| `401` | `TOKEN_RENOVACION_INVALIDO` | Token de renovación inválido, rotado o vencido. |
| `403` | `USUARIO_NO_HABILITADO` | Usuario inactivo o no autorizado. |
| `403` | `ROL_NO_AUTORIZADO` | La sesión no posee el rol requerido. |
| `429` | `INICIO_SESION_BLOQUEADO` | Bloqueo temporal vigente. |

La autenticación institucional real queda pendiente y podrá reemplazar la
verificación de contraseña sin cambiar la validación central de sesiones y
roles.
