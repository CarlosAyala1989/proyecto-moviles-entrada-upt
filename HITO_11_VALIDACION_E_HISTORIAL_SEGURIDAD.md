# Hito 11: validación e historial de seguridad

## Alcance completado

La aplicación `seguridad_verificador` completa el flujo del personal con rol
`SEGURIDAD`:

- captura exclusivamente códigos QR mediante la cámara trasera;
- detiene la captura al detectar una credencial para evitar solicitudes
  duplicadas;
- obtiene una lectura reciente de ubicación después del escaneo;
- envía credencial, ubicación y punto configurado a
  `POST /api/ingresos/validar`;
- presenta por separado decisiones `AUTORIZADO`, decisiones `DENEGADO` y
  errores de solicitud o infraestructura;
- muestra la identidad mínima para comparación visual solamente cuando el
  backend autoriza el ingreso;
- falla de forma segura si una respuesta autorizada no incluye identidad;
- permite escanear otra credencial sin conservar el valor anterior;
- consulta hasta los últimos 50 intentos del operador mediante
  `GET /api/ingresos/recientes`;
- permite actualizar el historial y distingue autorizaciones de denegaciones.

El contenido QR no se interpreta, registra ni persiste en Flutter. Una
denegación tampoco presenta identidad, aun si una respuesta inesperada la
incluyera.

## Cámara y ubicación

Se incorporó `mobile_scanner` limitado al formato QR. El visor maneja pausa y
reanudación con el ciclo de vida de la aplicación, enfoque al tocar, linterna,
cambio de cámara cuando existe más de una y errores de permiso o dispositivo.
Se conserva el modelo de reconocimiento incluido en la aplicación para no
depender de una descarga en el primer control de acceso.

Se incorporó `geolocator` con alta precisión y un tiempo máximo de espera de 12
segundos. Android declara cámara, ubicación aproximada y ubicación precisa;
iOS declara cámara y ubicación durante el uso. No se solicitan cámara ni
ubicación en segundo plano.

Las coordenadas siguen siendo datos declarados por el dispositivo. El backend
comprueba antigüedad, precisión, geocerca, estado del punto y coincidencia con
la credencial; esto no reemplaza la comparación visual del personal.

## Configuración del punto

El backend no expone el catálogo administrativo de puntos al rol `SEGURIDAD`.
Por ello cada instalación recibe su asignación en compilación:

```text
--dart-define=PUNTO_ACCESO_CODIGO=PUERTA-PRINCIPAL
```

El valor predeterminado `PRUEBA-LOCAL` es exclusivamente local. La aplicación
normaliza el código y rechaza una configuración vacía o inválida antes de
solicitar ubicación. El backend vuelve a validar que el punto exista, esté
activo, coincida con la credencial y contenga la ubicación reportada.

## Historial y privacidad

La pantalla de historial consume la ruta limitada al operador autenticado. Los
registros autorizados presentan nombre y código institucional; los denegados
presentan solamente resultado, motivo, punto y momento. Flutter no recibe el
QR original ni su huella en esta consulta.

## Verificación ejecutada

- análisis estático sin observaciones en `cliente_api_upt`,
  `seguridad_estudiante` y `seguridad_verificador`;
- 6 pruebas aprobadas en el cliente compartido;
- 7 pruebas aprobadas en la aplicación del portador;
- 10 pruebas aprobadas en la aplicación verificadora;
- 61 pruebas aprobadas en el backend;
- compilación Android de depuración completada en
  `seguridad_verificador/build/app/outputs/flutter-apk/app-debug.apk`.

Las pruebas del Hito 11 cubren normalización del punto, envío de ubicación,
autorización, denegación sin identidad, respuesta autorizada incompleta,
errores de ubicación, configuración inválida, historial y presentación de
resultados. La compilación Android verifica la integración de cámara, GPS y el
reconocedor QR. No se ejecutó una compilación iOS porque el entorno actual no
es macOS.

## Pendiente para puesta en campo

- Confirmar códigos, coordenadas, radios y asignaciones oficiales de los puntos
  de acceso de la UPT.
- Sustituir identificadores de paquete y configurar firmas de producción.
- Configurar HTTPS y una dirección institucional accesible desde dispositivos.
- Probar permisos, cámara, linterna, GPS, red local, legibilidad del QR y carga
  operativa en dispositivos Android e iOS reales.
