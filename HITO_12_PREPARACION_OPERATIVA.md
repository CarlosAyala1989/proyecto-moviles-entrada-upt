# Hito 12: preparación operativa

## Alcance completado

El repositorio incorpora una puerta de configuración y una verificación
integral para preparar la transición desde el entorno local hacia una
instalación institucional:

- valida `URL_API_UPT` antes de restaurar una sesión o realizar una conexión;
- admite HTTP únicamente en compilaciones que no sean de producción;
- exige una URL absoluta HTTP/HTTPS cuyo camino termine en `/api` y rechaza
  credenciales, consultas y fragmentos embebidos;
- valida `PUNTO_ACCESO_CODIGO` en la aplicación verificadora;
- impide usar el punto ficticio `PRUEBA-LOCAL` en producción;
- presenta una pantalla de error común, explícita y sin reintentos cuando la
  configuración no es segura;
- verifica mediante pruebas el contrato HTTP que comparten las aplicaciones y
  el backend;
- ofrece un único comando reproducible para revisar todo el repositorio.

Estas comprobaciones son una defensa previa en el cliente. El backend continúa
siendo la autoridad que autentica, valida puntos y geocercas, decide el ingreso
y registra la trazabilidad.

## Configuración por entorno

El desarrollo local conserva los valores predeterminados para el emulador
Android. Una instalación real debe inyectar valores institucionales durante la
compilación:

```bash
flutter build apk --release \
  --dart-define=URL_API_UPT=https://ACCESO_INSTITUCIONAL/api
```

El verificador necesita además el punto asignado:

```bash
flutter build apk --release \
  --dart-define=URL_API_UPT=https://ACCESO_INSTITUCIONAL/api \
  --dart-define=PUNTO_ACCESO_CODIGO=PUERTA-PRINCIPAL
```

Los ejemplos expresan el contrato de configuración; no constituyen una URL,
una asignación de puerta ni una firma oficiales.

## Contrato móvil verificado

El cliente compartido prueba las operaciones críticas con un servidor HTTP
simulado, sin depender de infraestructura externa:

- consulta autenticada y decodificación de la identidad digital;
- generación de credencial con ubicación y fecha normalizada a UTC;
- validación con QR, punto y ubicación, incluida la identidad autorizada;
- consulta del historial reciente con límite y ausencia de identidad en una
  denegación.

También se prueban las reglas de URL, punto de acceso y la pantalla que evita
una conexión cuando la configuración es inválida.

## Verificación unificada

El comando siguiente ejecuta las pruebas del backend, respeta los archivos de
bloqueo, analiza y prueba los tres módulos Flutter:

```bash
./scripts/verificar_proyecto.sh
```

La variante usada para cerrar este hito también compila ambas APK Android de
depuración:

```bash
./scripts/verificar_proyecto.sh --construir-apk
```

Resultado del cierre:

- 61 pruebas aprobadas en el backend;
- 14 pruebas aprobadas en `cliente_api_upt`;
- 7 pruebas aprobadas en `seguridad_estudiante`;
- 13 pruebas aprobadas en `seguridad_verificador`;
- análisis estático sin observaciones en los tres módulos Flutter;
- APK de depuración de ambas aplicaciones compiladas correctamente.

## Pendiente para puesta en campo

- Recibir la URL HTTPS, los puntos, coordenadas, radios y asignaciones
  oficiales de la UPT.
- Definir identificadores definitivos de aplicación y configurar firmas y
  custodia de claves de producción.
- Ejecutar pruebas de extremo a extremo con backend y MariaDB institucionales.
- Probar permisos, cámara, QR, GPS, red y concurrencia en dispositivos Android
  e iOS reales; una compilación iOS requiere un entorno macOS.
- Establecer el proceso institucional de distribución, monitoreo, rotación de
  secretos y respuesta operativa.

El producto funcional local queda cerrado en este hito. La siguiente etapa
depende de datos, infraestructura y dispositivos institucionales; no se han
inventado esos valores ni se ha presentado una APK de depuración como entrega
de producción.
