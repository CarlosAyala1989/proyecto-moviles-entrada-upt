# Guía para obtener y configurar la clave de Google Maps

La aplicación administrativa actual registra puertas mediante **Usar mi
ubicación actual**, sin Google Maps ni clave API. Consulta la
[guía de registro por GPS](GUIA_REGISTRAR_PUERTA_GPS.md).

Esta guía corresponde al selector de mapas de versiones anteriores. Su ruta
**Maps Static API** permanece en el backend para compatibilidad. En esas
versiones Flutter solicita el mapa a la API UPT autenticada y la API consulta
a Google. La clave no se incluye en el APK ni en la aplicación de escritorio.

La credencial necesaria es una **API key de Google Maps Platform**. No es el
cliente OAuth usado para registrar estudiantes.

## 1. Seleccionar o crear el proyecto

1. Abre [Google Cloud Console](https://console.cloud.google.com/).
2. En el selector superior, elige el proyecto que utilizará la aplicación.
3. Si no existe, pulsa **Nuevo proyecto**, escribe un nombre y créalo.

Conviene usar un proyecto institucional separado para poder controlar
facturación, cuotas y permisos.

## 2. Vincular facturación

Google Maps Platform necesita una cuenta de facturación activa, incluso cuando
el consumo queda dentro de los créditos o límites aplicables.

1. Abre [Facturación de Google Cloud](https://console.cloud.google.com/billing).
2. Selecciona una cuenta de facturación o crea una nueva.
3. Vincúlala al proyecto elegido.

## 3. Habilitar Maps Static API

1. Abre la [biblioteca de Maps Static API](https://console.cloud.google.com/apis/library/static-maps-backend.googleapis.com).
2. Confirma que aparece el proyecto correcto en la barra superior.
3. Pulsa **Habilitar**.

Esta integración no necesita Maps SDK for Android, Maps SDK for iOS ni Maps
JavaScript API.

## 4. Crear la API key

1. Abre [Google Maps Platform → Credenciales](https://console.cloud.google.com/google/maps-apis/credentials).
2. Pulsa **Crear credenciales**.
3. Selecciona **Clave de API**.
4. Copia la clave generada y guárdala temporalmente en un gestor de secretos.
5. Pulsa **Editar clave** antes de utilizarla.

## 5. Restringir la clave

En la pantalla de edición configura:

### Restricciones de API

1. Selecciona **Restringir clave**.
2. Marca únicamente **Maps Static API**.
3. Guarda los cambios.

### Restricción de aplicación

Las solicitudes salen desde el contenedor de la API en Dokploy. Si el servidor
tiene una IP pública de salida fija:

1. Selecciona **Direcciones IP**.
2. Añade la IP pública de salida del servidor Dokploy.
3. Guarda los cambios.

Para consultar esa IP desde el servidor o contenedor puedes ejecutar:

```bash
curl -fsS https://ifconfig.me
```

No uses una IP de la base de datos ni una IP interna de Docker sin comprobar
que sea realmente la dirección pública desde la que la API accede a Google.
Si la salida cambia dinámicamente, conserva como mínimo la restricción a
**Maps Static API**, configura cuotas y prepara una IP de salida estable.

## 6. Configurar Dokploy

1. Abre el servicio de la API en Dokploy.
2. Entra en **Environment**.
3. Añade esta variable sin comillas ni espacios adicionales:

```dotenv
GOOGLE_MAPS_API_KEY=PEGA_AQUI_LA_CLAVE
```

4. Guarda la configuración.
5. Vuelve a desplegar la API.

La variable corresponde a `api-backend-entrada-upt`. No debe añadirse como
`dart-define`, en la base de datos ni en las aplicaciones Flutter.

## 7. Configuración local

Para probar con la API local, añade la misma variable al archivo privado
`api-backend-entrada-upt/.env`:

```dotenv
GOOGLE_MAPS_API_KEY=PEGA_AQUI_LA_CLAVE
```

El archivo `.env` está excluido de Git. Nunca copies una clave real a
`.env.example`, a este documento o a un commit.

## 8. Verificar la integración

1. Inicia sesión como administrador en `seguridad_verificador`.
2. Pulsa **Agregar puerta**.
3. Comprueba que aparece el mapa de Google.
4. Toca otro punto y verifica que el marcador se mueve.
5. Usa `+` y `-` para cambiar el acercamiento.
6. Guarda la puerta y vuelve a abrirla para comprobar la ubicación.

También puedes verificar la ruta con un token de administrador:

```bash
curl --fail \
  --header "Authorization: Bearer TOKEN_DE_ADMINISTRADOR" \
  --output /tmp/mapa-puerta.png \
  "https://api-moviles.fottuto.men/api/administracion/mapas/google/estatico?latitud=-18.0060535&longitud=-70.2266368&zoom=18&ancho=600&alto=340"
```

La respuesta correcta es una imagen PNG. La ruta no entrega la clave de Google
y rechaza usuarios que no tengan el rol `ADMINISTRADOR`.

## Errores habituales

| Código | Causa habitual | Corrección |
| --- | --- | --- |
| `GOOGLE_MAPS_NO_CONFIGURADO` | Falta `GOOGLE_MAPS_API_KEY` en la API. | Añade la variable y redespliega. |
| `GOOGLE_MAPS_RESPUESTA_INVALIDA` | Clave incorrecta, API deshabilitada, restricción equivocada o facturación inactiva. | Revisa los pasos 2, 3 y 5. |
| `GOOGLE_MAPS_NO_DISPONIBLE` | Dokploy no pudo comunicarse con Google. | Revisa red, DNS y salida HTTPS del contenedor. |
| `AUTENTICACION_REQUERIDA` | La solicitud no lleva una sesión válida. | Inicia sesión nuevamente como administrador. |
| `ROL_NO_AUTORIZADO` | La cuenta no es administradora. | Usa una cuenta con rol `ADMINISTRADOR`. |

## Control de consumo

Maps Static API se factura por carga. Configura presupuestos, alertas y cuotas
en Google Cloud para limitar consumos inesperados. Usa una clave independiente
y no habilites APIs que esta aplicación no utiliza.

## Documentación oficial

- [Configurar Maps Static API](https://developers.google.com/maps/documentation/maps-static/get-api-key)
- [Primeros pasos y parámetros](https://developers.google.com/maps/documentation/maps-static/start)
- [Seguridad de claves de Google Maps Platform](https://developers.google.com/maps/api-security-best-practices)
- [Uso y facturación de Maps Static API](https://developers.google.com/maps/documentation/maps-static/usage-and-billing)
