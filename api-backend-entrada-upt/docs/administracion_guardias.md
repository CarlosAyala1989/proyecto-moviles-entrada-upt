# Administrador, puertas y guardias

El administrador y los guardias entran en la aplicación `seguridad_verificador`
con usuario y contraseña. El administrador ve **Administración UPT** y no
necesita GPS ni estar en una puerta. Los estudiantes conservan su aplicación
separada y el acceso mediante intranet y Google.

## Activación en Dokploy

1. Publica el código y `migraciones/011_asignaciones_seguridad.sql`. El arranque
   aplicará la migración automáticamente, conservando usuarios y puertas.
2. En **Environment** de la API, conserva DB y Google y agrega las cinco
   variables `ADMIN_INICIAL_*` preparadas en el archivo privado `.env.dokploy`.
   El usuario preparado es `ADMIN-UPT`; la contraseña está en el archivo privado
   `credenciales_administrador_dokploy.txt`. Estos archivos no se suben a Git.
3. Guarda y despliega. Si no existe un usuario con rol ADMINISTRADOR, el
   arranque crea el primero con contraseña bcrypt y registra auditoría.
   Si existe uno, lo conserva, incluyendo sus credenciales; no se crea otro
   ni se restablecen contraseñas en posteriores despliegues. La creación se
   serializa mediante un bloqueo por base de datos y no tiene endpoint público.
4. Instala una compilación actualizada del verificador. Ya no requiere
   `PUNTO_ACCESO_CODIGO`: las asignaciones provienen de la API.
5. Inicia sesión con el administrador en la aplicación del verificador.

El administrador inicial se configura con:

```dotenv
ADMIN_INICIAL_CODIGO=ADMIN-UPT
ADMIN_INICIAL_CORREO=admin@administracion.example.invalid
ADMIN_INICIAL_NOMBRES=Administrador
ADMIN_INICIAL_APELLIDOS=UPT
ADMIN_INICIAL_CONTRASENA=COPIA_LA_CONTRASENA_DEL_ARCHIVO_PRIVADO
```

No uses el marcador de contraseña literalmente. Las variables son opcionales;
cuando se utiliza este procedimiento se requieren las cinco completas. Si se
retiran después de la primera creación, la cuenta sigue en la base de datos.

## Configurar una puerta

Pulsa **Agregar puerta** y completa código, nombre, latitud, longitud y radio
permitido en metros. Los códigos son únicos, por ejemplo `PUERTA-PRINCIPAL`.
El radio define un perímetro circular. También puedes editar o desactivar las
puertas existentes, conservando el historial.

**Abrir Google Maps** abre el mapa externo. Marca el lugar, copia sus coordenadas
decimales y pégalas en el formulario; pulsa **Usar coordenadas copiadas**.
En computadora, haz clic derecho sobre el punto y copia la primera línea.
También se admiten enlaces de Maps con un `query`/`q` de coordenadas o un pin
`!3d...!4d...`. Un enlace corto no contiene las coordenadas, y `@lat,lon`
representa el centro de la cámara: no se utiliza como ubicación de la puerta.
No hace falta una clave de Google Maps para abrir estos enlaces.

## Registrar y asignar guardias

Pulsa **Agregar guardia** y completa nombres, apellidos, usuario, contraseña
robusta y puerta activa. La contraseña debe tener al menos 14 caracteres,
mayúscula, minúscula, número y símbolo. El usuario se normaliza a mayúsculas y
puede contener letras, números, punto, guion y guion bajo. No necesita una
cuenta Google: la cuenta de seguridad utiliza una credencial local. El correo
interno de nuevas cuentas es un marcador `.invalid`, no una dirección de contacto.

Se guardan usuario, rol SEGURIDAD y asignación en una sola transacción. Al editar
un guardia puedes cambiar nombres, usuario, puerta, estado y contraseña;
deja la contraseña vacía para conservarla. Cambiar un guardia revoca sus
sesiones existentes y requiere que vuelva a iniciar sesión. Este formulario no
permite convertir administradores u otros usuarios en guardias.

Los guardias existentes, como `SEGURIDAD-01`, aparecen en la lista aunque
no tengan asignación. Edítalos y selecciona una puerta real; no se inventan
coordenadas ni se les asigna automáticamente una puerta ficticia.

## Restricción de ubicación

Después del acceso o de restaurar una sesión, el guardia debe activar el GPS
para comprobar la ubicación. Si no tiene puerta, está fuera del radio, la puerta
está inactiva, el GPS no está disponible o falla la conexión, ve la pantalla
**La aplicación necesita ayuda**, con opciones para comprobar nuevamente o
cerrar sesión. El escáner y el historial se mantienen bloqueados.

Se vuelve a comprobar cada 30 segundos y al regresar a la aplicación. El
backend exige una ubicación reciente también en cada escaneo y consulta de
historial; comprobar una vez no entrega un permiso permanente. Sólo acepta
el código de puerta asignado al usuario y verifica radio y precisión:
`distancia al centro + precisión GPS <= radio permitido`. Ajusta un radio
razonable para el lugar y la precisión real del dispositivo.

La ubicación debe cumplir los límites de antigüedad, desfase futuro y precisión
configurados en el backend. La validación usa el GPS reportado por el dispositivo;
no aporta una certificación física contra modificaciones del dispositivo.
El código QR del estudiante sigue sometido a sus validaciones y a la coincidencia
con la puerta, independientemente de la autorización del guardia.

## Endpoints

Todos requieren token de la API:

| Rol | Método y ruta | Uso |
| --- | --- | --- |
| ADMINISTRADOR | GET /api/administracion/guardias | Consultar guardias y asignación |
| ADMINISTRADOR | POST /api/administracion/guardias | Crear guardia y asignarlo |
| ADMINISTRADOR | PUT /api/administracion/guardias/:id | Editar/reasignar/desactivar guardia |
| ADMINISTRADOR | GET/POST/PATCH /api/administracion/puntos-acceso | Gestionar puertas |
| SEGURIDAD | POST /api/seguridad/comprobar-ubicacion | Comprobar habilitación y obtener puerta asignada |
| SEGURIDAD | POST /api/ingresos/validar | Escanear con ubicación y puerta asignada |
| SEGURIDAD | GET /api/ingresos/recientes | Historial con latitud, longitud, precision_metros y obtenida_en como parámetros |

Creación de guardia:

```json
{
  "usuario": "GUARDIA-01",
  "nombres": "Juan Pedro",
  "apellidos": "Pérez Torres",
  "contrasena": "REEMPLAZAR_POR_UNA_CONTRASENA_ROBUSTA",
  "punto_acceso_id": 1,
  "activo": true
}
```

Los clientes anteriores deben actualizarse: un historial sin ubicación es
rechazado, y un guardia sin asignación no puede escanear. Para desarrollo,
`npm run sembrar:pruebas` asigna únicamente al guardia ficticio `PRUEBA-SEG-001`
a `PRUEBA-LOCAL`; nunca se ejecuta en producción.

Referencias: [coordenadas en Google Maps](https://support.google.com/maps/answer/18539?co=GENIE.Platform%3DDesktop&hl=es)
y [enlaces de Maps](https://developers.google.com/maps/documentation/urls/get-started).
