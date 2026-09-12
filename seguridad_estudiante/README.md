# Aplicación de identidad digital

Aplicación Flutter destinada a estudiantes, docentes y trabajadores de la UPT.
La base del Hito 9 incluye inicio de sesión temporal, restauración segura de la
sesión, navegación y pantallas preparadas para identidad digital y código QR.

## Estructura

- `lib/aplicacion`: configuración principal de la aplicación.
- `lib/navegacion`: nombres de rutas.
- `lib/pantallas`: inicio de sesión, inicio y estados de preparación.
- `lib/tema`: tema visual base.
- `../paquetes/cliente_api_upt`: modelos, cliente HTTP y manejo compartido de
  sesión.

La identidad y la visualización del QR se implementarán en el Hito 10. La
aplicación no decide autorizaciones de ingreso; esa decisión siempre pertenece
al backend.

## Configuración del backend

La URL se inyecta con `URL_API_UPT`. El valor de desarrollo predeterminado es
`http://10.0.2.2:3000/api`, el alias del equipo anfitrión en Android. Para un
dispositivo físico se deberá usar una dirección local alcanzable y, en un
entorno real, HTTPS.

No se resolvieron dependencias ni se ejecutó Flutter durante el Hito 9. Los
archivos de bloqueo se actualizarán cuando se autoricen las pruebas móviles.
