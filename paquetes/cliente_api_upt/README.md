# Cliente API UPT

Paquete Flutter compartido por las aplicaciones de usuario y seguridad.
Contiene los modelos del contrato HTTP, el cliente de la API, almacenamiento
seguro de la sesión y el controlador que renueva o descarta tokens.

Ambas aplicaciones usan por defecto la API desplegada:

```text
https://api-moviles.fottuto.men/api
```

Para conectar a otra API, la URL se puede sobrescribir en compilación. Por
ejemplo, para un backend local desde un emulador Android:

```text
--dart-define=URL_API_UPT=http://10.0.2.2:3000/api
```

Para un backend local desde Linux, usa `http://127.0.0.1:3000/api`.
Un dispositivo físico debe usar una dirección alcanzable del equipo local o
un túnel ADB. En producción se exige HTTPS.

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
