# Cliente API UPT

Paquete Flutter compartido por las aplicaciones de usuario y seguridad.
Contiene los modelos del contrato HTTP, el cliente de la API, almacenamiento
seguro de la sesión y el controlador que renueva o descarta tokens.

La URL se configura en compilación:

```text
--dart-define=URL_API_UPT=http://10.0.2.2:3000/api
```

El valor predeterminado corresponde al alias del anfitrión usado por un
emulador Android. Un dispositivo físico debe usar la dirección alcanzable del
equipo local. En producción se exige HTTPS.

Antes de restaurar una sesión, ambas aplicaciones validan que la URL sea
absoluta, termine en `/api` y no incluya credenciales, consulta ni fragmento.
Las compilaciones de producción rechazan HTTP y muestran un error local sin
intentar conexión.

Las dependencias quedaron resueltas en el Hito 10. El contrato compartido
incluye consulta de identidad, generación y anulación de credenciales QR,
validación de ingresos e historial reciente. Sus pruebas se ejecutan con:

```bash
flutter test
```
