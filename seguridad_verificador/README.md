# Aplicación de control de acceso

Aplicación Flutter destinada al personal de seguridad de la UPT. Incluye inicio
de sesión restringido al rol `SEGURIDAD`, escaneo de códigos QR, validación con
ubicación y consulta del historial reciente del operador.

## Estructura

- `lib/aplicacion`: configuración principal de la aplicación.
- `lib/configuracion`: punto de acceso asignado a la instalación.
- `lib/controladores`: estado de validación e historial.
- `lib/navegacion`: nombres de rutas.
- `lib/pantallas`: inicio de sesión, escáner, resultado e historial.
- `lib/servicios`: lectura controlada de ubicación.
- `lib/tema`: tema visual base.
- `lib/widgets`: visor de cámara especializado en códigos QR.
- `../paquetes/cliente_api_upt`: modelos, cliente HTTP y manejo compartido de
  sesión.

La aplicación sólo envía el código, el punto configurado y la ubicación
declarada. No interpreta la credencial ni conserva su contenido. El backend es
la única autoridad que permite o deniega un ingreso.

## Configuración del backend

La URL se inyecta con `URL_API_UPT`. El valor de desarrollo predeterminado es
`http://10.0.2.2:3000/api`, el alias del equipo anfitrión en Android. Para un
dispositivo físico se deberá usar una dirección local alcanzable y, en un
entorno real, HTTPS.

El código del punto de acceso se fija en compilación. `PRUEBA-LOCAL` sirve
únicamente para el entorno local:

```text
--dart-define=PUNTO_ACCESO_CODIGO=PUERTA-PRINCIPAL
```

Las compilaciones de producción rechazan HTTP y también el punto ficticio
`PRUEBA-LOCAL` antes de restaurar la sesión.

Una ejecución local completa puede combinar ambas opciones:

```bash
flutter run \
  --dart-define=URL_API_UPT=http://DIRECCION_LOCAL:3000/api \
  --dart-define=PUNTO_ACCESO_CODIGO=PUERTA-PRINCIPAL
```

La aplicación solicita cámara y ubicación solamente durante el uso. La
verificación local se ejecuta con `flutter analyze`, `flutter test` y
`flutter build apk --debug`.
