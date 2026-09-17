# Auditoría de los hitos 1 a 12

Fecha: 12 de septiembre de 2026. Rama examinada:
`hito-12-preparacion-operativa`. Commit de referencia: `20de217`.

Actualización: los hallazgos técnicos se corrigieron en el Hito 13 y se
volvieron a verificar en la rama `correcciones-auditoria-hitos`.

## Estado final después de las correcciones

Los alcances **locales y automatizables** de los hitos 1 a 12 quedan completos:
los seis hallazgos A1–A6 están cerrados. La autenticación institucional se
mantiene fuera del alcance por instrucción expresa; las pruebas físicas y los
valores de despliegue siguen siendo condiciones de puesta en campo, no fallos
que puedan cerrarse únicamente en este repositorio.

| Hallazgo | Estado | Evidencia de cierre |
| --- | --- | --- |
| A1 — desfase horario | Corregido | Pool con zona coherente; tres pruebas reales de instante, ida y vuelta de `DATETIME` y día operativo; vigencia QR verificada desde Node y Dart. |
| A2 — respuestas tardías | Corregido | Revisión de autenticación comprobada después de cada espera; pruebas de cierre/cambio de sesión descartan identidad e historial antiguos. |
| A3 — renovación concurrente | Corregido | Una única renovación compartida por revisión; pruebas de simultaneidad y respuesta posterior al cierre. |
| A4 — rutas protegidas sobre login | Corregido | El navegador se recrea al cambiar la revisión; pruebas widget en ambas aplicaciones confirman que QR e historial salen de la pila. |
| A5 — fecha fija en pruebas | Corregido | Reloj inyectable y sesiones ficticias relativas al momento de ejecución. |
| A6 — integración simulada | Corregido | Flujo real `ClienteApi → HTTP → Express → MariaDB`, más recorrido de los 30 endpoints publicados. |

Resumen final por hito:

| Hito | Estado local final |
| --- | --- |
| 1–8 | Completos dentro del alcance backend local; A1 quedó corregido y cubierto. |
| 9 | Completo local; sesión compartida, renovación y navegación tienen cobertura de carreras. |
| 10 | Completo local; aislamiento de identidad/QR, reloj y navegación verificados. |
| 11 | Completo local; aislamiento de validación/historial y navegación verificados. |
| 12 | Completo local; el verificador unificado incluye ahora integración móvil real y todos los endpoints. |

## Dictamen de la auditoría inicial

**No está todo completo.** Los doce hitos tienen implementaciones y documentos,
pero el cierre funcional local necesita correcciones. Tampoco equivalen al
producto institucional completo descrito por la arquitectura.

La afirmación anterior de que el producto funcional local quedaba cerrado en
el Hito 12 fue demasiado amplia. Las pruebas existentes pasan, pero no cubren
fallos reproducibles de fechas, concurrencia de sesión, aislamiento entre
cuentas y navegación autenticada.

Esta auditoría evalúa dos alcances distintos:

