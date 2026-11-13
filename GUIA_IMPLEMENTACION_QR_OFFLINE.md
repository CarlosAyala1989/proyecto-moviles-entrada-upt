# Implementación del QR offline del estudiante

Contrato revisado en el código del proyecto personal el 26 de octubre de 2026.
URL base de la API: `https://api-moviles.fottuto.men/api`.

## 1. Qué soporta la API

**Sí soporta que el estudiante muestre un QR válido sin internet después de
vincular su dispositivo con conexión.** El teléfono genera el código localmente
con un secreto entregado por el backend. El guardia escanea la cadena completa
y la envía a la API, que comprueba su validez y registra el ingreso.

| Situación | Soporte actual |
| --- | --- |
| Primer registro mediante intranet y Google | Requiere internet en el estudiante y disponibilidad de la API. |
| Primera vinculación del dispositivo | Requiere internet y una sesión API vigente. |
| Generar y rotar el QR después de vincular | Funciona sin internet ni GPS del estudiante. |
| Reabrir la app sin internet, con sesión y vinculación guardadas | Implementado en el cliente personal para estudiantes vinculados. |
| Mostrar QR aunque los tokens de la sesión del estudiante hayan vencido | La generación local está contemplada y la validación del QR no exige esos tokens. |
| Validar el ingreso con el guardia conectado | Soportado por `POST /ingresos/validar`, con sesión del guardia, ubicación y puerta. |
| Guardia sin conexión, o API/base de datos no disponible | No hay autorización offline implementada en el verificador. |
| Registrar accesos localmente y sincronizarlos más tarde | No existe un contrato de carga diferida de accesos. |
| Consultar identidad actualizada, historial o notificaciones sin conexión | Requiere red; una caché de lectura sería una función adicional de la app. |

El estudiante offline no hace una petición HTTP: entrega visualmente el QR al
verificador. El dispositivo que sí tiene internet es el que lo envía a la API.
La aplicación completa no queda convertida en un sistema sin red.

## 2. Qué debe ocurrir la primera vez

1. El estudiante completa intranet y Google con conexión. La app muestra nombre,
   código y escuela antes de continuar con Google, según
   [el cambio de registro](CAMBIOS_API_ESCUELA_PROFESIONAL.md).
2. La app obtiene y guarda la sesión propia de la API y el ID del usuario.
3. Con la sesión vigente, abre la pantalla QR y vincula el dispositivo mediante
   `POST /codigos-qr/preparar-offline`.
4. Guarda el secreto, el ID del dispositivo, el periodo y el ajuste del reloj
   en almacenamiento seguro, asociados al usuario.
5. Comprueba que puede generar el primer QR y anuncia que el dispositivo está
   preparado para funcionar sin conexión.

**Iniciar sesión una vez no basta por sí solo.** También debe completarse la
vinculación y persistirse su respuesta antes de apagar internet. En la app
personal esa preparación se inicia al abrir la pantalla QR.

## 3. Endpoint de preparación

```http
POST /api/codigos-qr/preparar-offline
Authorization: Bearer <token_acceso_del_estudiante>
Content-Type: application/json
```

```json
{
  "identificador_dispositivo": "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI",
  "plataforma": "ANDROID"
}
```

El identificador del ejemplo es ficticio: cada instalación debe generar el suyo.

| Campo enviado | Regla |
| --- | --- |
| `identificador_dispositivo` | Cadena de exactamente 43 caracteres `[A-Za-z0-9_-]`: 32 bytes aleatorios criptográficos codificados como Base64URL sin `=`. Se conserva para esa instalación. |
| `plataforma` | Uno de `ANDROID`, `IOS`, `WEB`, `OTRA`. Linux utiliza `OTRA` en el cliente actual. |

El cuerpo es estricto. No se envían `usuario_id`, nombres, escuela, secreto,
puerta ni ubicación. La identidad procede del Bearer.

