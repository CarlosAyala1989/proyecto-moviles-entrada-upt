# Datos académicos y pagos de la intranet

1. Solicita `GET /api/registro-estudiante/intranet/captcha`. La respuesta incluye
   `datos.transaccion_id`, `datos.imagen_base64` y `datos.expira_en`.
2. Envía `POST /api/registro-estudiante/intranet/verificar` con el código de diez
   dígitos, la contraseña numérica y el CAPTCHA resuelto por el estudiante.

```json
{
  "transaccion_id": "0664b410-145e-4ef3-8d98-1055d8d57ee9",
  "codigo": "1111222233",
  "contrasena": "123456",
  "captcha": "12345",
  "incluir_datos_estudiante": true
}
```

El CAPTCHA es de un solo uso. Con `incluir_datos_estudiante` omitido o en
`false`, la respuesta conserva el perfil básico y su identificador de
verificación para Google.

## Respuesta ampliada

`datos.datos_estudiante` incluye `fecha_extraccion`, `menu_principal`,
`menu_academico` y las secciones siguientes.

| Campo | Contenido |
| --- | --- |
| `cursos_actuales` | Récord académico y calificaciones finales cuando figuran en el récord. |
| `notas_actuales` | `cursos_con_notas` con unidades, pesos, evaluaciones y resúmenes disponibles. |
| `periodos_anteriores` | Páginas de los períodos publicados por la intranet. Cada elemento incluye `periodo`. |
| `horario` | Horario publicado para el estudiante. |
| `asistencia` | Tablas de asistencia por fecha. |
| `cursos_extracurriculares` | Cursos TAEX cuando el portal publica el enlace. |
| `economia_inicio` | `obligaciones` con descripción, monto y vencimiento, además de `total` y `deuda_biblioteca` cuando figuran en Inicio. |
| `comprobantes_electronicos` | Texto y tablas disponibles en la página enlazada desde Inicio. |
| `pasarela` | Resultado de consultar la entrada de la pasarela. `requiere_autenticacion` indica que esta pide otro acceso. |

Cada sección leída contiene `estado: "leida"`, `pagina`, `url`, `titulo`,
`texto` y `tablas`. Cada tabla incluye `cabeceras`, `filas` y, si hay
columnas identificadas, `registros` con las filas que coinciden con la
cabecera. Los montos y fechas se entregan en el formato publicado por la
intranet. Las URL publicadas omiten identificadores de sesión.

El estado general es `completo`, `parcial` o `no_disponible`. Ante fallos
por sección, `errores` incluye la sección, un código y el período si aplica.
Cuando la extracción completa falla antes de obtener resultados,
`datos_estudiante` contiene `estado: "no_disponible"` y un `codigo`.
El perfil y la verificación para Google siguen disponibles cuando las
credenciales y la identidad de intranet fueron verificadas.

La consulta usa la misma sesión de intranet y solicita las páginas por GET.
Cada lectura tiene un máximo de siete segundos dentro de un presupuesto total
de 45 segundos para las solicitudes de extracción. La respuesta lleva
`Cache-Control: no-store`. La API cierra el contexto de navegador al terminar
y entrega la extracción en la respuesta de esa solicitud. La verificación
temporal para Google conserva únicamente el perfil básico.
