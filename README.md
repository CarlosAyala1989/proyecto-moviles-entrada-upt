# Identidad Digital y Control de Acceso UPT

Sistema local compuesto por una API y dos aplicaciones Flutter:

- `api-backend-entrada-upt`: autoridad de autenticación, identidad,
  credenciales temporales, validación, historial y administración operativa;
- `seguridad_estudiante`: identidad digital y generación de QR para
  estudiantes, docentes y trabajadores;
- `seguridad_verificador`: escaneo, decisión de ingreso e historial para
  personal con rol `SEGURIDAD`;
- `paquetes/cliente_api_upt`: contrato HTTP, modelos y sesión segura
  compartidos por ambas aplicaciones.

Las aplicaciones nunca se conectan directamente a MariaDB ni deciden un
ingreso. Toda autorización se resuelve y registra en el backend.

## Configuración local

El backend requiere Node.js 20 o posterior, MariaDB, Chrome o Chromium y
Tesseract (`eng`). El navegador se usa para reproducir el acceso real de la
intranet y mantener la sesión que genera el CAPTCHA. Las variables se describen
en [`api-backend-entrada-upt/.env.example`](api-backend-entrada-upt/.env.example).
Las aplicaciones requieren el SDK estable de Flutter compatible con Dart 3.10.
El registro de estudiantes requiere además un cliente OAuth web de Google; la
preparación exacta está en
[CONFIGURACION_GOOGLE_OAUTH.md](CONFIGURACION_GOOGLE_OAUTH.md).
La creación de las credenciales y cada campo de Google Cloud están explicados
en [GUIA_CREAR_CREDENCIALES_GOOGLE_OAUTH.md](GUIA_CREAR_CREDENCIALES_GOOGLE_OAUTH.md).

Preparar y ejecutar la API:

```bash
cd api-backend-entrada-upt
npm install
npm run migrar
npm run sembrar:pruebas
npm run dev
```

Al ejecutar Flutter en Linux, ambas aplicaciones usan de forma predeterminada
`http://127.0.0.1:3000/api`, que coincide con el puerto de la API. Con la API
ya iniciada en otra terminal, basta con:

```bash
cd seguridad_estudiante
flutter run -d Linux
```

Ese comando usa la ubicación real de GeoClue y, por diseño, no genera el QR si
el equipo está fuera de la geocerca. Para probar la representación y rotación
del QR en Linux desde cualquier lugar, usa la ubicación simulada de desarrollo:

```bash
./scripts/ejecutar_estudiante_linux_qr.sh
```

La simulación se muestra en pantalla y sólo existe en Linux debug; Android y
las compilaciones release siempre consultan la ubicación real.

El verificador local necesita además el código del punto de acceso:

```bash
cd seguridad_verificador
flutter run -d Linux --dart-define=PUNTO_ACCESO_CODIGO=PUERTA-PRINCIPAL
```

Para probar en Linux el flujo completo con la misma puerta y ubicación
simuladas que usa el estudiante, abre otra terminal y ejecuta:

```bash
./scripts/ejecutar_verificador_linux_qr.sh
```

La aplicación avisa cuando está usando datos de ubicación de prueba. Este modo
no puede activarse en Android ni en una compilación de entrega.

Para probar en Android el registro Google contra la API local, conecta el
dispositivo o emulador con ADB y crea el túnel inverso. Así la app y el callback
OAuth usan el mismo `127.0.0.1:3000` registrado en Google:

```bash
adb reverse tcp:3000 tcp:3000
cd seguridad_estudiante
flutter run
```

El verificador, que no recibe el callback OAuth, también puede usar `10.0.2.2`
en un emulador y necesita el código de la puerta asignada:

```bash
cd seguridad_verificador
flutter run \
  --dart-define=URL_API_UPT=http://10.0.2.2:3000/api \
  --dart-define=PUNTO_ACCESO_CODIGO=PUERTA-PRINCIPAL
```

Las aplicaciones compiladas para producción detienen su inicio de forma
visible, antes de restaurar una sesión o conectarse, si la URL no usa HTTPS o
si el verificador conserva el punto ficticio `PRUEBA-LOCAL`.

## Verificación unificada

Ejecutar backend, análisis estático, todas las pruebas Flutter y el recorrido
real de los 30 endpoints que no dependen de los proveedores externos, mediante
Express, MariaDB y el cliente Dart:

```bash
./scripts/verificar_proyecto.sh
```

Incluir la compilación de ambos APK de depuración:

```bash
./scripts/verificar_proyecto.sh --construir-apk
```

El script exige los archivos `pubspec.lock` existentes y no actualiza
dependencias silenciosamente.

## Hitos

- [Hito 13: correcciones de auditoría y flujo integral](HITO_13_CORRECCIONES_AUDITORIA.md)
- [Hito 9: base Flutter](HITO_9_BASE_APLICACIONES_FLUTTER.md)
- [Hito 10: identidad y QR del portador](HITO_10_IDENTIDAD_Y_QR_ESTUDIANTE.md)
- [Hito 11: validación e historial](HITO_11_VALIDACION_E_HISTORIAL_SEGURIDAD.md)
- [Hito 12: preparación operativa](HITO_12_PREPARACION_OPERATIVA.md)

Los hitos 1 a 8 del backend están documentados dentro de
`api-backend-entrada-upt/docs` y en las ramas correspondientes del repositorio.

El contrato consolidado de entrada y salida está en
[ENDPOINTS_API_UPT.md](ENDPOINTS_API_UPT.md).
La secuencia de preparación, operación y cierre está en
[FLUJO_OPERATIVO_COMPLETO.md](FLUJO_OPERATIVO_COMPLETO.md).

## Límites de la etapa local

Las cuentas, coordenadas, radios y códigos incluidos son ficticios. Antes de
una puesta en campo se requieren valores institucionales, HTTPS, firma móvil,
identificadores de paquete definitivos y pruebas en dispositivos Android e iOS
reales.
