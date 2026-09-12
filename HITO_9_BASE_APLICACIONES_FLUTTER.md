# Hito 9: base de las aplicaciones Flutter

## Alcance completado

Se prepararon las dos aplicaciones existentes sin iniciarlas:

- `seguridad_estudiante`: aplicación de identidad para estudiantes, docentes y
  trabajadores.
- `seguridad_verificador`: aplicación de validación para personal con rol
  `SEGURIDAD`.
- `paquetes/cliente_api_upt`: paquete local compartido para evitar duplicar el
  contrato HTTP y el manejo de sesión.

El paquete compartido contiene:

- modelos de sesión, identidad digital, código QR, validación e historial;
- cliente HTTP con tiempo máximo de espera y errores normalizados;
- inicio, renovación, consulta y cierre de sesión;
- consumo de identidad, generación de QR, validación e historial reciente;
- almacenamiento de tokens mediante el almacén seguro del sistema operativo;
- revalidación de la sesión y de los roles al restaurarla;
- configuración de la URL mediante `URL_API_UPT`.

Cada aplicación tiene tema, navegación, manejo de carga y error, pantalla de
inicio de sesión y una pantalla inicial acorde con sus roles. Las pantallas de
los flujos posteriores son marcadores explícitos, no implementaciones
simuladas.

## Configuración local

La URL predeterminada es:

```text
http://10.0.2.2:3000/api
```

Corresponde al equipo anfitrión visto desde Android. Para otro entorno se debe
inyectar una URL alcanzable en compilación:

```text
--dart-define=URL_API_UPT=http://DIRECCION_LOCAL:3000/api
```

El tráfico HTTP sin cifrar sólo está permitido en la configuración Android de
depuración. Producción debe utilizar HTTPS. Los identificadores de paquete,
la firma y las direcciones institucionales definitivas permanecen pendientes
porque todavía no han sido proporcionados por la UPT.

Android usa nivel mínimo 23 y deshabilita las copias de seguridad de la
aplicación. iOS declara los grupos de acceso de Keychain requeridos para el
almacenamiento protegido de la sesión.

## Verificación permitida

No se ejecutaron comandos de Flutter o Dart, aplicaciones, emuladores,
simuladores, cámara ni interfaces gráficas. Tampoco se resolvieron las nuevas
dependencias; por ello los archivos `pubspec.lock` existentes se actualizarán
en una etapa futura autorizada.

El backend se puede comprobar independientemente mediante HTTP:

```bash
curl http://127.0.0.1:3000/api/salud
```

Respuesta esperada: estado HTTP `200` con servicio y base de datos saludables.
Las pruebas detalladas de autenticación, identidad, QR, validación e historial
están en `api-backend-entrada-upt/docs`.

## Pendiente

- Hito 10: flujo completo de identidad y QR en la aplicación del usuario.
- Hito 11: escaneo, validación e historial en la aplicación de seguridad.
- Resolución de dependencias, análisis estático y pruebas Flutter cuando se
  autorice la etapa móvil.
- Pruebas visuales, de red local y en dispositivos reales.