El repositorio de preparación exige usuario `ACTIVO`, acceso `AUTORIZADO`,
identidad verificada, rol **ESTUDIANTE** y sesión activa no vencida. Aunque otras
partes de la aplicación admiten docentes o trabajadores, esta preparación
offline exige el rol estudiante.

### Respuesta: `201 Created`

```json
{
  "datos": {
    "dispositivo_id": 123,
    "secreto": "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
    "hora_servidor": "2026-10-26T19:00:00.000Z",
    "periodo_segundos": 15
  }
}
```

El secreto anterior es un **vector público de prueba**, nunca una clave para una
instalación real. Las claves reales las genera la API aleatoriamente.

| Campo recibido | Uso |
| --- | --- |
| `dispositivo_id` | Entero que identifica la vinculación en la API; forma parte del QR. |
| `secreto` | 32 bytes en Base64URL sin relleno. Permite generar los códigos; se guarda en almacenamiento seguro. |
| `hora_servidor` | Fecha ISO 8601 utilizada para ajustar el reloj de generación. |
| `periodo_segundos` | Periodo de rotación: actualmente `15`. No procede de la configuración del QR en línea. |

El backend **no entrega una imagen, una lista de códigos futuros ni un QR ya
generado** en esta respuesta. La app calcula y dibuja el QR.

### Rutas complementarias de la integración

Todas las rutas siguientes son relativas a la URL base con `/api`:

| Método y ruta | Qué se manda | Para qué sirve |
| --- | --- | --- |
| `GET /autenticacion/sesion` | Bearer de acceso, sin cuerpo. | Revalidar la cuenta cuando hay red. |
| `POST /autenticacion/renovar-sesion` | JSON `{"token_renovacion":"<token>"}`. | Obtener tokens vigentes antes de preparar, cuando la sesión admite renovación. |
| `POST /autenticacion/cerrar-sesion` | Bearer de acceso válido, sin cuerpo. | Cerrar una sesión activa y revocar sus vinculaciones según el alcance descrito en la sección 10. |
| `GET /identidad-digital` | Bearer de acceso, sin cuerpo. | Consultar datos actuales; no es un requisito de cada generación offline. |
| `POST /ingresos/validar` | Bearer del guardia y JSON con QR completo, puerta y ubicación. | Recibir la decisión de ingreso. |

Los tokens usados aquí son los de la API UPT, no los tokens de Google. El
[contrato de inicio de sesión del estudiante](ENDPOINTS_LOGIN_ESTUDIANTE.md)
detalla el flujo que entrega esa primera sesión.

### Consecuencias de repetir esta petición

- Cada preparación genera un secreto nuevo, incluso para el mismo identificador.
  La app debe reemplazar de forma consistente el secreto guardado con el recibido.
- Si se usa el mismo identificador para el mismo usuario, se actualiza el
  dispositivo existente y se mantiene su ID.
- Vincular otro dispositivo del mismo usuario revoca los otros dispositivos
  activos y elimina sus secretos del servidor. Solo queda uno activo.
- Un identificador ya asociado a otra cuenta produce
  `409 DISPOSITIVO_VINCULADO_A_OTRA_CUENTA`.

No se llama a este endpoint cada 15 segundos. Tampoco debe reintentarse
indefinidamente después de un timeout: la primera llamada pudo haber cambiado
el secreto aunque su respuesta no llegara al teléfono.

## 4. Datos que debe guardar la app

El cliente del proyecto utiliza `FlutterSecureStorage` mediante
`AlmacenQrOffline`. La vinculación local contiene:

```text
usuario_id              ID de la cuenta que recibió la vinculación
dispositivo_id          ID entregado por la API
secreto                 Secreto Base64URL entregado por la API
periodo_segundos        15, tomado de la respuesta
desfase_reloj_ms        hora del servidor - hora local al recibir la respuesta
```

`usuario_id` y `desfase_reloj_ms` son datos añadidos por la app para su
almacenamiento; no aparecen como esos campos en la respuesta de preparación.
También se conserva el identificador aleatorio de la instalación y la sesión
de usuario en sus almacenes correspondientes.

