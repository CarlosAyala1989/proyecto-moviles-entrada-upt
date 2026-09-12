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

El backend requiere Node.js 20 o posterior, MariaDB y las variables descritas
en [`api-backend-entrada-upt/.env.example`](api-backend-entrada-upt/.env.example).
Las aplicaciones requieren el SDK estable de Flutter compatible con Dart 3.10.

Preparar y ejecutar la API:

```bash
cd api-backend-entrada-upt
npm install
npm run migrar
npm run sembrar:pruebas
npm run dev
```

La URL móvil predeterminada, `http://10.0.2.2:3000/api`, corresponde al equipo
anfitrión visto desde un emulador Android. Un dispositivo físico necesita una
dirección alcanzable en la red local:

```bash
cd seguridad_estudiante
flutter run --dart-define=URL_API_UPT=http://DIRECCION_LOCAL:3000/api
```

El verificador necesita además el código de la puerta asignada:

```bash
cd seguridad_verificador
flutter run \
  --dart-define=URL_API_UPT=http://DIRECCION_LOCAL:3000/api \
  --dart-define=PUNTO_ACCESO_CODIGO=PUERTA-PRINCIPAL
```

Las aplicaciones compiladas para producción detienen su inicio de forma
visible, antes de restaurar una sesión o conectarse, si la URL no usa HTTPS o
si el verificador conserva el punto ficticio `PRUEBA-LOCAL`.

## Verificación unificada

Ejecutar backend, análisis estático y todas las pruebas Flutter:

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

- [Hito 9: base Flutter](HITO_9_BASE_APLICACIONES_FLUTTER.md)
- [Hito 10: identidad y QR del portador](HITO_10_IDENTIDAD_Y_QR_ESTUDIANTE.md)
- [Hito 11: validación e historial](HITO_11_VALIDACION_E_HISTORIAL_SEGURIDAD.md)
- [Hito 12: preparación operativa](HITO_12_PREPARACION_OPERATIVA.md)

Los hitos 1 a 8 del backend están documentados dentro de
`api-backend-entrada-upt/docs` y en las ramas correspondientes del repositorio.

## Límites de la etapa local

Las cuentas, coordenadas, radios y códigos incluidos son ficticios. Antes de
una puesta en campo se requieren valores institucionales, HTTPS, firma móvil,
identificadores de paquete definitivos y pruebas en dispositivos Android e iOS
reales.