- Los entregables locales de las ramas y documentos de los hitos.
- Los requisitos del producto institucional en la
  [arquitectura enlazada por el propio backend](https://github.com/CarlosAyala1989/app-seguridad-entrada-upt/blob/main/ARQUITECTURA_SISTEMA_IDENTIDAD_DIGITAL_UPT.md).

Los módulos institucionales aplazados no se presentan como regresiones de la
autenticación local: son trabajo que falta para completar el producto.

## Resultado inicial por hito

«Completo local» significa que el alcance declarado tiene implementación y
evidencia de pruebas, sin un incumplimiento específico confirmado en esta
revisión. No significa certificación para producción.

| Hito | Entregable | Resultado de auditoría |
| --- | --- | --- |
| 1 | Fundamentos backend, salud y migraciones | Implementado. Reabrir la configuración de conexión por el desfase horario A1. Salud y manejo básico de solicitudes pasan. |
| 2 | Modelo de datos | Completo local. Las ocho migraciones están registradas como aplicadas; las pruebas verifican tablas, catálogos, restricciones e índices. La tabla de dispositivos no constituye por sí sola un flujo de gestión de dispositivos. |
| 3 | Administración de usuarios | Completo en su alcance local por API: altas, consultas, cambios, estados, roles, contraseña y protección administrativa. No incluye un panel gráfico ni incorporación institucional. |
| 4 | Autenticación y autorización | Implementado localmente con rotación y revocación en backend. Reabrir las fechas de vencimiento comunicadas a las apps por A1. La autenticación institucional está aplazada. |
| 5 | Identidad digital propia | Completo en su alcance local: consulta propia, datos permitidos y elegibilidad. La verificación proviene de un estado administrado; no comprueba cuenta institucional e intranet. Sus fechas también dependen de A1. |
| 6 | QR temporal | Implementado el motor de emisión, hashes, ubicación y rotación. Reabrir por A1: la caducidad transmitida a Flutter no representa correctamente la vigencia real. |
| 7 | Validación de ingresos | Las pruebas confirman autorización, denegación, integridad, geocerca y consumo único concurrente. El momento comunicado del ingreso está afectado por A1; falta aceptación con dispositivos. |
| 8 | Administración operativa | API implementada con filtros, historial, puntos, auditoría y configuración. Reabrir la coherencia temporal de registros, filtros y día operativo por A1. No hay panel administrativo. |
| 9 | Base Flutter y sesión compartida | Parcial: corregir concurrencia de renovación y salida de rutas protegidas, A3 y A4. |
| 10 | Identidad y QR del portador | Parcial: corregir A1, A2 y A4; estabilizar las fechas de las pruebas, A5. GPS y QR reales no tienen aceptación documentada. |
| 11 | Escaneo e historial de seguridad | Parcial: corregir aislamiento de respuestas y navegación, A2 y A4; fechas de historial afectadas por A1. Cámara/GPS reales pendientes. |
| 12 | Preparación operativa e integración | Parcial: existen validadores y comando unificado, pero falta cobertura que detecte A1–A5 e integración móvil real, A6. Distribución institucional pendiente. |

## Hallazgos confirmados

### A1 — Alta: diferencia de cinco horas entre MariaDB y Node

Evidencia principal:
[config/database.js](api-backend-entrada-upt/src/config/database.js), líneas 4–14.
El pool no establece una política de zona horaria. El esquema usa `DATETIME(3)`;
las fechas creadas por `CURRENT_TIMESTAMP(3)` se convierten a `Date` con la zona
local del proceso Node.

En este entorno se comprobó con consultas de lectura:

- MariaDB: zona de sesión `SYSTEM`, zona del sistema `UTC`.
- Node: `America/Lima`.
- Hora real de Node: `2026-09-12T14:22:45.953Z`.
- `CURRENT_TIMESTAMP(3)` interpretado por el conector:
  `2026-09-12T19:22:45.906Z`.
- Diferencia frente al epoch de MariaDB: **18 000 segundos**.
- La expresión SQL usada para un vencimiento a 45 segundos produjo una fecha
  interpretada como vigente durante **18 044,953 segundos** desde Node.

La reproducción usó `SELECT CURRENT_TIMESTAMP(3),
UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)),
TIMESTAMPADD(SECOND,45,CURRENT_TIMESTAMP(3))`, sin crear una credencial ni
modificar datos.

La emisión de QR usa esa misma expresión en
[repositorio_codigos_qr_mariadb.js](api-backend-entrada-upt/src/modulos/codigos_qr/repositorios/repositorio_codigos_qr_mariadb.js),
línea 182, y el servicio serializa el resultado con `toISOString()`. El
[controlador del portador](seguridad_estudiante/lib/controladores/controlador_identidad_qr.dart),
línea 143, calcula la cuenta regresiva a partir de esa fecha absoluta.

Consecuencia: Flutter puede seguir mostrando como vigente un QR que MariaDB
ya considera vencido. El backend sigue rechazando el QR después de sus 45
segundos reales; el fallo no amplía su aceptación en la base de datos. Las
fechas de tokens también se generan en MariaDB: la app puede retrasar su
renovación y recibir un `401` antes del vencimiento que muestra su sesión.
Registros y filtros temporales comparten el problema. El resumen diario usa
`CURRENT_DATE()` de MariaDB, por lo que su día operativo actual es UTC.

Criterio de cierre: definir una política coherente para almacenamiento,
conector, serialización y día operativo; verificar la vigencia real del QR y
de sesiones con Node en Lima y MariaDB en UTC, además de filtros y límites de
día.

### A2 — Alta: respuestas antiguas pueden reintroducir datos de otra sesión

Evidencias:

- [ControladorIdentidadQr](seguridad_estudiante/lib/controladores/controlador_identidad_qr.dart),
  líneas 53–54 y 151–159.
- [ControladorValidacionIngresos](seguridad_verificador/lib/controladores/controlador_validacion_ingresos.dart),
  líneas 93–97 y 117–125.

Los controladores limpian sus datos cuando cambia la sesión, pero después de
esperar una respuesta no comprueban si esa solicitud pertenece todavía a la
sesión actual.

Reproducción confirmada en el portador: se inició una consulta para el usuario
10, se cerró sesión, se autenticó al usuario 11 y después se completó la
respuesta anterior. El controlador conservó la identidad del usuario 10 con
el usuario 11 autenticado. La prueba que exigía descartar esa identidad falló.

Reproducción confirmada en seguridad: una consulta de historial iniciada antes
del cierre devolvió datos después de limpiar la sesión. El historial volvió
a contener los registros del operador desconectado.

Es un problema de aislamiento y privacidad del estado local. No demuestra que
el backend permita consultar una identidad ajena.

Criterio de cierre: invalidar solicitudes al cambiar o cerrar sesión; impedir
que respuestas antiguas modifiquen identidad, QR, decisiones e historial;
probar cierre, cambio de usuario y respuestas fuera de orden.

### A3 — Media: dos renovaciones simultáneas borran una sesión válida

Evidencia:
[ControladorSesion.obtenerTokenAcceso](paquetes/cliente_api_upt/lib/sesion/controlador_sesion.dart),
líneas 126–154. No se comparte una única renovación pendiente entre llamadas.

Reproducción confirmada: dos solicitudes detectan que el acceso necesita
renovación y usan el mismo token. La primera recibe la sesión rotada. La
segunda recibe `TOKEN_RENOVACION_INVALIDO`, de acuerdo con el contrato de
rotación del backend, y ejecuta `_descartarSesion()`, borrando el resultado
válido de la primera. La prueba terminó con `estaAutenticada == false`.

Criterio de cierre: coordinar una sola renovación por sesión y asegurar que
las respuestas de renovaciones anteriores no borren ni restauren una sesión
nueva. Probar solicitudes simultáneas y renovación durante el cierre.

### A4 — Media: el login queda debajo de las pantallas protegidas

Evidencias:
[AplicacionEstudiante](seguridad_estudiante/lib/aplicacion/aplicacion_estudiante.dart),
líneas 29–35, y
[AplicacionSeguridad](seguridad_verificador/lib/aplicacion/aplicacion_seguridad.dart),
líneas 29–35.

El cambio de autenticación reconstruye `home`, pero las rutas abiertas con
`Navigator.pushNamed` continúan encima. Se reprodujo con la pantalla QR del
portador y con el historial de seguridad: tras terminar la sesión, el login
no quedó visible y la pantalla protegida permaneció abierta. Con los datos
limpiados puede permanecer un indicador de carga.

Esto afecta también el recorrido de recuperación cuando una renovación
inválida descarta la sesión desde una pantalla secundaria. No representa una
omisión de la autorización que aplica el backend.

Criterio de cierre: al perder autenticación, retirar las rutas protegidas y
mostrar el login; probar QR, identidad, escáner e historial.

### A5 — Media: pruebas del portador dependientes de una fecha fija

Evidencia:
[crearSesionPortador](seguridad_estudiante/test/ayudas/dobles_hito_10.dart),
líneas 109–115. La sesión de prueba se crea con fecha fija
`2026-09-12T15:00:00Z`, acceso hasta el día 13 y renovación hasta el día 19.
El controlador de sesión la compara con `DateTime.now()`.

Aunque la cuenta regresiva del QR permite un reloj inyectado, el reloj de
sesión no se sustituye en estas pruebas. Por inspección, a partir del
`2026-09-19T15:00:00Z` esas sesiones ficticias se consideran vencidas. No se
alteró el reloj del equipo para esta auditoría.

Criterio de cierre: usar un reloj de prueba consistente o sesiones generadas
relativas al tiempo de ejecución, y comprobar que las pruebas no caducan por
el calendario.

### A6 — Brecha de verificación: contrato simulado no equivale a integración

Evidencias:
[cliente_api_contrato_test.dart](paquetes/cliente_api_upt/test/cliente_api_contrato_test.dart),
línea 20, y [verificar_proyecto.sh](scripts/verificar_proyecto.sh).

Las pruebas móviles de contrato usan `MockClient` con respuestas escritas a
mano. Son útiles para comprobar serialización y modelos, pero no ejecutan el
backend con el cliente Dart. El script ejecuta por separado las pruebas
backend y Flutter; no hay una suite `integration_test` registrada.

Los tests backend sí ejercitan Express y MariaDB, incluido el recorrido de
emisión y validación. Lo que falta es unirlos al cliente móvil y a sus relojes,
sesiones y estados de pantalla. La discrepancia A1 muestra la consecuencia
concreta de esa separación.

Criterio de cierre: ejecutar cliente móvil → API → MariaDB y el retorno, con
caducidad real, renovación, revocación, repetición de QR e historial; añadir
aceptación en dispositivos para cámara, GPS, permisos y fallos de red.

## Alcance institucional aún pendiente

La arquitectura, en especial sus apartados 5–12, 65 y 72, contempla funciones
que no quedan completadas por los doce hitos locales:

- Autenticación de cuenta institucional y comprobación del dominio u
  organización mediante una identidad validada por el proveedor.
- Adaptador de intranet y comparación de nombres como parte del alta y la
  verificación.
- Panel administrativo básico; actualmente existen las API administrativas.
- Flujo de registro/control de dispositivos; actualmente existe el esquema,
  pero no hay rutas ni implementación que asocie dispositivos al inicio de
  sesión.

La autenticación provisional y su sustitución pendiente se reconocen en
[autenticacion_temporal.md](api-backend-entrada-upt/docs/autenticacion_temporal.md).
El campo `identidad_verificada` puede establecerlo un administrador según
[usuarios.esquemas.js](api-backend-entrada-upt/src/modulos/usuarios/validacion/usuarios.esquemas.js),
y no procede de las dos verificaciones institucionales.

Además, siguen pendientes los valores oficiales de acceso, URL HTTPS,
identificadores de aplicación, distribución y firmas. Ambas configuraciones
Android de `release` todavía usan la clave de depuración:
[estudiante](seguridad_estudiante/android/app/build.gradle.kts), línea 37, y
[verificador](seguridad_verificador/android/app/build.gradle.kts), línea 37.
Se conserva `com.example.*` como identificador.

## Evidencia inicial ejecutada en la auditoría

| Comprobación | Resultado |
| --- | --- |
| Árbol Git al inicio | Limpio; referencia `20de217`. |
| Registro de migraciones | Ocho archivos aplicados, del 001 al 008. |
| Pruebas backend | 61 aprobadas, 0 fallos. |
| Pruebas cliente compartido | 14 aprobadas. |
| Pruebas portador | 7 aprobadas. |
| Pruebas verificador | 13 aprobadas. |
| Análisis estático | Sin observaciones en los tres módulos Flutter. |
| Consulta de coherencia horaria | Desfase confirmado de 18 000 segundos. |
| Pruebas adicionales de auditoría | Cinco expectativas fallidas que reproducen A2, A3 y A4; tres en portador y dos en verificador. |

El comando base ejecutado fue `./scripts/verificar_proyecto.sh`. Las cinco
pruebas adicionales se ejecutaron fuera del árbol de trabajo, usando los
controladores y widgets del proyecto con dobles de red y almacenamiento:

```bash
cd seguridad_estudiante
flutter test --no-pub --reporter expanded \
  /tmp/auditoria-hitos-upt.74JbUC/estudiante_auditoria_test.dart
```

```bash
cd seguridad_verificador
flutter test --no-pub --reporter expanded \
  /tmp/auditoria-hitos-upt.74JbUC/verificador_auditoria_test.dart
```

Estos archivos temporales conservan las reproducciones para la siguiente
corrección, pero su ubicación no es un mecanismo de archivo permanente.

No se repitieron las compilaciones Android ya verificadas para el mismo
commit; en esta auditoría se revisaron sus configuraciones. No se realizaron
pruebas físicas de cámara/GPS ni compilación o ejecución iOS. Tampoco se
validaron instalación desde cero, carga operativa o infraestructura
institucional. Las ocho migraciones registradas no prueban por sí solas una
instalación limpia.

## Orden de cierre recomendado

1. Corregir A1 y añadir una prueba de fechas a través de la conexión real.
2. Corregir aislamiento, renovación y navegación de sesión, A2–A4.
3. Estabilizar las pruebas, A5, y añadir integración real, A6.
4. Validar los recorridos completos en dispositivos.
5. Completar las funciones e instalación institucionales pendientes.

En el momento de la auditoría inicial, el único archivo añadido fue este
informe y todavía no se habían aplicado correcciones al producto.

## Evidencia de cierre del Hito 13

El comando `./scripts/verificar_proyecto.sh` se ejecutó después de aplicar las
correcciones y produjo:

| Comprobación final | Resultado |
| --- | --- |
| Backend sobre MariaDB | 65 aprobadas, 0 fallos. |
| Cliente Dart compartido | 20 aprobadas, 0 fallos. |
| Aplicación portador | 11 aprobadas, 0 fallos. |
| Aplicación verificador | 17 aprobadas, 0 fallos. |
| Análisis estático Flutter | Sin observaciones en los tres paquetes. |
| Flujo HTTP integral | 30/30 endpoints publicados verificados. |
| Cliente móvil real contra backend | 1 flujo completo aprobado sobre HTTP y MariaDB reales. |

La integración comprobó explícitamente que la duración serializada de un QR
coincide con la configuración y con el reloj del cliente, que la rotación
invalida el token anterior, que el primer escaneo se autoriza, que el reuso se
deniega y que los historiales administrativo y móvil reflejan ambos eventos.
El arnés restaura la configuración modificada y elimina sus datos ficticios en
un bloque de limpieza aun cuando una aserción falla.

Los contratos completos están en [ENDPOINTS_API_UPT.md](ENDPOINTS_API_UPT.md)
y el cierre se describe en
[HITO_13_CORRECCIONES_AUDITORIA.md](HITO_13_CORRECCIONES_AUDITORIA.md).
