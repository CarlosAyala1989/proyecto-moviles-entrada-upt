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
`http://127.0.0.1:3000/api`, por lo que en Linux, con la API iniciada en el
puerto 3000, se ejecuta directamente con `flutter run -d Linux`. Un emulador
Android debe sobrescribirla con `http://10.0.2.2:3000/api`; para un dispositivo
físico se deberá usar una dirección local alcanzable y, en un entorno real,
HTTPS.

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

## Funciones del dispositivo en Linux

La ubicación usa `geolocator_linux` y GeoClue. Instala el servicio en
distribuciones Debian/Ubuntu:

```bash
sudo apt install geoclue-2.0
```

El escáner Linux abre la cámara mediante `zbarcam`; instala su proveedor antes
de usar la pantalla de escaneo:

```bash
sudo apt install zbar-tools
```

El usuario debe tener acceso al dispositivo de vídeo (habitualmente el grupo
`video`) y haber habilitado ubicación en el sistema. En Android, la cámara y
la ubicación se solicitan con los permisos declarados en
`android/app/src/main/AndroidManifest.xml`; iOS usa los textos de permiso de
`ios/Runner/Info.plist`.

Para probar en Linux el emisor y el verificador desde fuera de la universidad,
inicia este verificador con:

```bash
../scripts/ejecutar_verificador_linux_qr.sh
```

La pantalla avisa claramente que la ubicación es simulada. Este modo sólo se
activa en Linux debug; Android y las versiones de entrega siempre usan la
ubicación real del dispositivo.
