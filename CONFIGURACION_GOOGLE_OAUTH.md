# Configuración de Google OAuth

Para instrucciones campo por campo dentro de Google Cloud Console, consulta
[GUIA_CREAR_CREDENCIALES_GOOGLE_OAUTH.md](GUIA_CREAR_CREDENCIALES_GOOGLE_OAUTH.md).

## Arquitectura usada

Express implementa OpenID Connect con el flujo de código para aplicación web,
PKCE, `state` y `nonce`. Flutter abre el navegador externo y consulta el
resultado; no contiene ni recibe el client secret ni tokens de Google. El
backend sólo solicita `openid`, `email` y `profile`, valida el ID token, usa
`sub` como identificador permanente y toma de Google correo, nombres,
apellidos y foto. La intranet se conserva como la segunda evidencia para
comparar código y nombre.

Además de exigir un correo terminado exactamente en `@virtual.upt.pe`, se
requieren `email_verified=true` y `hd=virtual.upt.pe`. El parámetro `hd` enviado
a Google es sólo una sugerencia visual; la autorización real ocurre al validar
el claim firmado devuelto por Google.

## Preparación en Google Cloud

1. Usa un proyecto Google Cloud perteneciente o autorizado por la UPT.
2. En **Google Auth Platform**, configura la pantalla de consentimiento. Elige
   audiencia **Internal** si el proyecto pertenece a la organización Workspace
   de la UPT. Si sólo puedes usar **External**, añade las cuentas de prueba y
   completa los requisitos de publicación antes de producción.
3. Crea un cliente OAuth de tipo **Web application**.
4. Agrega como redirect URI autorizado, con coincidencia exacta:
   `http://127.0.0.1:3000/api/registro-estudiante/google/callback`.
5. Para el despliegue de Dokploy agrega también
   `https://api-moviles.fottuto.men/api/registro-estudiante/google/callback`.
   Google exige página principal, privacidad y condiciones para una aplicación
   publicada.

No es necesario crear un cliente Android ni configurar SHA-1 para este flujo,
porque Google siempre retorna al endpoint web de Express.
Tampoco se necesita Google People API: nombre, apellidos, correo y foto salen
de los claims OpenID solicitados con `profile` y `email`. El servidor sí debe
tener salida HTTPS hacia los endpoints de autorización, token y claves de
Google, y Linux debe disponer de un navegador predeterminado.

## Variables del backend

Copia `.env.example` a `.env` y completa únicamente en el servidor:

```dotenv
GOOGLE_OAUTH_CLIENT_ID=000000.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=secreto_entregado_por_google
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:3000/api/registro-estudiante/google/callback
GOOGLE_WORKSPACE_DOMAIN=virtual.upt.pe
```

El URI debe coincidir carácter por carácter con Google Cloud. No confirmes
`.env`, JSON de credenciales ni secretos en Git.

## Dokploy y aplicación de estudiante

En **Environment** de la aplicación API, agrega estas cuatro variables sin
borrar las de MySQL:

```dotenv
GOOGLE_OAUTH_CLIENT_ID=PEGA_EL_CLIENT_ID_DE_LA_IMAGEN
GOOGLE_OAUTH_CLIENT_SECRET=PEGA_EL_SECRETO_COMPLETO_DEL_MISMO_CLIENTE
GOOGLE_OAUTH_REDIRECT_URI=https://api-moviles.fottuto.men/api/registro-estudiante/google/callback
GOOGLE_WORKSPACE_DOMAIN=virtual.upt.pe
```

El archivo privado `api-backend-entrada-upt/.env.dokploy` contiene los valores
preparados a partir de las credenciales locales. Está ignorado por Git y Docker:
se deben copiar al editor **Environment** de Dokploy. Guarda y vuelve a
desplegar la API para que el proceso reciba las variables nuevas.

El cliente **Aplicación web** sirve para este flujo. Los **Orígenes autorizados
de JavaScript** permanecen vacíos. Mantén los dos callbacks autorizados, local
y HTTPS, con la ruta completa `/api/registro-estudiante/google/callback` y
sin una barra final. `****4bJ0` es una máscara, no el secreto que debe usarse.
El nombre «Desarrollo local» es una etiqueta y no cambia el funcionamiento.

Si la audiencia es **External / Testing**, añade el correo institucional del
estudiante en **Test users**. Esa configuración no se puede confirmar a partir
de la pantalla del cliente OAuth.

La aplicación ya usa la API HTTPS y abre Google mediante `url_launcher` en
el navegador externo. Tras verificar la intranet, pulsa **Continuar con
Google institucional**, elige la cuenta `@virtual.upt.pe` de la misma persona
y vuelve a la aplicación al terminar. No se configura un callback local ni
un secreto de Google dentro de Flutter para usar la API de Dokploy.

## Ejecución local

```bash
cd api-backend-entrada-upt
npm ci
npm run migrar
npm run dev

# En otra terminal
cd seguridad_estudiante
flutter pub get --enforce-lockfile
flutter run -d Linux --dart-define=URL_API_UPT=http://127.0.0.1:3000/api
```

Para Android conectado por ADB, ejecuta antes `adb reverse tcp:3000 tcp:3000`
y sobrescribe la URL con `--dart-define=URL_API_UPT=http://127.0.0.1:3000/api`.
Ambas aplicaciones usan por defecto `https://api-moviles.fottuto.men/api`;
para ese despliegue configura el callback HTTPS equivalente en el backend y Google.

Referencias oficiales: [OAuth para servidores web](https://developers.google.com/identity/protocols/oauth2/web-server), [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) y [referencia de claims](https://developers.google.com/identity/openid-connect/reference).