No se incluyen el secreto, los Bearer ni el identificador de instalación en el
contenido del QR. El secreto no debe imprimirse en logs ni mostrarse en pantalla.
La vinculación recuperada debe corresponder al ID del usuario que abre la app.

El ajuste actual del reloj se calcula al recibir la respuesta. No compensa de
forma exacta la latencia de red. Si el teléfono cambia manualmente su hora o
acumula desfase, necesita sincronizarse de nuevo con conexión.

## 5. Algoritmo exacto del QR actual, versión 2

El QR contiene texto, sin envoltorio JSON:

```text
upt_offline_v2.<dispositivo_id>.<paso_tiempo>.<otp>.<firma>
```

Se genera así:

1. Obtener el tiempo Unix en milisegundos y sumar `desfase_reloj_ms`.
2. Calcular `paso_tiempo = floor(tiempo_ajustado_ms / (periodo_segundos * 1000))`.
3. Formar el mensaje UTF-8 exacto
   `upt_offline_v2.<dispositivo_id>.<paso_tiempo>`.
4. Decodificar `secreto` desde Base64URL a sus 32 bytes.
5. Calcular `resumen = HMAC-SHA256(clave=secreto_bytes, mensaje=mensaje_utf8)`.
6. Obtener el desplazamiento: `resumen[31] & 0x0f`.
7. Tomar cuatro bytes consecutivos desde ese desplazamiento, en orden big-endian,
   quitando el bit de signo del primero: `resumen[offset] & 0x7f`.
8. Calcular `otp = valor % 1000000` y rellenarlo a seis dígitos con ceros.
9. Codificar los 32 bytes completos del resumen como Base64URL sin `=` para
   obtener `firma`, que tiene 43 caracteres.
10. Unir prefijo, ID, paso, OTP y firma con puntos, y dibujar esa cadena como QR.

Es un protocolo propio del proyecto. Un generador TOTP genérico que firme solo
el contador no reproduce este contrato: aquí se firma el mensaje que incluye
el prefijo y el ID del dispositivo.

### Vector de interoperabilidad comprobado en Node y Dart

```text
Secreto:       32 bytes con valor 0x01
Base64URL:     AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE
Dispositivo:   123
Paso:          119341442
OTP esperado:  510600
QR esperado:
upt_offline_v2.123.119341442.510600.Iw4NAut3QRiHJ0gAD-EeLHe2m6EYzEql0vZ32X2uLZc
```

El paso del ejemplo sirve para verificar el algoritmo; no es un código vigente
para una puerta real. La API todavía interpreta `upt_offline_v1` por
compatibilidad, pero una implementación nueva debe generar `v2`.

El OTP de seis cifras se puede mostrar junto al QR como referencia visual. No
existe un endpoint que autorice un ingreso recibiendo solamente esas seis cifras:
el verificador envía la cadena completa con su firma.

## 6. Reutilizar la implementación Dart del proyecto

Estos componentes **ya existen en el proyecto personal**:

| Componente | Responsabilidad |
| --- | --- |
| `ClienteApi.prepararQrOffline` | Petición HTTP autenticada de vinculación. |
| `AlmacenQrOffline` | Identificador aleatorio y persistencia segura por cuenta. |
| `VinculacionQrOffline` | Modelo local y algoritmo HMAC/OTP de la versión 2. |
| `ControladorIdentidadQr` | Preparación, recuperación, temporizador y rotación local. |
| `ControladorSesion` | Restauración local del estudiante vinculado ante fallos de red o tokens vencidos. |
| `PantallaCodigoQr` | Dibujo del QR, OTP visible y cuenta regresiva. |

Si la otra aplicación también usa `cliente_api_upt`, conviene reutilizar esos
componentes en lugar de duplicar el algoritmo. La preparación básica es:

