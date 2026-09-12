# Aplicación de control de acceso

Aplicación Flutter destinada al personal de seguridad de la UPT. La base del
Hito 9 incluye inicio de sesión restringido al rol `SEGURIDAD`, restauración
segura de sesión, navegación y pantallas preparadas para el escáner y el
historial reciente.

## Estructura

- `lib/aplicacion`: configuración principal de la aplicación.
- `lib/navegacion`: nombres de rutas.
- `lib/pantallas`: inicio de sesión, inicio y estados de preparación.
- `lib/tema`: tema visual base.
- `../paquetes/cliente_api_upt`: modelos, cliente HTTP y manejo compartido de
  sesión.

El escaneo y la presentación de la respuesta se implementarán en el Hito 11.
La aplicación sólo enviará el código y la ubicación declarada; el backend es
la única autoridad que permite o deniega un ingreso.

## Configuración del backend

La URL se inyecta con `URL_API_UPT`. El valor de desarrollo predeterminado es
`http://10.0.2.2:3000/api`, el alias del equipo anfitrión en Android. Para un
dispositivo físico se deberá usar una dirección local alcanzable y, en un
entorno real, HTTPS.

Las dependencias base quedaron resueltas y las pruebas preparadas en el Hito 9
ya son descubribles por `flutter test`. Las dependencias de cámara y ubicación
del flujo verificador se incorporarán en el Hito 11.
