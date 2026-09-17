# Hito 13 — Correcciones de auditoría y flujo integral

Fecha de cierre: 12 de septiembre de 2026.

## Objetivo

Cerrar los hallazgos técnicos A1–A6 de la auditoría de los hitos 1 a 12, sin
implementar la autenticación institucional que fue excluida expresamente de
este alcance, y convertir el flujo completo en una verificación reproducible.

## Correcciones realizadas

- La conexión MariaDB usa el offset de Lima (`timezone: -05:00`) y el proceso
  fija `TZ=America/Lima`. Se verifican el instante, el viaje
  `Date ↔ DATETIME` y el día operativo.
- Los controladores móviles asocian cada operación asíncrona a una revisión de
  autenticación. Una respuesta tardía no puede restaurar identidad, QR,
  validación ni historial de una sesión anterior.
- Las solicitudes simultáneas de renovación comparten una sola operación. Un
  resultado antiguo tampoco puede borrar o restaurar una sesión nueva.
- El `Navigator` se reinicia cuando cambia la revisión de autenticación, por lo
  que cerrar o perder la sesión elimina todas las rutas protegidas de la pila.
- El reloj del controlador de sesión es inyectable y los datos de prueba usan
  fechas relativas a su ejecución.
- Se añadió una integración real `ClienteApi → HTTP → Express → MariaDB`, junto
  con un recorrido backend que prueba las 30 rutas publicadas.

## Flujo integral cubierto

La prueba crea únicamente datos ficticios y los elimina al terminar:

1. Comprueba información y salud de la API.
2. Inicia y renueva una sesión administrativa, verificando que el token
   anterior quede invalidado.
3. Consulta roles; crea, consulta, modifica, habilita, asigna roles y cambia la
   contraseña de usuarios portador y seguridad.
4. Crea, modifica y consulta un punto de acceso; consulta y actualiza una
   configuración sin variar su valor operativo durante la prueba.
5. Inicia ambas sesiones móviles y consulta la identidad digital.
6. Genera y consulta un QR; comprueba que la vigencia serializada coincide con
   la configurada y con el reloj de Dart.
7. Autoriza el primer uso y deniega la reutilización del mismo QR.
8. Consulta historial de seguridad, accesos administrativos, detalle, resumen
   y auditoría.
9. Genera y revoca otro QR y cierra las sesiones.
10. Repite el proceso móvil relevante mediante el `ClienteApi` real de Dart.

## Comandos

Sólo el flujo integral:

```bash
cd api-backend-entrada-upt
npm run test:flujo-completo
```

Toda la verificación del repositorio:

```bash
./scripts/verificar_proyecto.sh
```

El script integral requiere la MariaDB configurada y Flutter disponible. Usa
un puerto HTTP aleatorio, restaura `DURACION_QR_SEGUNDOS` y elimina usuarios,
sesiones, credenciales, accesos, auditoría y punto de prueba incluso si falla.

## Contrato de endpoints

El catálogo de los 30 endpoints, con autenticación, parámetros, cuerpos,
estados HTTP y respuestas, está en [ENDPOINTS_API_UPT.md](ENDPOINTS_API_UPT.md).

## Límite deliberado

Se conserva la autenticación local sustituible. La integración con el proveedor
de identidad institucional y la intranet UPT no forma parte de este hito.
