# Prompt autónomo para crear la aplicación Flutter desde cero

Copia todo el bloque al agente de código en la máquina donde crearás la app.
No necesita el repositorio original, código previo ni documentos adicionales.
Necesita Flutter y las herramientas de las plataformas que vaya a compilar.
El backend ya existe: este prompt construye exclusivamente su cliente Flutter.

```text
Actúa como un desarrollador Flutter y crea desde cero una aplicación llamada
seguridad_estudiante, con título visible "Identidad Digital UPT". Trabaja en
el directorio actual: si está vacío, genera el proyecto; si contiene un
proyecto Flutter, integra la implementación respetando sus archivos existentes.
Implementa y verifica la aplicación; no entregues sólo un plan ni pseudocódigo.

Este prompt es la especificación completa. No tienes acceso a una app anterior
ni debes pedir un repositorio de referencia. Construye una app real que consuma
la API existente. Prioriza Android y entrega también soporte Chrome. Organiza
el código para que una persona pueda copiar el proyecto a otra máquina y
ejecutarlo siguiendo un README. No necesitas instalar o desarrollar el backend.

1. PROYECTO, ARQUITECTURA Y ASPECTO

Usa Flutter estable compatible con Dart 3.10 y paquetes compatibles para HTTP,
almacenamiento seguro, apertura de enlaces, geolocalización y representación
QR: http, flutter_secure_storage, url_launcher, geolocator y qr_flutter.
Consulta la documentación oficial para configurar sus versiones y plataformas;
genera y entrega pubspec.lock. No uses dependencias path externas al proyecto.

Organiza lib/ en aplicacion/, configuracion/, modelos/, servicios/, sesion/,
controladores/, navegacion/, pantallas/, tema/ y utilidades/. Usa modelos tipados,
un único cliente HTTP, interfaces para HTTP/almacenamiento/navegador/ubicación
y controladores con ChangeNotifier o un mecanismo equivalente coherente.
Permite inyectar reloj y espera para probar polling y vencimientos.

Usa Material 3, tema claro con ColorScheme.fromSeed y color #8A1538. Textos
en español, inputs con OutlineInputBorder, SafeArea, contenido desplazable,
ancho máximo aproximado de 440 px en formularios, estados de carga y mensajes
accesibles. Adapta tamaños a móvil y escritorio sin desbordamientos. No hacen
falta imágenes o archivos institucionales externos: usa iconos Material y un
avatar de reemplazo si no hay foto o falla su carga.

Pantallas:
- Preparación/restauración y error de configuración de URL.
- Bienvenida con pasos "Verifica la intranet UPT" y "Accede con Google
  institucional", y botón "Ingresar o registrarme".
- Verificación de intranet con imagen CAPTCHA y formulario.
- Confirmación de intranet y botón "Continuar con Google institucional".
- Espera de Google con estado, opción de reabrir el enlace y reintentar consulta.
- Inicio autenticado con nombre, acceso a identidad, QR y cierre de sesión.
- Identidad digital con foto/avatar, nombre, código, correo, roles, estados,
  perfil académico cuando exista y actualización manual.
- Código QR temporal con punto de acceso, cuenta regresiva y anulación.

No hay contraseña local de esta aplicación. Registro e inicio de sesión usan
el mismo flujo de intranet y Google Workspace.

2. CONFIGURACIÓN Y REGLAS HTTP

URL base predeterminada: https://api-moviles.fottuto.men/api
Léela con String.fromEnvironment('URL_API_UPT', defaultValue: ...), sobrescribible
mediante --dart-define. Valida esquema, host y ruta /api antes de hacer llamadas;
rechaza userInfo, query, fragmento y HTTP en release. Muestra error de
configuración si es inválida. La base ya contiene /api. Todas las rutas de
este prompt se concatenan a la base SIN agregar otro /api. No uses una ruta
absoluta con Uri.resolve que elimine el segmento /api.

Usa Accept: application/json. Para cuerpos JSON agrega Content-Type:
application/json y jsonEncode. Para rutas protegidas agrega Authorization:
Bearer <token_acceso>. Login y renovación no llevan Authorization. Los cuerpos
son estrictos: no envíes claves adicionales ni nulls no especificados.

Éxito JSON: {"datos": ...}.
Error HTTP: {"error":{"codigo":"...","mensaje":"..."}}.
204: sin cuerpo; no ejecutar jsonDecode.
Fechas: String ISO 8601 con zona; convertir a DateTime y comparar en UTC.
UUID/textos/tokens/códigos: String. id: int. roles: List<String>. Coordenadas
y precisión: num/double; convertir con (valor as num).toDouble().
Valida envoltorios y tipos antes de construir modelos. Acepta campos adicionales
en respuestas para compatibilidad; en peticiones envía únicamente el contrato.

Timeouts: CAPTCHA 45 s, verificar intranet 120 s, otras solicitudes 15 s.
Separa error HTTP, transporte, timeout, JSON/modelo inválido y almacenamiento.
No conviertas todo catch a "sin conexión". Respuestas HTML de proxies son
RESPUESTA_INVALIDA. Conserva método, ruta sin query, HTTP y código cuando existan.
En debug registra etapa y tipo de excepción sin imprimir cuerpos, tokens,
contraseñas, CAPTCHA, UUID temporales ni URLs completas de OAuth.

3. CONTRATO DE LOGIN, EN ESTE ORDEN

A) GET /registro-estudiante/intranet/captcha (público, sin cuerpo)
200:
{"datos":{"transaccion_id":"<uuid_captcha>","imagen_base64":"<base64_puro>",
"tipo_imagen":"image/png","expira_en":"<fecha_iso>"}}

Carga al entrar a la pantalla, nunca desde build(). Usa base64Decode y
Image.memory; imagen_base64 no es una URL ni incluye data:image/png;base64,.
Conserva imagen, UUID y vencimiento juntos. Deshabilita verificar si falta
imagen o transacción vigente. "Solicitar nuevo CAPTCHA" reemplaza los tres
valores y limpia el texto ingresado. Evita cargas simultáneas o respuestas
viejas que reemplacen una transacción más reciente.
Errores: 429 INTRANET_SATURADA, 503 INTRANET_NO_DISPONIBLE, 500 ERROR_INTERNO.

B) POST /registro-estudiante/intranet/verificar (público)
Cuerpo:
{"transaccion_id":"<uuid_captcha>","codigo":"2026000001",
"contrasena":"123456","captcha":"3868"}
codigo: String de exactamente 10 dígitos.
contrasena: String numérica de 1 a 6 caracteres; mostrar oculta inicialmente.
captcha: String numérica de 1 a 5 caracteres. Preserva ceros iniciales.
200:
{"datos":{"codigo":"2026000001","nombre_apellidos":"APELLIDOS, NOMBRES",
"verificacion_intranet_id":"<uuid_verificacion>",
"verificacion_expira_en":"<fecha_iso>"}}

Bloquea doble envío y cambio de CAPTCHA mientras se verifica. Limpia los
controladores de contraseña y CAPTCHA al finalizar; nunca persistas esos datos.
El CAPTCHA dura aproximadamente cinco minutos y el servicio lo consume antes
de verificar. Ante un intento fallido o una respuesta perdida, solicita uno
nuevo antes de reenviar. Un 400 de validación puede no consumirlo; descártalo
de todas formas si necesitas simplificar la recuperación. En éxito conserva
verificacion_intranet_id y avanza a Google sin repetir verificación.

Errores: 400 DATOS_INVALIDOS; 401 CREDENCIALES_INTRANET_INVALIDAS;
410 CAPTCHA_EXPIRADO; 422 NAVEGACION_INTRANET_INVALIDA,
PERFIL_INTRANET_NO_ENCONTRADO o CODIGO_INTRANET_NO_COINCIDE;
503 INTRANET_NO_DISPONIBLE. Muestra el motivo y permite reiniciar el paso.

C) POST /registro-estudiante/google/iniciar (público)
Cuerpo: {"verificacion_intranet_id":"<uuid_verificacion>"}
201:
{"datos":{"transaccion_id":"<uuid_google>",
"url_autorizacion":"https://accounts.google.com/o/oauth2/v2/auth?...",
"expira_en":"<fecha_iso>"}}

La verificación de intranet y la operación Google duran aproximadamente diez
minutos cada una; usa las fechas recibidas. Conserva la transacción Google
antes de abrir el navegador. El UUID CAPTCHA, UUID verificación y UUID Google
son distintos; modela sus usos por separado. Errores: 400 DATOS_INVALIDOS,
410 VERIFICACION_INTRANET_EXPIRADA, 429 GOOGLE_OAUTH_SATURADO,
503 GOOGLE_OAUTH_NO_CONFIGURADO.

Abre EXACTAMENTE url_autorizacion. Usa navegador externo en Android. Prepara
primero la URL y luego habilita un clic directo para abrirla en Chrome sin
esperar otra petición HTTP antes del lanzamiento. No uses WebView embebida.
No reconstruyas URL ni agregues parámetros. No pongas client_secret en Flutter
ni implementes Google Sign-In para sustituir este contrato.

Google vuelve al backend por /api/registro-estudiante/google/callback; el backend
redirige a /api/registro-estudiante/google/resultado?estado=correcto|error.
Son páginas del navegador, no peticiones JSON de Flutter. La página "Identidad
verificada" confirma el callback, pero NO entrega los tokens a Flutter y NO
abre automáticamente la app. El usuario vuelve manualmente. No hacen falta
deep links, callback Flutter ni credenciales OAuth en el cliente.

D) GET /registro-estudiante/google/estado/<uuid_google> (público)
200 pendiente: {"datos":{"estado":"PENDIENTE"}}
200 procesando: {"datos":{"estado":"PROCESANDO"}}
200 error de negocio:
{"datos":{"estado":"ERROR","error":{"codigo":"GOOGLE_DOMINIO_NO_AUTORIZADO",
"mensaje":"Sólo se admiten cuentas Google Workspace de virtual.upt.pe."}}}
200 éxito:
{"datos":{"estado":"COMPLETA","sesion":<Sesion>}}
HTTP 400 DATOS_INVALIDOS; HTTP 410 GOOGLE_OAUTH_EXPIRADO.

Sólo admite Google institucional @virtual.upt.pe; el backend verifica dominio,
correo, nombre y código contra la intranet. Otros errores dentro de datos.error
pueden ser GOOGLE_OAUTH_CANCELADO, GOOGLE_ID_TOKEN_INVALIDO,
GOOGLE_CORREO_NO_VERIFICADO, GOOGLE_PERFIL_INCOMPLETO, CODIGOS_NO_COINCIDEN,
NOMBRES_NO_COINCIDEN o IDENTIDAD_INSTITUCIONAL_EN_CONFLICTO. Trata cualquier
código de negocio recibido como tal y muestra su mensaje sin exponer tokens.

Polling: un único bucle secuencial, al menos dos segundos entre peticiones,
sin Timer.periodic con HTTP que se solape. Verifica vencimiento después de la
espera y antes de consultar. Detén en ERROR, COMPLETA, vencimiento, cancelación
o destrucción. Si pausas consultas al abrir Android el navegador, retómalas en
AppLifecycleState.resumed mediante el MISMO coordinador y sin duplicar bucles.
Mantén vivo el controlador al salir al navegador. Al volver no recargues
CAPTCHA ni reinicies el flujo por el mero cambio de ciclo de vida.

En COMPLETA detén consultas antes de esperar guardado/navegación. El backend
consume la transacción al entregar ese resultado: otra consulta puede devolver
410. Extrae datos.sesion, valida roles, guarda y navega al inicio. No renueves
como requisito inmediatamente después de recibir una sesión nueva. Si se pierde
la respuesta completa o falla el guardado, no prometas volver a obtenerla con
el mismo UUID. Explica que debe reiniciarse el acceso cuando no sea recuperable.
Ante fallo temporal sin resultado final, conserva el estado Google vigente y
permite retomar consultas con el mismo UUID; evita reintentos paralelos.

El backend guarda estas transacciones en memoria: un reinicio o una consulta
a otra réplica puede devolver 410. No ocultes ese HTTP como falta de conexión.
Si Android termina el proceso y se perdió el estado en memoria del cliente,
explica que debe reiniciar; no persistas contraseña o URL OAuth para resolverlo.

4. MODELO DE SESIÓN Y MANTENIMIENTO

<Sesion> (objeto, no String):
{"tipo_token":"Bearer","token_acceso":"<token_opaco_acceso>",
"token_renovacion":"<token_opaco_renovacion>",
"token_acceso_expira_en":"<fecha_iso>",
"token_renovacion_expira_en":"<fecha_iso>",
"usuario":{"id":10,"codigo_institucional":"2026000001",
"correo_institucional":"usuario@virtual.upt.pe","nombres":"NOMBRES",
"apellidos":"APELLIDOS","roles":["ESTUDIANTE"]}}

Los tokens son opacos: no son JWT para decodificar ni datos que invente Flutter.
Acepta al menos uno de ESTUDIANTE, DOCENTE, TRABAJADOR. Si no tiene rol permitido,
rechaza la sesión, borra tokens locales y revoca remotamente cuando sea posible.
Guarda la sesión como un único registro JSON con almacenamiento seguro para
reemplazar ambos tokens y fechas juntos. No persistas transacciones ni URLs
OAuth. Inicializa plugins antes de usarlos. Si guardar falla, informa fallo de
almacenamiento, no credenciales incorrectas ni necesariamente falta de red.

GET /autenticacion/sesion (Bearer, sin cuerpo)
200: {"datos":{"usuario":<Usuario_de_Sesion>}}
401 AUTENTICACION_REQUERIDA o TOKEN_ACCESO_INVALIDO;
403 USUARIO_NO_HABILITADO.

POST /autenticacion/renovar-sesion (sin Bearer)
Cuerpo: {"token_renovacion":"<ultimo_token_recibido>"}
El token es String de 40 a 200 caracteres, recortado.
200: {"datos":<Sesion>}. Rota AMBOS tokens; los anteriores se invalidan.
400 DATOS_INVALIDOS; 401 TOKEN_RENOVACION_INVALIDO;
403 USUARIO_NO_HABILITADO.

Al iniciar, restaura almacenamiento. Si venció renovación, borra sesión y
muestra login. Si acceso venció o está a menos de 30 s de vencer, renueva antes
de usarlo; si sigue vigente, valida usuario con /autenticacion/sesion. Coordina
renovación con un único Future compartido para llamadas concurrentes. Para
401 TOKEN_ACCESO_INVALIDO, intenta una renovación válida una sola vez y repite
la petición rechazada como máximo una vez. No generes ciclos de reintentos.
No reintentes automáticamente una renovación cuya respuesta se perdió: pudo
haber rotado el token. Ante fallos temporales conserva una sesión válida y
permite reintentar sin fingir que se comprobó remotamente.

POST /autenticacion/cerrar-sesion (Bearer, SIN cuerpo)
204 sin JSON. Revoca la sesión remota si la red lo permite y borra SIEMPRE la
sesión local. Detén polling, QR y temporizadores; limpia datos del usuario y
la pila de navegación para que "atrás" no vuelva a pantallas autenticadas.
Descarta respuestas antiguas al cerrar/cambiar sesión mediante una revisión
de autenticación o mecanismo equivalente.

5. IDENTIDAD DIGITAL

GET /identidad-digital (Bearer, sin cuerpo), 200:
{"datos":{"id":10,"codigo_institucional":"2026000001",
"correo_institucional":"usuario@virtual.upt.pe","nombres":"NOMBRES",
"apellidos":"APELLIDOS","nombre_completo":"NOMBRES APELLIDOS",
"foto_url":null,"roles":["ESTUDIANTE"],
"verificacion":{"estado":"VERIFICADA","verificada_en":"<fecha_iso>"},
"acceso":{"estado_usuario":"ACTIVO","estado_autorizacion":"AUTORIZADO"},
"perfil_academico":{"escuela":null,"facultad":null,
"estado_academico":"<texto_del_backend>","periodo_academico":null},
"preparacion_codigo_qr":{"puede_solicitar":true,"requisitos":{
"usuario_activo":true,"acceso_autorizado":true,
"identidad_verificada":true,"rol_portador":true}},
"actualizado_en":"<fecha_iso>"}}

foto_url puede ser URL String o null; perfil_academico puede ser objeto o null.
Escuela, facultad, periodo y fecha de verificación pueden ser null. No inventes
estado académico; muestra el texto recibido. Muestra los estados institucionales
y habilita solicitar QR sólo si preparacion_codigo_qr.puede_solicitar es true.
Ofrece carga, actualización y reintento. Errores específicos:
404 IDENTIDAD_DIGITAL_NO_ENCONTRADA y 403 USUARIO_NO_HABILITADO, además de 401.

6. CÓDIGO QR TEMPORAL Y UBICACIÓN

POST /codigos-qr (Bearer)
Cuerpo JSON exacto:
{"ubicacion":{"latitud":-18.013,"longitud":-70.251,
"precision_metros":5.0,"obtenida_en":"<fecha_iso_de_la_medicion>"}}

Coordenadas de ejemplo, no un reemplazo del GPS. Usa ubicación REAL reciente,
latitud entre -90 y 90, longitud entre -180 y 180, precisión entre 0 y 10000
metros. Usa timestamp real de la medición en UTC. Maneja servicio apagado,
permisos denegados/denegados permanentemente, baja precisión y espera de 12 s.
Pide permiso al solicitar QR; no obligues a conceder ubicación para iniciar
sesión. El backend valida antigüedad, precisión, identidad y zona configurada.

201:
{"datos":{"codigo_qr":"<credencial_opaca>","formato":"UPT_QR_V1",
"estado":"PENDIENTE","emitida_en":"<fecha_iso>","expira_en":"<fecha_iso>",
"duracion_segundos":15,"un_solo_uso":true,"ubicacion":{
"resultado":"DENTRO_DE_ZONA_CONFIGURADA","precision_reportada_metros":5.0,
"distancia_calculada_metros":10.0,
"punto_acceso":{"codigo":"<codigo_puerta>","nombre":"<nombre_puerta>"}}}}

Representa EXACTAMENTE codigo_qr con QrImageView; no lo decodifiques, alteres
ni agregues usuario/ubicación. Flutter dibuja la credencial que genera la API;
la autorización de ingreso y consumo pertenecen al backend. No implementes
escáner ni validación de ingreso en esta app.

El usuario pulsa "Usar mi ubicación y generar" para iniciar. Muestra nombre
del punto, QR sobre blanco y cuenta regresiva calculada desde expira_en, no
decrementando un contador que asuma ejecución continua. Los 15 s del ejemplo
son configurables: respeta la duración y fecha reales. Oculta inmediatamente
el código vencido. Mientras permanezca en esa pantalla, genera el siguiente
al vencer mediante una operación secuencial con nueva ubicación. Detén rotación
al salir, cerrar sesión, anular o fallar; no generes en segundo plano. Al
regresar del segundo plano comprueba vencimiento antes de mostrar un QR.

DELETE /codigos-qr/actual (Bearer, sin cuerpo)
204 sin JSON. Pide confirmación local para anular, detén rotación y elimina
el QR tras éxito. Si falla, muestra error de anulación y sigue respetando su
vencimiento; no generes automáticamente otro QR tras una anulación.

Errores posibles de QR: DATOS_INVALIDOS, USUARIO_NO_HABILITADO,
IDENTIDAD_DIGITAL_NO_ENCONTRADA, IDENTIDAD_NO_VERIFICADA,
ROL_NO_HABILITADO_PARA_CODIGO_QR, PUNTO_ACCESO_NO_DISPONIBLE,
UBICACION_FUERA_DE_ZONA, UBICACION_DESACTUALIZADA,
MOMENTO_UBICACION_INVALIDO, PRECISION_UBICACION_INSUFICIENTE y
CONFIGURACION_CODIGO_QR_INVALIDA. Maneja código y mensaje sin asumir que
cualquier error de negocio debe cerrar la sesión. La API decide los umbrales
y la puerta; no agregues un campo de puerta al POST.

7. ANDROID, WEB Y PORTABILIDAD

Incluye INTERNET, ACCESS_COARSE_LOCATION y ACCESS_FINE_LOCATION en
android/app/src/main/AndroidManifest.xml. Configura plugins/SDK/JDK conforme
a sus versiones. No copies local.properties de otra máquina. Inicializa con
WidgetsFlutterBinding.ensureInitialized(). No agregues claves OAuth a Android.
Una compilación local no equivale a configurar firma de publicación: documenta
por separado la firma release si se solicita distribuirla.

Chrome: evita dart:io y Platform.* sin guardas/importaciones condicionales.
Abre Google en _blank desde clic directo con la URL ya preparada. Mantén la
pestaña Flutter para polling; no uses _self. Permite reabrir la URL mientras
la transacción siga vigente. true de launchUrl no garantiza apertura en Web.
Este contrato usa Bearer/JSON, no cookies: no actives withCredentials.
CORS se configura en la API, no mediante cabeceras que agregue el cliente.
El almacenamiento Web requiere HTTPS o localhost. Usa --web-port fijo para
conservar el origen durante desarrollo. Usa geolocalización Web y sus permisos
reales; maneja falta de disponibilidad sin inventar coordenadas.

Para API publicada usa siempre HTTPS. localhost:<puerto_flutter> es la app Web,
no la API. Una API local sólo se usa si existe y se configura expresamente:
127.0.0.1:3000 para escritorio/Chrome en la misma máquina; 10.0.2.2:3000 para
emulador Android estándar hacia el anfitrión. El callback Google local requiere
configuración del backend y acceso desde el navegador; no prometas OAuth local
por cambiar sólo URL_API_UPT. Para estas entregas usa la API publicada.

Todo debe estar dentro del proyecto: código, recursos, plataformas, pruebas,
pubspec.yaml, pubspec.lock y README. Excluye build/, .dart_tool/, cachés,
credenciales y claves. No conectes a MariaDB, no crees el backend y no inventes
endpoints alternativos cuando una llamada falle.

8. PRUEBAS Y CRITERIOS DE ENTREGA

Prueba con MockClient y dobles de plugins/reloj: URLs, cabeceras, cuerpos,
envoltorios, imágenes Base64, modelos nullable, errores HTTP vs transporte,
204, UUID correctos, ausencia de doble polling, consumo de COMPLETA una vez,
regreso del navegador sin reinicio, error de guardado, renovación concurrente,
restauración, navegación y expiración/rotación/anulación de QR. No simules
éxitos dentro de la implementación de producción para hacer pasar pruebas.

Ejecuta y corrige:
  flutter pub get
  dart format lib test
  flutter analyze
  flutter test
  flutter build apk --debug --dart-define=URL_API_UPT=https://api-moviles.fottuto.men/api
  flutter build web --dart-define=URL_API_UPT=https://api-moviles.fottuto.men/api

Después verifica que pub get --enforce-lockfile funcione con el lockfile
entregado. Si un SDK/plataforma falta, continúa las verificaciones disponibles
y especifica el impedimento; no declares ejecutado lo que no ejecutaste.

README con versiones exactas verificadas, instalación Flutter/Android SDK/JDK,
flutter doctor -v, flutter devices, configuración de URL, estructura, comandos
desde la raíz del proyecto y ubicación del APK. Incluye:
  flutter pub get --enforce-lockfile
  flutter run -d <id_android> --dart-define=URL_API_UPT=https://api-moviles.fottuto.men/api
  flutter run -d chrome --web-port=63155 --dart-define=URL_API_UPT=https://api-moviles.fottuto.men/api
Explica que cambiar dart-define requiere detener y ejecutar de nuevo.

Incluye diagnóstico del caso "Google dice Identidad verificada, pero Flutter
muestra error": revisar consulta de estado, UUID, consultas duplicadas/410,
datos.sesion, almacenamiento y navegación. En Android mirar consola Flutter;
en Chrome Console y Network. No atribuyas genéricamente ese caso a CORS o red.

Checklist manual: cargar y mostrar CAPTCHA, verificar credenciales propias,
abrir Google @virtual.upt.pe, completar, volver, llegar al inicio, reiniciar y
restaurar sesión, consultar identidad, solicitar QR dentro de una zona habilitada,
ver vencimiento/rotación, anular y cerrar sesión. No necesitas credenciales
reales para compilar/pruebas con dobles; para probar login real el usuario las
ingresa personalmente y no las comparte en el chat. QR real requiere permiso
de ubicación y una puerta habilitada; si no se probó, indícalo.

Entrega la aplicación implementada, pruebas, lockfile, README y resultados
precisos. No afirmes reproducción visual exacta de una app que no viste ni
login real exitoso si sólo usaste dobles. La aplicación debe poder construirse
en una máquina nueva sin archivos o rutas de otra máquina.
```