```dart
import 'package:cliente_api_upt/cliente_api_upt.dart';

Future<VinculacionQrOffline> vincularDispositivo({
  required ClienteApi cliente,
  required ControladorSesion sesion,
  required AlmacenQrOffline almacen,
  required String plataforma,
}) async {
  final usuario = sesion.sesion!.usuario;
  final token = await sesion.obtenerTokenAcceso();
  final identificador = await almacen.identificadorDispositivo();
  final datos = await cliente.prepararQrOffline(
    token,
    identificador,
    plataforma,
  );
  final recibidoEn = DateTime.now();
  final vinculacion = VinculacionQrOffline(
    usuarioId: usuario.id,
    dispositivoId: datos['dispositivo_id'] as int,
    secreto: datos['secreto'] as String,
    desfaseRelojMs:
        DateTime.parse(datos['hora_servidor'] as String)
            .millisecondsSinceEpoch -
        recibidoEn.millisecondsSinceEpoch,
    periodoSegundos: datos['periodo_segundos'] as int,
  );
  await almacen.guardar(vinculacion);
  return vinculacion;
}
```

El ejemplo supone una sesión autenticada y una operación de vinculación
solicitada con conexión. Al integrarlo, conservar los controles del controlador
existente para no guardar una respuesta que llegue después de cambiar de cuenta
o cerrar sesión.

Para generar después, sin red:

```dart
final vinculacion = await almacen.recuperar(usuarioId);
if (vinculacion == null) {
  // Mostrar: «Conéctate para vincular este dispositivo».
  return;
}
final generado = vinculacion.generar(DateTime.now());
// Dibujar generado.codigo como QR.
// Mostrar generado.otp y calcular la cuenta regresiva con generado.expiraEn.
```

La pantalla puede actualizar la cuenta cada segundo, recalculando el código al
cruzar el siguiente intervalo de 15 segundos. Al volver del segundo plano debe
recalcular desde el reloj; no debe seguir mostrando una captura antigua.
No se requiere llamar a `GET /identidad-digital`, a `POST /codigos-qr` ni al GPS
del estudiante para generar este QR ya vinculado.

En la app personal, `main.dart` pasa el mismo `AlmacenQrOffline` al controlador
de sesión y al de QR, y pasa `clienteOffline: clienteApi` al controlador de QR.
La pantalla usa `iniciarRotacionAutomatica()`, que elige esta ruta para estudiantes.

## 7. Sesión y conectividad

La vinculación y los tokens HTTP cumplen funciones diferentes:

- La preparación requiere una sesión vigente. Si el token de acceso necesita
  renovación, la app debe renovarlo con internet antes de la primera vinculación.
- Después de vincular, la generación utiliza el secreto local. La ruta de
  validación del guardia comprueba dispositivo y usuario; no exige el token ni
  una sesión vigente del estudiante cuyo QR está leyendo.
- La sesión local guardada permite reconocer al estudiante al reabrir la app.
  El cliente actual contempla restaurarla para uso offline si tiene una
  vinculación correspondiente, incluso cuando venció el token de renovación.
- Esa restauración no vuelve válidos los tokens vencidos. Para consultar datos
  protegidos o preparar otra vinculación se necesita renovar o iniciar sesión
  de nuevo con internet.
- Un fallo de conexión o timeout no debe borrar una vinculación utilizable. Un
  rechazo explícito del servidor al intentar preparar se trata como un error
  de autorización o de vinculación, no como una simple falta de internet.

El controlador actual intenta preparar otra vez al entrar a QR si todavía tiene
un token de acceso utilizable; si falla por red, conserva la vinculación local.
Si los tokens ya vencieron y hay vinculación, puede generar directamente sin
esa nueva petición. La rotación posterior es local.

**No hay una expiración fija de la vinculación** en la respuesta ni en la
validación del dispositivo actual. Puede servir mientras no se revoque, el
usuario siga habilitado y el reloj siga sincronizado. Esto no garantiza que una
instalación pueda permanecer indefinidamente sin conectarse: reinstalar, borrar
datos, cambiar de teléfono, cerrar sesión o tener un reloj incorrecto puede
exigir otra preparación en línea.

