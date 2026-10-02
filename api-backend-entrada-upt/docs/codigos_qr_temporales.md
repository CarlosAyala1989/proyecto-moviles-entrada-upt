# Códigos QR temporales

El Hito 6 implementa la emisión de credenciales temporales para que Flutter
genere su representación QR. El diseño sigue la
[arquitectura del sistema](https://github.com/CarlosAyala1989/app-seguridad-entrada-upt/blob/main/ARQUITECTURA_SISTEMA_IDENTIDAD_DIGITAL_UPT.md):
el backend comprueba sesión, usuario, identidad, rol y ubicación antes de
emitir una credencial con OTP, nonce y caducidad.

## Endpoints

| Método | Ruta | Resultado |
| --- | --- | --- |
| `POST` | `/api/codigos-qr` | Genera y devuelve una nueva credencial opaca. |
| `GET` | `/api/codigos-qr/actual` | Consulta el estado de la última credencial sin devolver su token. |
| `DELETE` | `/api/codigos-qr/actual` | Revoca todas las credenciales pendientes del usuario. |

Todas las rutas requieren un token de acceso Bearer. Solamente los roles
`ESTUDIANTE`, `DOCENTE` y `TRABAJADOR` pueden generar códigos, y su identidad
debe continuar verificada, activa y autorizada.

## Solicitud para Flutter

La aplicación enviará la lectura más reciente proporcionada por el sistema
operativo del dispositivo:

```json
{
  "ubicacion": {
    "latitud": 0,
    "longitud": 0,
    "precision_metros": 20,
    "obtenida_en": "2026-09-11T13:00:00.000Z"
  }
}
```

`obtenida_en` debe estar en ISO 8601 e incluir zona horaria. Las coordenadas
del ejemplo son ficticias y coinciden únicamente con la semilla local de
prueba; no representan una ubicación oficial de la UPT.

Ejemplo reproducible después de iniciar sesión y cargar las semillas:

```bash
export TOKEN_ACCESO='reemplazar-por-el-token-recibido'
export MOMENTO_UBICACION="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
curl --request POST http://127.0.0.1:3000/api/codigos-qr \
  --header "authorization: Bearer $TOKEN_ACCESO" \
  --header 'content-type: application/json' \
  --data "{
    \"ubicacion\": {
      \"latitud\": 0,
      \"longitud\": 0,
      \"precision_metros\": 20,
      \"obtenida_en\": \"$MOMENTO_UBICACION\"
    }
  }"
```

Respuesta esperada:

```json
{
  "datos": {
    "codigo_qr": "upt_qr_v1.componentes-aleatorios-no-legibles",
    "formato": "UPT_QR_V1",
    "estado": "PENDIENTE",
    "emitida_en": "fecha ISO 8601",
    "expira_en": "fecha ISO 8601",
    "duracion_segundos": 45,
    "un_solo_uso": true,
    "ubicacion": {
      "resultado": "DENTRO_DE_ZONA_CONFIGURADA",
      "precision_reportada_metros": 20,
      "distancia_calculada_metros": 0,
      "punto_acceso": {
        "codigo": "PRUEBA-LOCAL",
        "nombre": "Punto de acceso de prueba"
      }
    }
  }
}
```

Flutter debe convertir únicamente `codigo_qr` en una imagen QR y mostrar la
cuenta regresiva hasta `expira_en`. No debe interpretar sus componentes ni
decidir si el ingreso está autorizado.

## Seguridad y rotación

- El código contiene una referencia, un OTP y un nonce criptográficamente
  aleatorios; no contiene nombre, código universitario, correo ni ubicación.
- MariaDB conserva SHA-256 de la referencia, OTP y nonce, nunca la cadena
  completa que recibe Flutter. La validación mantiene compatibilidad con las
  credenciales locales emitidas por la versión anterior del Hito 6.
- Generar un código nuevo revoca cualquier código pendiente anterior del mismo
  usuario.
- La generación simultánea se serializa y deja exactamente una credencial
  pendiente.
- Cerrar sesión, deshabilitar la identidad, cambiar la contraseña o modificar
  los roles revoca las credenciales pendientes relacionadas.
- El usuario puede revocar explícitamente su código mediante `DELETE`.
- La aceptación de un código y el consumo transaccional de un solo uso se
  implementan en `/api/ingresos/validar`; el cliente nunca puede establecer
  esos resultados.

## Ubicación y sus límites

El backend selecciona el punto activo más cercano mediante distancia esférica
y compara la distancia con `radio_permitido_metros`. También rechaza lecturas
antiguas, futuras fuera de tolerancia o con precisión insuficiente.

Los valores locales provisionales son:

| Configuración | Valor |
| --- | ---: |
| `DURACION_QR_SEGUNDOS` | 15 segundos |
| `ANTIGUEDAD_MAXIMA_UBICACION_SEGUNDOS` | 30 segundos |
| `DESFASE_FUTURO_UBICACION_SEGUNDOS` | 10 segundos |
| `PRECISION_MAXIMA_UBICACION_METROS` | 100 metros |

Los radios de cada punto están en `puntos_acceso`. Todos estos parámetros son
configurables en MariaDB y no constituyen reglas oficiales de la UPT.

Una coordenada enviada por el cliente puede ser manipulada. Estas comprobaciones
solo verifican consistencia con las reglas configuradas; no demuestran por sí
solas la presencia física ni sustituyen la comparación visual que realizará el
personal de seguridad.

## Errores relevantes

| Estado | Código | Motivo |
| --- | --- | --- |
| `401` | `AUTENTICACION_REQUERIDA` | Falta una sesión válida. |
| `403` | `IDENTIDAD_NO_VERIFICADA` | La identidad sigue pendiente. |
| `403` | `ROL_NO_HABILITADO_PARA_CODIGO_QR` | El rol no corresponde a un portador. |
| `403` | `UBICACION_FUERA_DE_ZONA` | No está dentro del radio configurado. |
| `422` | `UBICACION_DESACTUALIZADA` | La lectura es demasiado antigua. |
| `422` | `MOMENTO_UBICACION_INVALIDO` | El momento está demasiado adelantado. |
| `422` | `PRECISION_UBICACION_INSUFICIENTE` | La precisión supera el máximo. |
| `503` | `PUNTO_ACCESO_NO_DISPONIBLE` | No hay puntos activos. |
