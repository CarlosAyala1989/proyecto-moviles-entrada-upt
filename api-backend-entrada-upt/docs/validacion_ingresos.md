# Validación de ingresos

El Hito 7 completa en el backend la decisión de acceso mediante un código QR.
La aplicación de seguridad sólo captura y envía los datos: no interpreta el
token ni decide si una persona puede ingresar.

## Contrato HTTP

| Método | Ruta | Autenticación | Resultado |
| --- | --- | --- | --- |
| `POST` | `/api/ingresos/validar` | Bearer con rol `SEGURIDAD` | Decisión `AUTORIZADO` o `DENEGADO`. |

El cuerpo es:

```json
{
  "codigo_qr": "upt_qr_v1.referencia.otp.nonce",
  "punto_acceso_codigo": "PRUEBA-LOCAL",
  "ubicacion": {
    "latitud": 0,
    "longitud": 0,
    "precision_metros": 20,
    "obtenida_en": "2026-09-11T13:00:00.000Z"
  }
}
```

`obtenida_en` debe usar ISO 8601 con zona horaria. El código del punto identifica
la puerta donde trabaja el personal de seguridad y debe corresponder con el
punto asociado al QR durante su emisión.

Una solicitud procesada correctamente devuelve `200 OK`, incluso cuando la
decisión es denegada. Así, el cliente distingue una decisión del backend de un
fallo de autenticación, formato o infraestructura.

Respuesta autorizada:

```json
{
  "datos": {
    "resultado": "AUTORIZADO",
    "motivo": "ACCESO_AUTORIZADO",
    "mensaje": "Ingreso autorizado.",
    "registrado_en": "fecha ISO 8601",
    "punto_acceso": {
      "codigo": "PRUEBA-LOCAL",
      "nombre": "Punto de acceso de prueba"
    },
    "identidad": {
      "foto_url": "https://ejemplo.invalid/foto.png",
      "nombre_completo": "Estudiante De Prueba",
      "codigo_institucional": "PRUEBA-EST-001",
      "tipo_usuario": ["ESTUDIANTE"],
      "escuela": "Escuela de prueba",
      "estado_academico": "REGULAR"
    }
  }
}
```

Una denegación no expone datos de la identidad:

```json
{
  "datos": {
    "resultado": "DENEGADO",
    "motivo": "CREDENCIAL_YA_UTILIZADA",
    "mensaje": "El código QR ya fue utilizado.",
    "registrado_en": "fecha ISO 8601",
    "punto_acceso": {
      "codigo": "PRUEBA-LOCAL",
      "nombre": "Punto de acceso de prueba"
    }
  }
}
```

## Prueba HTTP reproducible

Inicia sesión por separado con un usuario portador y con un usuario que tenga
el rol `SEGURIDAD`. Conserva localmente los tokens recibidos y genera el QR con
el flujo documentado en `codigos_qr_temporales.md`.

```bash
export API_UPT='http://127.0.0.1:3000/api'
export TOKEN_SEGURIDAD='reemplazar-por-el-token-de-seguridad'
export CODIGO_QR='reemplazar-por-el-codigo-qr-generado'
export MOMENTO_UBICACION="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"

curl --request POST "$API_UPT/ingresos/validar" \
  --header "authorization: Bearer $TOKEN_SEGURIDAD" \
  --header 'content-type: application/json' \
  --data "{
    \"codigo_qr\": \"$CODIGO_QR\",
    \"punto_acceso_codigo\": \"PRUEBA-LOCAL\",
    \"ubicacion\": {
      \"latitud\": 0,
      \"longitud\": 0,
      \"precision_metros\": 20,
      \"obtenida_en\": \"$MOMENTO_UBICACION\"
    }
  }"
```

La primera ejecución debe devolver `AUTORIZADO`. Para comprobar el uso único,
actualiza `MOMENTO_UBICACION` y repite la petición con el mismo `CODIGO_QR`; la
respuesta debe ser `DENEGADO` con `CREDENCIAL_YA_UTILIZADA`.

## Comprobaciones del backend

- Revalida que quien escanea siga activo, autorizado y conserve el rol
  `SEGURIDAD`.
- Comprueba el formato y los hashes de la referencia, OTP y nonce.
- Rechaza credenciales vencidas, revocadas, utilizadas o asociadas a otro
  punto.
- Revalida el estado, autorización, identidad, rol y sesión del portador.
- Comprueba que el punto esté activo y que la lectura de ubicación sea reciente,
  suficientemente precisa y se encuentre dentro de su radio.
- Bloquea la credencial durante la transacción. Con `QR_UN_SOLO_USO=true`, dos
  solicitudes simultáneas sólo pueden producir una autorización.
- Registra cada decisión en `registros_acceso`, incluida la huella SHA-256 del
  token, el resultado, el motivo, el punto, el operador y los datos declarados
  de ubicación. Nunca almacena el QR completo.

Los intentos con un punto inexistente no pueden registrarse porque el modelo
exige una referencia válida a `puntos_acceso`; se rechazan con `422` antes de
crear el registro.

## Motivos de decisión

Los motivos de denegación implementados son:

- `TOKEN_INVALIDO`
- `INTEGRIDAD_CREDENCIAL_INVALIDA`
- `CREDENCIAL_EXPIRADA`
- `CREDENCIAL_REVOCADA`
- `CREDENCIAL_YA_UTILIZADA`
- `USUARIO_NO_HABILITADO`
- `IDENTIDAD_NO_VERIFICADA`
- `ROL_PORTADOR_NO_HABILITADO`
- `SESION_USUARIO_INVALIDA`
- `PUNTO_ACCESO_INACTIVO`
- `PUNTO_ACCESO_NO_COINCIDE`
- `UBICACION_ESCANEO_FUERA_DE_ZONA`

## Errores de petición

| Estado | Código | Motivo |
| --- | --- | --- |
| `400` | `DATOS_INVALIDOS` | El cuerpo no cumple el contrato. |
| `401` | `AUTENTICACION_REQUERIDA` | Falta un token Bearer válido. |
| `403` | `ROL_NO_AUTORIZADO` | La sesión no pertenece a personal de seguridad. |
| `422` | `PUNTO_ACCESO_NO_ENCONTRADO` | El código de punto no existe. |
| `422` | `UBICACION_DESACTUALIZADA` | La lectura supera la antigüedad configurada. |
| `422` | `MOMENTO_UBICACION_INVALIDO` | El reloj informado supera la tolerancia futura. |
| `422` | `PRECISION_UBICACION_INSUFICIENTE` | La precisión supera el máximo configurado. |

## Límite de la geolocalización

Las coordenadas y la precisión son datos declarados por el dispositivo y pueden
ser manipulados. El backend valida consistencia respecto de parámetros locales,
pero esto no prueba por sí solo la presencia física. Los valores actuales son
provisionales de desarrollo, no reglas oficiales de la UPT.

La consulta administrativa y paginada del historial está disponible en
`/api/administracion/accesos`. El contrato y sus reglas de privacidad están
documentados en `administracion_operativa.md`.