## 8. Cómo valida el guardia un QR de un estudiante offline

Se usa el mismo endpoint de validación que para un QR en línea:

```http
POST /api/ingresos/validar
Authorization: Bearer <token_acceso_del_guardia>
Content-Type: application/json
```

```json
{
  "codigo_qr": "upt_offline_v2.123.119341442.510600.Iw4NAut3QRiHJ0gAD-EeLHe2m6EYzEql0vZ32X2uLZc",
  "punto_acceso_codigo": "PUERTA-PRINCIPAL",
  "ubicacion": {
    "latitud": -18.013,
    "longitud": -70.251,
    "precision_metros": 5,
    "obtenida_en": "2026-10-26T19:00:00.000Z"
  }
}
```

La cadena y la fecha anteriores son ejemplos de estructura. En una prueba real
se envía el QR recién generado y la ubicación/fecha actuales del **guardia**.
La puerta debe existir, estar activa y corresponder a su asignación. No se
envían el secreto, el token del estudiante ni una bandera `offline`.

El backend reconoce la versión por el prefijo y comprueba:

1. Autenticación, rol `SEGURIDAD`, asignación y ubicación del guardia.
2. Puerta activa y ubicación de escaneo dentro de su zona.
3. Dispositivo activo y vinculado al usuario.
4. Usuario activo, autorizado, verificado y con rol portador válido.
5. Paso de tiempo dentro del actual, el anterior o el siguiente de su propio
   reloj de base de datos: `abs(paso_recibido - paso_actual) <= 1`.
6. Firma HMAC y OTP correctos.
7. Que la combinación `(dispositivo_id, paso_tiempo)` no se haya usado.

La tolerancia de un intervalo a cada lado no significa que la app deba mostrar
un QR durante 45 segundos. Debe rotarlo cada 15 segundos. El consumo de un
intervalo es único para ese dispositivo entre todas las puertas; para otro
ingreso debe esperar al siguiente intervalo.

En una autorización, el cuerpo `datos` incluye `resultado: "AUTORIZADO"`,
`motivo: "ACCESO_AUTORIZADO"`, `mensaje`, `registrado_en`, `punto_acceso` e
`identidad`. En `identidad` figuran `foto_url`, `nombre_completo`,
`codigo_institucional`, `tipo_usuario`, `escuela` y `estado_academico`.

Una denegación de negocio normalmente también responde `200 OK`:

```json
{
  "datos": {
    "resultado": "DENEGADO",
    "motivo": "CREDENCIAL_YA_UTILIZADA",
    "mensaje": "Este código ya fue usado y no puede aceptarse nuevamente.",
    "registrado_en": "2026-10-26T19:00:02.000Z",
    "punto_acceso": {
      "codigo": "PUERTA-PRINCIPAL",
      "nombre": "Puerta principal"
    }
  }
}
```

El texto de `mensaje` es informativo; la app decide qué mostrar a partir de
`resultado` y `motivo`. **HTTP 200 no equivale a ingreso autorizado.** Una falla
de red del verificador no constituye una autorización ni crea un acceso pendiente
para sincronizar después.

## 9. Errores y recuperación

