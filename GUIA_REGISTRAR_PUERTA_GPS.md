# Registrar una puerta con la ubicación del teléfono

El administrador obtiene las coordenadas en la propia aplicación de control
de acceso. Este flujo utiliza el servicio de ubicación del dispositivo y
no requiere Google Maps, una API key ni facturación de Google Maps Platform.

## Crear una puerta

1. Instala la versión actualizada de `seguridad_verificador` en el teléfono.
2. Activa la ubicación del sistema y colócate en el centro del punto de acceso.
3. Inicia sesión como administrador y pulsa **Agregar puerta**.
4. Completa el código y el nombre.
5. Pulsa **Usar mi ubicación actual**.
6. Permite el acceso a la ubicación mientras usas la app. En Android, elige
   ubicación precisa si el sistema permite escogerla.
7. Comprueba las coordenadas y la precisión que aparecen en pantalla.
8. Define el **Radio permitido (metros)** y pulsa **Guardar**.

El radio no se modifica automáticamente: define el perímetro operativo de
esa puerta. Para una captura cuya precisión sea de 10 metros, el formulario
exige un radio superior a 10 metros. La comprobación del guardia seguirá
teniendo en cuenta también la precisión que reporte su propio teléfono.

## Editar o asignar

Al editar una puerta puedes conservar sus coordenadas y modificar nombre,
radio o estado. Para reemplazar el punto, colócate en la ubicación nueva y
pulsa **Usar mi ubicación actual** antes de guardar.

Al registrar o editar un guardia, selecciona esa puerta en **Puerta asignada**.
El formulario muestra las coordenadas y el radio del punto elegido. No
solicita el GPS para asignar un guardia ni para abrir el panel administrativo.

## Lecturas y permisos

- El permiso se solicita al pulsar el botón, no al iniciar sesión.
- La app obtiene una posición actual de alta precisión, con un límite de
  espera de 12 segundos.
- Rechaza coordenadas no válidas, lecturas de hace más de 30 segundos o
  adelantadas más de 10 segundos respecto del reloj del dispositivo.
- Rechaza lecturas con precisión peor que 50 metros. Se debe mejorar la
  señal y repetir la captura.
- El radio debe ser mayor que la precisión de la nueva lectura.
- **Guardar** queda deshabilitado mientras se obtiene la posición.
- Una nueva puerta no puede guardarse hasta capturar un punto válido.

Si el GPS está apagado, actívalo. Si se deniega el permiso, la app explica
que es necesario y permite reintentar. Cuando está bloqueado permanentemente,
debe habilitarse desde los ajustes del teléfono.

Si no se obtiene una posición o su precisión es insuficiente, utiliza
ubicación precisa y busca mejor señal cerca de la puerta. El punto no se
reemplaza por una coordenada de ejemplo ni por la de otra puerta.

Si falla una nueva captura al editar, el punto guardado se conserva y el
error aparece en el formulario. Una lectura válida muestra su precisión
como referencia, no como una garantía de exactitud.

## Conexión y despliegue

La captura utiliza el servicio de ubicación del sistema. Obtener GPS no
requiere una API key, aunque la disponibilidad y la precisión dependen del
dispositivo y sus servicios. Iniciar sesión y guardar la puerta en la API
sí requieren internet.

No se necesita una migración nueva ni un despliegue de backend para este flujo:
las rutas existentes ya aceptan `latitud`, `longitud` y
`radio_permitido_metros`. Flutter usa `POST` para crear y `PATCH` para editar
en `/api/administracion/puntos-acceso`, con el token del administrador.
La API conserva validación de rangos, autorización y persistencia SQL.

Para activar el cambio en el teléfono es necesario instalar el APK actualizado.
El APK conecta por defecto a `https://api-moviles.fottuto.men/api`.
La clave `GOOGLE_MAPS_API_KEY` no es necesaria para la app actual.
Las rutas de mapas permanecen disponibles para versiones anteriores.

Android ya declara los permisos de ubicación aproximada y precisa. iOS
incluye la descripción de ubicación mientras se usa la app. macOS incluye
la descripción y las autorizaciones de ubicación y conexiones salientes.
En Linux se utiliza GeoClue, tal como se explica en el README del verificador.
La captura administrativa usa por defecto el proveedor real del dispositivo,
también cuando el guardia utiliza el modo simulado de desarrollo.

## Verificación práctica en el teléfono

1. Rechaza inicialmente el permiso y comprueba que aparece un mensaje de ayuda.
2. Habilita ubicación precisa, vuelve a pulsar el botón y comprueba la lectura.
3. Guarda la puerta y pulsa **Actualizar** en el panel para confirmar sus datos.
4. Edita esa puerta y comprueba que se conserva el punto al cambiar sólo el nombre.
5. Asigna un guardia y comprueba su ubicación operativa junto a la puerta.

Las pruebas automatizadas cubren solicitudes de permiso, GPS apagado,
permiso bloqueado, tiempo de espera, lecturas inválidas, precisión,
creación/edición, cancelación y ausencia de solicitudes a Google Maps.
La lectura y la calidad de señal del teléfono deben comprobarse en el lugar.
