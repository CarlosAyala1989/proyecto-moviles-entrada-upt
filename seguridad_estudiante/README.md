# Aplicación de identidad digital

Aplicación Flutter destinada a estudiantes, docentes y trabajadores de la UPT.
Incluye inicio de sesión temporal, restauración segura de la sesión, consulta
de identidad digital y generación de códigos QR temporales con ubicación.

## Estructura

- `lib/aplicacion`: configuración principal de la aplicación.
- `lib/controladores`: estado de identidad, credencial y cuenta regresiva.
- `lib/navegacion`: nombres de rutas.
- `lib/pantallas`: inicio de sesión, perfil institucional y credencial QR.
- `lib/servicios`: acceso controlado a la ubicación del dispositivo.
- `lib/tema`: tema visual base.
- `../paquetes/cliente_api_upt`: modelos, cliente HTTP y manejo compartido de
  sesión.

La aplicación representa únicamente la credencial opaca emitida, la oculta al
vencer y permite anularla. No decide autorizaciones de ingreso; esa decisión
siempre pertenece al backend.

## Configuración del backend

La URL se inyecta con `URL_API_UPT`. El valor de desarrollo predeterminado es
`http://10.0.2.2:3000/api`, el alias del equipo anfitrión en Android. Para un
dispositivo físico se deberá usar una dirección local alcanzable y, en un
entorno real, HTTPS.

Una compilación de producción con HTTP o una URL inválida muestra un error de
configuración antes de restaurar la sesión.

Las dependencias están fijadas en `pubspec.lock`. La verificación local se
ejecuta con `flutter analyze`, `flutter test` y `flutter build apk --debug`.