| Operación | Código o motivo | Tratamiento |
| --- | --- | --- |
| Preparación | `400 DATOS_INVALIDOS` | Revisar identificador, plataforma y propiedades del JSON. |
| Preparación | `401` de autenticación o `SESION_NO_VALIDA_PARA_CODIGO_QR` | Obtener una sesión vigente; requiere conexión. |
| Preparación | `403 USUARIO_NO_HABILITADO` | No habilitar una vinculación nueva. Revisar estado de la cuenta. |
| Preparación | `403 ROL_NO_HABILITADO_PARA_CODIGO_QR` | El endpoint exige rol estudiante. |
| Preparación | `409 DISPOSITIVO_VINCULADO_A_OTRA_CUENTA` | Revisar qué cuenta está usando esa instalación. No compartir el identificador entre cuentas. |
| Preparación | `500 ERROR_INTERNO` | Puede incluir una configuración incorrecta de `CLAVE_QR_OFFLINE`; revisarlo en el servidor. La API no publica el detalle interno. |
| Validación | `DISPOSITIVO_NO_VINCULADO` | El dispositivo fue revocado, no existe o perdió su secreto. Vincular con internet después de revisar la cuenta. |
| Validación | `CODIGO_OFFLINE_NO_VIGENTE` | Revisar hora y desfase; generar el código actual y sincronizar con conexión si persiste. |
| Validación | `INTEGRIDAD_CREDENCIAL_INVALIDA` | QR alterado, secreto sustituido o implementación incompatible. Revisar el vector de prueba y la vinculación. |
| Validación | `CREDENCIAL_YA_UTILIZADA` | Esperar la siguiente rotación; no reenviar el mismo QR como un acceso nuevo. |
| Validación | `USUARIO_NO_HABILITADO`, `IDENTIDAD_NO_VERIFICADA`, `ROL_PORTADOR_NO_HABILITADO` | La API deniega aunque el teléfono pueda seguir dibujando códigos. |

Errores HTTP usan el contenedor `error` con `codigo` y `mensaje`. Las denegaciones
de negocio del escaneo usan `datos.resultado` y `datos.motivo`. Las restricciones
de zona del guardia también pueden detener la petición con un error HTTP antes
de evaluar el QR.

## 10. Cierre de sesión, pérdida de dispositivo y cambios de secreto

`POST /autenticacion/cerrar-sesion`, con Bearer válido y cuando se revoca una
sesión activa, también revoca los dispositivos del usuario que tienen secreto
offline. Cerrar sesión no equivale a dejar la app en segundo plano.

La app personal borra localmente sesión, identificador y vinculación al cerrar
sesión. Si se cierra sin internet, el borrado local puede completarse, pero el
servidor no recibe esa revocación en ese momento. No hay una cola de revocaciones
offline implementada ni un endpoint público dedicado de revocación por ID de
dispositivo.

Vincular un dispositivo nuevo mientras se está conectado revoca el anterior.
Si se pierde el teléfono, esa vinculación desde otro dispositivo permite
invalidar el anterior; la administración también puede inhabilitar el usuario.

`DELETE /codigos-qr/actual` se refiere a credenciales **en línea**. No revoca
la vinculación offline. La pantalla personal oculta esa acción cuando muestra
un QR offline.

## 11. Requisitos del despliegue

El soporte está implementado en el código revisado. Para habilitarlo en una
instancia de la API se necesita:

1. Tener aplicada `012_credenciales_offline_dispositivo.sql`. Añade el secreto
   cifrado y fecha de vinculación a `dispositivos`, y crea
   `usos_codigos_offline` con unicidad por dispositivo e intervalo.
2. Configurar `CLAVE_QR_OFFLINE` con 32 bytes aleatorios en Base64URL sin relleno
   de 43 caracteres. Es una clave exclusiva del servidor, diferente del secreto
   que recibe cada teléfono.
3. Mantener esa misma clave entre reinicios y réplicas. El backend cifra los
   secretos de los dispositivos con AES-256-GCM. Cambiarla exige revocar y
   preparar las vinculaciones de nuevo.
4. Mantener reloj correcto en servidor/base de datos, HTTPS y disponibilidad
   de la API para los verificadores.

La generación del secreto del dispositivo no permite deducir que una instancia
desplegada tenga configurada esa clave. La comprobación real en el dominio se
hace con un estudiante autenticado: preparar, guardar, apagar internet en su
teléfono y validar desde un guardia conectado. No se inspeccionaron secretos
ni se hicieron vinculaciones sobre cuentas reales para elaborar esta guía.

## 12. Prueba de aceptación para la aplicación

1. Completar intranet y Google con internet; comprobar nombre, código y escuela.
2. Abrir QR con internet y verificar que la preparación responde `201`.
3. Apagar Wi-Fi y datos del **estudiante**, dejando conectado al guardia.
4. Verificar que el QR y el OTP cambian en cada intervalo sin pedir GPS ni
   hacer solicitudes para generar cada código.
