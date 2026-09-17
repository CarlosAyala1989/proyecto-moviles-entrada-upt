# Guía para crear las credenciales de Google OAuth

Esta guía explica cómo configurar Google Cloud para el registro de estudiantes
de la aplicación UPT y cómo obtener los valores que debe llevar
`api-backend-entrada-upt/.env`.

## 1. Requisito institucional

Lo recomendable es realizar el proceso con una cuenta administradora de la UPT
y crear el proyecto dentro de la organización Google Workspace que gestiona
`virtual.upt.pe`. Esto permite seleccionar audiencia **Internal** y limita la
pantalla de autorización a miembros de la organización.

Si no aparece la opción **Internal**, el proyecto no pertenece a esa
organización. Se puede desarrollar con audiencia **External** y cuentas de
prueba, pero el backend seguirá rechazando cualquier cuenta cuyo claim firmado
`hd` no sea `virtual.upt.pe`.

## 2. Crear o seleccionar el proyecto

1. Entra a [Google Cloud Console](https://console.cloud.google.com/).
2. Abre el selector de proyectos de la barra superior.
3. Selecciona **New project / Proyecto nuevo**.
4. Completa:
   - **Project name:** `Entrada UPT`.
   - **Organization:** la organización de la UPT, si está disponible.
   - **Location:** la carpeta institucional indicada por el administrador.
5. Pulsa **Create** y asegúrate de dejar seleccionado ese proyecto.

El nombre del proyecto no se copia al `.env`; sólo sirve para organizar la
configuración en Google Cloud.

## 3. Configurar Google Auth Platform

En el menú abre **Google Auth Platform**. Si aparece **Get started**, completa
el registro inicial de la aplicación.

### Branding

Escribe los siguientes valores:

| Campo de Google | Valor recomendado |
| --- | --- |
| App name | `Identidad Digital UPT` |
| User support email | Correo institucional del responsable del proyecto |
| App logo | Opcional durante desarrollo; logo oficial autorizado en producción |
| Developer contact information | Correo institucional del equipo responsable |

Para una publicación externa Google puede solicitar además:

- **Application home page:** página pública oficial de la aplicación.
- **Privacy policy:** URL pública de la política de privacidad.
- **Terms of service:** URL pública de los términos de uso.
- **Authorized domains:** dominio raíz controlado por la institución; no se
  añade `http://`, rutas ni subdominios.

`virtual.upt.pe` sólo debe declararse como dominio autorizado si la institución
controla y ha verificado ese dominio. Para el callback local `127.0.0.1` no se
agrega un dominio autorizado.

### Audience

Selecciona una opción:

- **Internal — recomendado:** úsalo si el proyecto pertenece a la organización
  Google Workspace de la UPT.
- **External:** úsalo sólo cuando Internal no esté disponible. Mientras el
  estado sea **Testing**, agrega en **Test users** cada correo
  `@virtual.upt.pe` que utilizarás para las pruebas.

Aunque se seleccione External, el código de Express sólo autoriza el dominio
Workspace `virtual.upt.pe`.

### Data Access / Scopes

Pulsa **Add or remove scopes** y conserva únicamente:

| Scope | Uso |
| --- | --- |
| `openid` | Recibir una identidad OpenID verificable |
| `https://www.googleapis.com/auth/userinfo.email` | Obtener correo y estado de verificación |
| `https://www.googleapis.com/auth/userinfo.profile` | Obtener nombres, apellidos y foto |

No habilites Gmail, Drive, Calendar ni People API. La implementación sólo usa
los claims del ID token.

## 4. Crear el cliente OAuth

1. Abre **Google Auth Platform → Clients**.
2. Pulsa **Create client**.
3. En **Application type**, selecciona **Web application**. No selecciones
   Android ni Desktop app.
4. Completa los campos:

| Campo de Google | Valor exacto |
| --- | --- |
| Name | `API Entrada UPT - Desarrollo local` |
| Authorized JavaScript origins | Déjalo vacío |
| Authorized redirect URIs | `http://127.0.0.1:3000/api/registro-estudiante/google/callback` |

5. Pulsa **Create**.
6. Copia inmediatamente **Client ID** y **Client secret** o descarga el JSON y
   guárdalo fuera del repositorio. Google puede mostrar el secreto únicamente
   al crear el cliente.

El redirect URI debe ser idéntico, incluyendo `http`, `127.0.0.1`, puerto
`3000`, ruta y ausencia de `/` final. `localhost` y `127.0.0.1` no son
intercambiables para esta comprobación.

## 5. Completar el archivo `.env`

Dentro de `api-backend-entrada-upt`, crea `.env` tomando `.env.example` como
referencia. No pegues enlaces Markdown: los valores deben ser texto simple.

```dotenv
GOOGLE_OAUTH_CLIENT_ID=PEGA_AQUI_EL_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET=PEGA_AQUI_EL_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:3000/api/registro-estudiante/google/callback
GOOGLE_WORKSPACE_DOMAIN=virtual.upt.pe
```

Correspondencia exacta:

- `GOOGLE_OAUTH_CLIENT_ID`: valor **Client ID** generado por Google. Suele
  terminar en `.apps.googleusercontent.com`.
- `GOOGLE_OAUTH_CLIENT_SECRET`: valor **Client secret** del mismo cliente.
- `GOOGLE_OAUTH_REDIRECT_URI`: el mismo valor agregado en **Authorized redirect
  URIs**. No lo obtiene automáticamente Google.
- `GOOGLE_WORKSPACE_DOMAIN`: política institucional del proyecto. Debe quedar
  como `virtual.upt.pe`, sin `@`, protocolo ni ruta.

No uses literalmente `000000.apps.googleusercontent.com` ni
`secreto_entregado_por_google`; son marcadores de ejemplo.

## 6. Ejecutar y comprobar en Linux

```bash
cd /VMQEMU/proyecto-moviles-entrada-upt/api-backend-entrada-upt
npm ci
npm run migrar
npm run dev
```

En otra terminal:

```bash
cd /VMQEMU/proyecto-moviles-entrada-upt/seguridad_estudiante
flutter pub get --enforce-lockfile
flutter run -d Linux
```

En la aplicación:

1. Resuelve la verificación de intranet.
2. Pulsa **Continuar con Google institucional**.
3. Selecciona una cuenta real `@virtual.upt.pe`.
4. Google debe volver al callback y mostrar que se puede cerrar la pestaña.
5. Flutter debe detectar el resultado y abrir la sesión del estudiante.

## 7. Probar en Android contra la API local

Conecta el dispositivo o emulador mediante ADB y ejecuta:

```bash
adb reverse tcp:3000 tcp:3000
cd /VMQEMU/proyecto-moviles-entrada-upt/seguridad_estudiante
flutter run
```

Así Flutter y el navegador Android pueden alcanzar `127.0.0.1:3000`. No uses
`10.0.2.2` para este callback si Google Cloud fue configurado con
`127.0.0.1`.

## 8. Configuración de producción

Crea preferentemente otro cliente OAuth para producción y registra un callback
HTTPS, por ejemplo:

```text
https://api.dominio-institucional.pe/api/registro-estudiante/google/callback
```

Luego cambia en el servidor:

```dotenv
GOOGLE_OAUTH_REDIRECT_URI=https://api.dominio-institucional.pe/api/registro-estudiante/google/callback
```

También ejecuta Flutter con
`--dart-define=URL_API_UPT=https://api.dominio-institucional.pe/api`. El dominio
debe pertenecer a la institución, estar verificado y coincidir con la
configuración de Branding.

## 9. Errores frecuentes

| Error | Causa habitual | Solución |
| --- | --- | --- |
| `redirect_uri_mismatch` | El URI de `.env` no coincide exactamente | Copia el URI de Clients sin modificarlo y reinicia Node |
| `GOOGLE_OAUTH_NO_CONFIGURADO` | Falta Client ID, secret o redirect URI | Completa `.env` y reinicia `npm run dev` |
| `GOOGLE_DOMINIO_NO_AUTORIZADO` | La cuenta no pertenece al Workspace UPT | Usa una cuenta cuyo `hd` sea `virtual.upt.pe` |
| `access_denied` | El usuario canceló o el administrador bloqueó la app | Reintenta o pide autorización al administrador Workspace |
| `org_internal` | Cuenta y organización del proyecto no coinciden | Usa una cuenta de la organización propietaria del proyecto |
| La app queda esperando | El navegador no alcanza el callback local | Comprueba Node, puerto 3000 y `adb reverse` en Android |

## 10. Seguridad

- Nunca pongas el Client secret en Flutter.
- Nunca confirmes `.env` ni el JSON descargado en Git.
- No envíes capturas donde aparezca el Client secret.
- Si el secreto se filtra, crea o rota el secreto en Google Cloud y actualiza
  inmediatamente `.env`.
- Usa HTTPS y un gestor de secretos al desplegar la API.

Referencias oficiales: [gestión de clientes OAuth](https://support.google.com/cloud/answer/15549257), [audiencia Internal/External](https://support.google.com/cloud/answer/15549945), [Branding y dominios autorizados](https://support.google.com/cloud/answer/15549049) y [OAuth para aplicaciones de servidor web](https://developers.google.com/identity/protocols/oauth2/web-server).
