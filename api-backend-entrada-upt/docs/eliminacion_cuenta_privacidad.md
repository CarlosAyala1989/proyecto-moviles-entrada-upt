# Eliminación de cuenta y conservación de datos de estudiantes

El [portal independiente](https://github.com/CarlosAyala1989/app-seguridad-entrada-upt/blob/main/portal-privacidad-upt/README.md) incluye las tres
páginas y las instrucciones de Dokploy y Google Cloud. La migración 015 solo
añade solicitudes breves; la 016 añade restricciones seudonimizadas. No se
sustituye el callback del login existente.

## Contrato bajo `/api/cuenta`

JSON con respuesta `{datos: ...}` o el formato habitual de errores de la API.
No se acepta `usuario_id` ni un correo para elegir qué cuenta borrar.

| Operación | Datos y efecto |
| --- | --- |
| `POST /eliminacion/iniciar` | `{verificador}` de 32 bytes Base64URL. Devuelve `{id, url_autorizacion}`. |
| `GET /eliminacion/google/callback` | Procesa `state`/`code` una vez; redirige al portal configurado. |
| `POST /eliminacion/estado` | `{id, verificador}`. Solo LISTA devuelve nombre y correo verificados. |
| `POST /eliminacion/confirmar` | `{id, verificador, confirmacion:"ELIMINAR"}`. Borrado transaccional e idempotente. |
| `POST /eliminacion/cancelar` | `{id, verificador}`. Invalida la solicitud sin borrar la cuenta. |

La autorización es breve y específica: verificar de nuevo el Google Workspace
cuyo `sub` ya está vinculado. No requiere un Bearer general ni que el ingreso
al campus esté habilitado. Solo admite cuentas con rol ESTUDIANTE sin otros roles.
Las identidades con funciones de operador deben separarse antes de usarlas como
cuentas exclusivas de esta app; no se modifica la aplicación de seguridad.

Solicitudes de 10 minutos en SQL, con state y verificador del navegador como
hashes. Se validan firma, audiencia, caducidad, dominio, nonce y PKCE; no se
guardan tokens Google. El callback consume state antes de intercambiar el código.
El límite se aplica solo al nuevo módulo. `TRUST_PROXY_HOPS=1` es opcional tras
un único proxy confiable sin puerto de API expuesto directamente.

## Alcance del borrado

La transacción bloquea solicitud y cuenta, retira primero relaciones hijas y
auditorías asociadas incluso cuando fueron creadas por otro operador. Se eliminan
intentos anónimos cuyo hash coincide con los identificadores conocidos del titular.
Las claves foráneas permanecen activas. Un fallo revierte todo y no devuelve éxito.

No se sustituye la cuenta por un usuario inactivo ni se conserva su perfil.
Una restricción institucional se trata por separado como se describe a continuación.
El comprobante guarda solo ID aleatorio, estado y fecha hasta su expiración.
Las sesiones y QR dejan de poder validarse porque se retiran sus registros y
dispositivos. No se elimina la cuenta externa de Google, intranet ni matrícula.
Un reintento no puede borrar una cuenta nueva que se haya creado después.

## Restricción institucional separada

Por instrucción expresa del responsable, borrar una cuenta bloqueada no debe
restaurar automáticamente el ingreso. Se conserva por separado solo el HMAC del
código y una fecha de vencimiento, sin código legible, nombre, correo, fotografía,
Google sub ni ID de usuario. La finalidad y conservación se explican en el portal
y en el aviso 1.2. No se presenta como una excepción legal inventada ni como un
dato anónimo: es una referencia seudonimizada de seguridad institucional.

El plazo es máximo 30 días, respetando un bloqueo temporal que venza antes.
La eliminación de la cuenta se completa igualmente. Durante la vigencia, el
registro automático no crea otra cuenta para ese código. Al vencer, la tarea de
retención borra la huella. La autorización administrativa por los procedimientos
existentes sigue siendo una decisión independiente de la institución.

`CLAVE_RESTRICCIONES_IDENTIDAD` debe ser una clave aleatoria Base64URL de 32 bytes,
compartida por réplicas y estable entre despliegues. El flujo de eliminación no
se habilita sin ella. Se guarda una firma de la clave para detectar una rotación
accidental: si no coincide mientras hay restricciones vigentes, el registro
nuevo falla de forma segura en lugar de permitir el ingreso. Conservar la clave
fuera de Git, de la app y del portal.

## Conservación de 30 días

`retencion.js` se ejecuta al arrancar y cada 15 minutos. Un bloqueo SQL serializa
la tarea entre réplicas. Depura accesos, avisos, credenciales/ubicación de QR,
usos offline, intentos y auditorías antiguos vinculados a estudiantes. Retira
IP/agente de sesiones antiguas y sesiones vencidas sin dependencias. La identidad
y vinculaciones activas permanecen mientras exista la cuenta.

**El primer despliegue ya puede retirar registros de más de 30 días**. Verifica
la actualización en una copia aislada. Ejecución manual: `npm run privacidad:depurar`.
Respaldos, binlogs y logs externos deben configurarse aparte con máximo 30 días;
no los administra esta API. Al restaurar, reaplicar eliminaciones posteriores y
depurar antes de aceptar tráfico.

## Configuración y pruebas

```dotenv
SITIO_PUBLICO_URL=https://TU_DOMINIO_DEL_PORTAL
GOOGLE_ELIMINACION_REDIRECT_URI=https://TU_DOMINIO_API/api/cuenta/eliminacion/google/callback
CLAVE_RESTRICCIONES_IDENTIDAD=CLAVE_ALEATORIA_DE_32_BYTES_BASE64URL
```

Conservar credenciales OAuth y callback de login; registrar este callback
adicional en Google Cloud. Si falta, solo el flujo nuevo devuelve 503.

`test/eliminacion_cuenta.prueba.js` requiere una base **aislada** con migraciones
y semillas ficticias; prueba borrado real, terceros, sesiones, reintentos,
caducidad, suplantación, rollback y conservación. No ejecutar contra producción.

[Directriz de Apple](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion),
[OpenID Connect de Google](https://developers.google.com/identity/openid-connect/openid-connect).