5. Cerrar la app sin cerrar sesión y reabrirla todavía sin internet: debe
   recuperar la cuenta local y poder volver a QR.
6. Escanear un QR actual: la API debe autorizar y registrar el acceso si la
   cuenta y la puerta están habilitadas.
7. Reenviar exactamente el mismo QR: debe denegar con
   `CREDENCIAL_YA_UTILIZADA`. Esperar el siguiente intervalo para otra prueba.
8. Adelantar o atrasar el reloj más allá de la tolerancia: debe denegar el QR;
   restaurar y sincronizar la hora para recuperar el funcionamiento.
9. Vincular otro teléfono con internet: el anterior debe quedar denegado.
10. Cerrar sesión en línea: los códigos de esa vinculación deben quedar
    denegados. Iniciar sesión otra vez exige preparar de nuevo.
11. Dejar también sin internet al guardia: debe mostrar el error de conexión
    y no anunciar una autorización.

La app no puede saber sin conexión si el guardia ya consumió un QR o si el
servidor revocó el dispositivo. La decisión vigente siempre la devuelve la API
al verificador.

## 13. Verificación técnica y fuentes

Durante esta revisión pasaron 12 pruebas del backend, incluyendo firma y
validación HTTP con MariaDB temporal aislado; también pasaron el vector de
interoperabilidad Dart y las cuatro pruebas del controlador offline del
estudiante. No se utilizó la base de datos del despliegue.

Comandos para reproducir las comprobaciones sin MariaDB:

```bash
cd api-backend-entrada-upt
node --test test/codigos_qr_offline.prueba.js
```

```bash
cd paquetes/cliente_api_upt
flutter test test/vinculacion_qr_offline_test.dart
```

```bash
cd seguridad_estudiante
flutter test test/qr_offline_test.dart
```

La prueba de integración requiere una **base de desarrollo aislada** configurada
con las variables `DB_*`, migraciones y datos de prueba:

```bash
cd api-backend-entrada-upt
NODE_ENV=test node --test --test-concurrency=1 \
  test/codigos_qr_offline.prueba.js test/validacion_ingresos.prueba.js
```

Referencias de implementación:

- [Rutas QR](api-backend-entrada-upt/src/modulos/codigos_qr/rutas/codigos_qr.rutas.js) y [esquemas de preparación](api-backend-entrada-upt/src/modulos/codigos_qr/validacion/codigos_qr.esquemas.js).
- [Vinculación y revocación de otros dispositivos](api-backend-entrada-upt/src/modulos/codigos_qr/repositorios/repositorio_codigos_qr_offline_mariadb.js).
- [Algoritmo, versiones y cifrado](api-backend-entrada-upt/src/seguridad/codigos_qr_offline.js).
- [Validación y consumo del QR offline](api-backend-entrada-upt/src/modulos/ingresos/repositorios/repositorio_ingresos_mariadb.js).
- [Revocación al cerrar sesión](api-backend-entrada-upt/src/modulos/autenticacion/repositorios/repositorio_autenticacion_mariadb.js).
- [Generador Dart](paquetes/cliente_api_upt/lib/modelos/vinculacion_qr_offline.dart) y [almacenamiento seguro](paquetes/cliente_api_upt/lib/sesion/almacen_qr_offline.dart).
- [Restauración de sesión](paquetes/cliente_api_upt/lib/sesion/controlador_sesion.dart).
- [Controlador de QR del estudiante](seguridad_estudiante/lib/controladores/controlador_identidad_qr.dart) y [pantalla QR](seguridad_estudiante/lib/pantallas/pantalla_codigo_qr.dart).
- [Prueba de integración del backend](api-backend-entrada-upt/test/validacion_ingresos.prueba.js) y [pruebas de la app offline](seguridad_estudiante/test/qr_offline_test.dart).
