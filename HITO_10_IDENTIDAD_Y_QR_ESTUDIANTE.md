# Hito 10: identidad y código QR del portador

## Alcance completado

La aplicación `seguridad_estudiante` completa el recorrido del usuario con rol
`ESTUDIANTE`, `DOCENTE` o `TRABAJADOR`:

- consulta la identidad digital de la sesión autenticada;
- presenta fotografía con reemplazo seguro, nombre, código, correo, roles,
  estados de verificación y acceso, y el perfil académico cuando existe;
- permite actualizar el perfil y reintentar errores del backend;
- impide iniciar el flujo QR cuando el backend informa que la identidad no
  cumple sus requisitos;
- obtiene una lectura reciente de ubicación solamente después de una acción
  explícita del usuario;
- genera la imagen QR usando exclusivamente la credencial opaca recibida del
  backend;
- muestra el punto de acceso y una cuenta regresiva basada en `expira_en`;
- oculta la credencial al vencer y permite solicitar una nueva;
- permite anular anticipadamente una credencial vigente mediante
  `DELETE /api/codigos-qr/actual`.

El estado de identidad y credencial se elimina cuando cambia o termina la
sesión. La aplicación no interpreta el contenido de la credencial, no decide
si el ingreso está autorizado y no conserva el código QR en almacenamiento
persistente.

## Ubicación y permisos

Se incorporó `geolocator` para obtener una posición de alta precisión con un
tiempo máximo de espera de 12 segundos. Android declara ubicación aproximada y
precisa; iOS declara ubicación durante el uso. No se solicita acceso en segundo
plano.

La aplicación diferencia ubicación desactivada, permiso denegado, permiso
bloqueado y tiempo de espera agotado. Aun con permiso, el backend vuelve a
validar antigüedad, precisión, distancia y disponibilidad del punto de acceso.

## Representación QR

Se incorporó `qr_flutter` para representar el valor de `codigo_qr`. El tamaño
se adapta al ancho disponible y se mantiene fondo blanco y contraste alto para
favorecer el escaneo. Al llegar la cuenta regresiva a cero, el widget deja de
recibir y mostrar la credencial.

Generar una credencial nueva sigue revocando la anterior en el backend. La
anulación manual pide confirmación y conserva en pantalla el código todavía
vigente cuando la solicitud de revocación falla.

## Compatibilidad y dependencias

Se resolvieron y fijaron las dependencias Flutter pendientes del Hito 9. La
versión disponible de Flutter elevó automáticamente el mínimo de Android a API
24. Los límites de memoria y paralelismo de Gradle se ajustaron para permitir
compilaciones reproducibles en el entorno de desarrollo.

También se corrigió el sufijo de los archivos de prueba heredados: ahora usan
`_test.dart`, que es el patrón reconocido por `flutter test`.

## Verificación ejecutada

- análisis estático sin observaciones en `cliente_api_upt`,
  `seguridad_estudiante` y `seguridad_verificador`;
- 6 pruebas aprobadas en el cliente compartido;
- 7 pruebas aprobadas en la aplicación del portador;
- 1 prueba aprobada en la aplicación verificadora;
- 61 pruebas aprobadas en el backend;
- compilación Android de depuración completada en
  `seguridad_estudiante/build/app/outputs/flutter-apk/app-debug.apk`.

Las pruebas cubren consulta de identidad, elegibilidad, envío de ubicación,
generación, cuenta regresiva, anulación, errores de ubicación, representación
del perfil y renderizado QR. No se ejecutó una compilación iOS porque el entorno
actual no es macOS.

## Pendiente

- Hito 11: escaneo, validación e historial en `seguridad_verificador`.
- Pruebas de permisos, GPS, red local y cámara en dispositivos reales.
- Identificadores de paquete, firma, fotografías y direcciones institucionales
  definitivas cuando sean proporcionados por la UPT.
