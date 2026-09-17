# Aplicación de identidad digital

Aplicación Flutter destinada a estudiantes, docentes y trabajadores de la UPT.
El registro y cada nuevo inicio de sesión usan el mismo flujo dual: intranet
UPT y Google Workspace. No presenta acceso mediante correo/código y contraseña
local. Incluye restauración segura de la sesión, consulta
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

La URL se inyecta con `URL_API_UPT`. El valor predeterminado es
`https://api-moviles.fottuto.men/api`; en Linux se ejecuta con
`flutter run -d linux`. Después de verificar la intranet, pulsa
**Continuar con Google institucional** y completa el acceso en el navegador.
La aplicación consulta a la API y adopta la sesión cuando termina Google.

Las credenciales OAuth se configuran en la API de Dokploy, con el callback
`https://api-moviles.fottuto.men/api/registro-estudiante/google/callback`,
incluso si la aplicación se ejecuta en Linux. Consulta
[la configuración de Google](../CONFIGURACION_GOOGLE_OAUTH.md#dokploy-y-aplicación-de-estudiante).

Para una API local, ejecuta
`flutter run -d linux --dart-define=URL_API_UPT=http://127.0.0.1:3000/api`.
Para llamadas sin OAuth un emulador Android también puede usar
`http://10.0.2.2:3000/api`.

Para el registro Google local en Android se recomienda `adb reverse tcp:3000
tcp:3000` y conservar `http://127.0.0.1:3000/api`; de ese modo el navegador del
dispositivo también puede devolver el callback a Express. En Linux,
`url_launcher` abre el navegador predeterminado. La app nunca contiene el
client secret de Google.

Una compilación de producción con HTTP o una URL inválida muestra un error de
configuración antes de restaurar la sesión.

Las dependencias están fijadas en `pubspec.lock`. La verificación local se
ejecuta con `flutter analyze`, `flutter test` y `flutter build apk --debug`.

## Funciones del dispositivo en Linux

La ubicación usa `geolocator_linux` y el servicio GeoClue del sistema. En
distribuciones Debian/Ubuntu, instala y activa GeoClue antes de iniciar Flutter:

```bash
sudo apt install geoclue-2.0
```

La aplicación mostrará un mensaje claro si no se puede obtener una ubicación.
Android e iOS conservan sus permisos nativos declarados en
`android/app/src/main/AndroidManifest.xml` e `ios/Runner/Info.plist`.

GeoClue entrega una ubicación real y el backend la rechazará cuando el equipo
esté fuera de un punto configurado. Para comprobar visualmente el QR desde
cualquier lugar se incluye un modo simulado, exclusivamente Linux debug:

```bash
../scripts/ejecutar_estudiante_linux_qr.sh
```

Este modo coincide con `PRUEBA-LOCAL` después de ejecutar migraciones y
`npm run sembrar:pruebas`. La pantalla lo identifica de forma visible. No puede
activarse en Android ni en una compilación release.
