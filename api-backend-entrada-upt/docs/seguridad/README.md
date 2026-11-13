# Integración de la aplicación de seguridad: issues pendientes

Implementación backend del 27 de octubre de 2026. No modifica las aplicaciones Flutter.

## Guías por issue

- [Issue #9: Resultado claro y comprobación de datos mínimos](issue_09_resultado_validacion.md).
- [Issue #10: Rechazar QR inválidos y consumidos](issue_10_rechazar_qr_invalidos.md).
- [Issue #14: Búsqueda manual controlada para seguridad](issue_14_busqueda_manual.md).
- [Issue #15: Causa general y acción sugerida de una denegación](issue_15_causa_denegacion.md).
- [Issue #16: Registrar una incidencia vinculada a una validación](issue_16_registrar_incidencia.md).
- [Issue #18: Validaciones recientes por puerta y turno](issue_18_validaciones_recientes.md).
- [Issue #19: Buscar por código o correo desde administración](issue_19_buscar_codigo_correo.md).
- [Issue #20: Bloquear y rehabilitar una identidad con motivo y vencimiento](issue_20_bloqueo_identidad.md).
- [Issue #22: Reglas configurables por rol, estado, horario y vigencia](issue_22_reglas_acceso.md).
- [Issue #24: Minimizar los datos visibles](issue_24_minimizar_datos.md).

## Contrato común

- Base desplegada configurada: `https://api-moviles.fottuto.men/api`.
- El cambio de archivos local no publica ni despliega la API por sí mismo.
- JSON de petición estricto: se rechazan campos adicionales y datos fuera de rango.
- Bearer de la sesión UPT; las operaciones ADMINISTRADOR y SEGURIDAD están separadas.
- Fechas de respuesta ISO 8601 UTC; horarios de reglas en America/Lima (UTC-05:00).
- Los ejemplos son ficticios y sus fechas/GPS no deben reutilizarse como mediciones actuales.
- La app debe tener internet para buscar, registrar incidencias y validar QR. El titular puede
  generar su QR offline después de vincularse, pero el guardia decide consultando al servidor.
- Las incidencias solo se vinculan a decisiones existentes. Un fallo anterior a persistir la
  validación no tiene necesariamente registro_id.

## Cambios en contratos existentes

| Ruta | Cambio |
| --- | --- |
| POST /api/ingresos/validar | Añade registro_id, turno_id, puede_confirmar y accion_sugerida. Elimina identidad.escuela e identidad.estado_academico. |
| GET /api/ingresos/recientes | Añade filtros de puerta/turno/fecha y paginación; devuelve identidad enmascarada. |
| POST /api/codigos-qr | Declara siempre un_solo_uso true, de acuerdo con el consumo obligatorio. |
| Autenticación | Impide nuevas sesiones y renovación/acceso si existe bloqueo vigente. |
| Logs HTTP/errores | Sin query strings, cuerpos, credenciales ni parámetros SQL; no-store en rutas API. |

Los clientes anteriores con campos académicos nullable continúan decodificando las validaciones;
los que exijan esos campos o el nombre/código íntegro en recientes deben adaptarse. Actualizar
la app del equipo según estas guías; no se han modificado sus archivos Flutter.

## Preparación y despliegue

1. Guardar respaldo y ejecutar sobre una base de desarrollo las migraciones y pruebas.
2. Publicar la API con la nueva migración 014_operaciones_seguridad.sql. El arranque aplica
   las pendientes antes de escuchar. No editar migraciones aplicadas.
3. Actualizar todas las réplicas antes de habilitar reglas y bloqueos desde la app: el código
   de una réplica anterior no interpreta las tablas nuevas. Un rollback del código tampoco
   deshace esos datos ni garantiza la aplicación de estas políticas nuevas.
4. Mantener CLAVE_QR_OFFLINE para los dispositivos vinculados.
5. Comprobar con cuentas ficticias de guardia y administrador las rutas que correspondan.

La migración es aditiva, compatible con MySQL 8 y MariaDB y usa utf8mb4_unicode_ci.
Los registros de acceso existentes quedan con turno_seguridad_id null. No se realiza una
asignación retroactiva. No hay eliminación automática de auditoría ni de incidencias.

## Pruebas reproducibles

Verificación realizada: **142 pruebas del backend correctas** y flujo completo
HTTP/Dart con **35 endpoints verificados**, en MariaDB aislado. No se utilizaron
cuentas ni datos personales reales. La prueba de cliente móvil del contrato nuevo
reside en `test/cliente_dart/flujo_seguridad_test.dart`, dentro de la API; la app
y el paquete Dart compartido no se modificaron.

Sobre una base aislada con las variables DB_* configuradas:

```bash
npm run migrar
npm run sembrar:pruebas
npm test
npm run test:flujo-completo
```

El conjunto nuevo es test/control_acceso.prueba.js. Comprueba permisos, privacidad,
incidencias idempotentes, concurrencia, búsquedas limitadas, turnos, reglas para ambos
formatos QR, vigencia, bloqueo, revocación y rehabilitación. Las pruebas usan cuentas,
puertas y observaciones ficticias. No usar los scripts de fixtures en una base de producción.
