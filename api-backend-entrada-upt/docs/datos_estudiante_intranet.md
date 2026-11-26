# Endpoints de intranet UPT para consultar datos académicos y pagos

La opción **Identidad digital → Datos académicos y pagos** pide al estudiante
que vuelva a autenticarse en la intranet. La app usa el código institucional
de la sesión abierta y pide la contraseña numérica y el CAPTCHA. La API
consulta las páginas solicitadas después de validar que la intranet devolvió
ese mismo código.

El cambio de contrato es el campo opcional
`incluir_datos_estudiante` en el POST de verificación. En el inicio de sesión
habitual se omite el campo. La consulta desde el perfil envía `true`
y recibe la extracción en `datos.datos_estudiante`. Es una consulta de solo
lectura que termina con la respuesta del POST. La app conserva su sesión
actual y usa el flujo de Google únicamente para el inicio de sesión habitual.
El contrato de ese flujo está en `ENDPOINTS_LOGIN_ESTUDIANTE.md` del
proyecto de pruebas.

## Rutas y transporte

| Método | Ruta HTTP completa | Petición | Respuesta exitosa |
| --- | --- | --- | --- |
| `GET` | `/api/registro-estudiante/intranet/captcha` | Sin cuerpo. | `200 OK` con imagen, UUID y vencimiento. |
| `POST` | `/api/registro-estudiante/intranet/verificar` | JSON con UUID, código, contraseña y CAPTCHA. | `200 OK` con perfil y, si se solicitó, datos académicos y económicos. |

- La URL configurada en la app es `https://api-moviles.fottuto.men/api`.
  Si la base ya termina en `/api`, concatena
  `/registro-estudiante/intranet/captcha` o
  `/registro-estudiante/intranet/verificar`.
- Ambas rutas carecen de parámetros de ruta o consulta y prescinden del
  encabezado `Authorization`. El POST valida las credenciales de intranet
  y la transacción del CAPTCHA. La sesión de la app se usa en Flutter para
  elegir el código institucional del perfil.
- Envía `Accept: application/json` y, para el POST,
  `Content-Type: application/json`. La respuesta exitosa usa
  `{"datos": {...}}` y lleva `Cache-Control: no-store`.
- Lee el JSON como UTF-8. Los UUID, los códigos, las contraseñas y las
  respuestas del CAPTCHA son cadenas. Mantén los ceros iniciales.

## 1. Obtener el CAPTCHA

```http
GET /api/registro-estudiante/intranet/captcha
Accept: application/json
```

### Respuesta `200 OK`

```json
{
  "datos": {
    "transaccion_id": "0664b410-145e-4ef3-8d98-1055d8d57ee9",
    "imagen_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
    "tipo_imagen": "image/png",
    "expira_en": "2026-11-13T20:05:00.000Z"
  }
}
```

| Campo en `datos` | Tipo JSON | Tipo Dart | Descripción |
| --- | --- | --- | --- |
| `transaccion_id` | `string` UUID | `String` | UUID que se envía al POST con la respuesta a esta imagen. |
| `imagen_base64` | `string` Base64 | `String` | Bytes de la imagen, sin prefijo de URL. En Flutter, usa `Image.memory(base64Decode(...))`. El ejemplo contiene una imagen ilustrativa. |
| `tipo_imagen` | `string` | `String` | Tipo MIME. El valor actual es `image/png`. |
| `expira_en` | `string` ISO 8601 en UTC | `DateTime` | Vencimiento del CAPTCHA. El servidor otorga cinco minutos desde que emite la transacción. |

Los cuatro campos siempre aparecen en el `200`. Si el usuario cambia la
imagen, reemplaza juntos el UUID, la imagen y el vencimiento. Limpia el
texto que escribió para la imagen anterior.

## 2. Verificar y consultar

```http
POST /api/registro-estudiante/intranet/verificar
Accept: application/json
Content-Type: application/json
```

### Cuerpo de la petición

| Campo | Tipo JSON | Tipo Dart | Obligatorio | Validación |
| --- | --- | --- | --- | --- |
| `transaccion_id` | `string` UUID | `String` | Sí | UUID de la última imagen mostrada. Debe existir, estar vigente y quedar disponible para su primer uso. |
| `codigo` | `string` | `String` | Sí | Exactamente 10 dígitos. Desde el perfil se usa `sesion.usuario.codigoInstitucional`. |
| `contrasena` | `string` | `String` | Sí | De 1 a 6 dígitos. Es la contraseña de intranet UPT. |
| `captcha` | `string` | `String` | Sí | De 1 a 5 dígitos. Es el número que el estudiante lee de la imagen. |
| `incluir_datos_estudiante` | `boolean` | `bool` | No | `true` solicita la extracción. `false` u omitir el campo devuelve el perfil básico. |

Envía los booleanos como `true` o `false` y los campos numéricos del
formulario entre comillas. El esquema rechaza campos adicionales, valores
`null`, espacios y tipos incorrectos.

```json
{
  "transaccion_id": "0664b410-145e-4ef3-8d98-1055d8d57ee9",
  "codigo": "1111222233",
  "contrasena": "123456",
  "captcha": "03868",
  "incluir_datos_estudiante": true
}
```

El servidor consume la transacción cuando empieza a comprobar credenciales.
Si falla después de ese punto o se pierde la respuesta, solicita otro CAPTCHA
antes de reintentar. Un `400 DATOS_INVALIDOS` por el esquema ocurre antes de
consumir la transacción. Durante el POST, deshabilita el doble envío.

### Campos del `200 OK`

| Campo en `datos` | Tipo JSON | Tipo Dart | Presencia y significado |
| --- | --- | --- | --- |
| `codigo` | `string` | `String` | Siempre. Código confirmado por la intranet. Coincide con el código enviado. |
| `nombre_apellidos` | `string` | `String` | Siempre. Nombre de la intranet, normalmente en formato `APELLIDOS, NOMBRES`. |
| `escuela_profesional` | `string | null` | `String?` | Siempre en el contrato actual. `null` cuando la API no identifica la escuela. |
| `verificacion_intranet_id` | `string` UUID | `String` | Siempre. Identificador temporal del flujo de Google. La consulta desde el perfil puede ignorarlo. |
| `verificacion_expira_en` | `string` ISO 8601 en UTC | `DateTime` | Siempre. Vencimiento de la verificación para Google, diez minutos después de emitirla. |
| `datos_estudiante` | `object` | `DatosEstudianteIntranet` | Presente al enviar `incluir_datos_estudiante: true`. Se omite en el acceso habitual. |

### Estructura de `datos.datos_estudiante`

La respuesta normal contiene todos los campos de esta tabla, incluso cuando
alguna página falló. La respuesta abreviada por un fallo general se documenta
más abajo.

| Campo | Tipo JSON | Contenido |
| --- | --- | --- |
| `estado` | `string` | `completo`, `parcial` o `no_disponible`. |
| `fecha_extraccion` | `string` ISO 8601 en UTC | Momento en que la API inicia la recopilación. |
| `menu_principal` | `array<Enlace>` | Enlaces encontrados en Inicio. Puede ser `[]`. |
| `menu_academico` | `array<Enlace>` | Enlaces académicos encontrados en Alumno. Puede ser `[]`. |
| `cursos_actuales` | `Pagina` | Récord académico, incluidos cursos, créditos y notas finales cuando aparecen en las tablas. |
| `notas_actuales` | `Pagina` | Notas del período actual. Si se lee, agrega `cursos_con_notas`. |
| `periodos_anteriores` | `array<Pagina>` | Páginas de los períodos que publica el portal. Cada elemento agrega `periodo`, incluso si la lectura falló. Puede ser `[]`. |
| `horario` | `Pagina` | Horario por curso y día, según las tablas publicadas. |
| `asistencia` | `Pagina` | Texto y tablas de asistencia, con fechas como cabeceras cuando así las publica el portal. |
| `cursos_extracurriculares` | `Pagina` | Cursos TAEX si el portal publica el enlace. |
| `economia_inicio` | `Pagina` | Información económica de Inicio. Si se lee, agrega `obligaciones`, `total` y `deuda_biblioteca`. |
| `comprobantes_electronicos` | `Pagina` | Texto y tablas del enlace de comprobantes, cuando están accesibles. El contrato entrega la página extraída. |
| `pasarela` | `Pagina` | Resultado de consultar la entrada de la pasarela. `requiere_autenticacion` indica que solicita su propio acceso. |
| `errores` | `array<ErrorSeccion>` | Fallos de la extracción. Puede ser `[]`. |

#### Tipo `Enlace`

| Campo | Tipo JSON | Descripción |
| --- | --- | --- |
| `seccion` | `string` | Etiqueta visible del enlace. |
| `url` | `string` | URL absoluta sin identificadores de sesión. Puede llevar un parámetro numérico de navegación académica. Es informativa y la app obtiene los datos del POST. |

#### Tipo `Pagina`

| Campo | Tipo JSON | Presencia y significado |
| --- | --- | --- |
| `pagina` | `string` | Siempre. Etiqueta de la sección asignada por la API. |
| `url` | `string | null` | Siempre. URL informativa sin identificadores de sesión o `null` si falta el enlace. |
| `estado` | `string` | Siempre. Indica si se pudo leer la página. |
| `titulo` | `string` | Solo en `leida`. Título HTML, posiblemente vacío. |
| `texto` | `array<string>` | Siempre. Líneas de texto extraídas. En economía corresponde a la tabla de obligaciones, cuando se identifica. Vacío si la página falló. |
| `tablas` | `array<Tabla>` | Siempre. Tablas de la página. Vacío si la página falló o carece de tablas extraíbles. |
| `periodo` | `string` | Solo en los elementos de `periodos_anteriores`. Ejemplo `2026-I`. |
| `codigo` | `string` | Solo cuando la página quedó sin leer. Identifica la causa. |

`leida` confirma que se pudo leer la página. Sus listas pueden estar
vacías si esa página carece de datos extraíbles.

#### Tipo `Tabla`

| Campo | Tipo JSON | Tipo Dart | Descripción |
| --- | --- | --- | --- |
| `indice` | `number` entero positivo | `int` | Posición de la tabla en el HTML, comenzando en 1. |
| `titulo` | `string | null` | `String?` | Texto del encabezado HTML `<caption>`, cuando existe. |
| `cabeceras` | `array<string>` | `List<String>` | Nombres de columna publicados. Puede venir vacío. |
| `filas` | `array<array<string>>` | `List<List<String>>` | Celdas en orden. Puede incluir subtítulos, subtotales y filas de otro ancho. Una celda vacía puede ser `""`. |
| `registros` | `array<object>` | `List<Map<String, String>>` | Mapas de nombre de columna a celda. Solo incluye filas del mismo ancho que la cabecera. Sin cabecera, vale `[]`. |

Las columnas dependen del portal. Usa `cabeceras` para el orden y
`filas` si necesitas conservar subtotales o celdas sin columna. Las notas,
créditos, semanas, fechas, montos y porcentajes dentro de las tablas son
cadenas en el formato de la intranet.

#### Notas actuales

`notas_actuales.cursos_con_notas` es un arreglo de objetos. Está presente
si se leyó la página y puede ser `[]`. Cada curso contiene
`curso: string` y `unidades: array<object>`.

| Campo por unidad | Tipo JSON | Presencia y significado |
| --- | --- | --- |
| `unidad` | `string` | Siempre. Nombre publicado, por ejemplo `Unidad I`. |
| `peso_unidad` | `string | null` | Siempre. Porcentaje como texto, por ejemplo `30 %`, o `null`. |
| `evaluaciones` | `array<object>` | Siempre. Cada evaluación contiene claves de cabecera con valores `string` o un objeto `{"celdas": [...]}` con las celdas originales si el ancho difiere. |
| `resumen_final` | `array<string>` | Opcional. Celdas del pie de tabla asociadas a la última unidad de esa tabla. |

Cabeceras habituales de una evaluación son `Unidad`, `Criterio`,
`Peso C.`, `Peso U.`, `Nota`, `Fecha` y `Descripción`.
Conserva una nota vacía como dato pendiente de publicación. Puede aparecer
una nota real de `"0"`.

#### Cuotas, vencimientos y deuda de biblioteca

Estos campos adicionales existen cuando `economia_inicio.estado` es
`leida`.

| Campo | Tipo JSON | Tipo Dart | Significado |
| --- | --- | --- | --- |
| `obligaciones` | `array<object> | null` | `List<Map<String, String>>?` | Filas estructuradas de la tabla de cuotas, excluyendo la fila de total. `null` si no se identificó la tabla. `[]` si se identificó y no hay filas con el ancho esperado. Los datos originales siguen en `tablas`. |
| `total` | `string | null` | `String?` | Importe o texto de la fila `Total` en el formato original. `null` si la página carece de un total extraíble. |
| `deuda_biblioteca` | `string | null` | `String?` | Texto publicado junto a la deuda del libro, o `null` si no aparece. |

Las claves observadas en las obligaciones son `Nro`, `Descripción`,
`Monto`, `Vence`, `Dependencia` y `Semestre`. Por ejemplo,
`"200.50"` es un monto y `"30/11/2026"` un vencimiento. Trátalos
como cadenas al mostrarlos. Comprueba si existe monto antes de mostrar un total.

### Ejemplo de `200 OK` con datos parciales

La respuesta de abajo usa datos ficticios. Las páginas leídas tienen muestras
breves para poder ver la forma de cada campo.

```json
{
  "datos": {
    "codigo": "1111222233",
    "nombre_apellidos": "APELLIDO PRUEBA, NOMBRE PRUEBA",
    "escuela_profesional": "Ingeniería de Sistemas",
    "verificacion_intranet_id": "8bcdbcea-0682-4c77-a828-21855d6bcdfa",
    "verificacion_expira_en": "2026-11-13T20:12:00.000Z",
    "datos_estudiante": {
      "estado": "parcial",
      "fecha_extraccion": "2026-11-13T20:01:45.000Z",
      "menu_principal": [
        {"seccion": "Inicio", "url": "https://net.upt.edu.pe/inicio.php"},
        {"seccion": "Comprobantes Electrónicos", "url": "https://net.upt.edu.pe/reporte_comprobantesElectronicos.php"},
        {"seccion": "PASARELA", "url": "https://net.upt.edu.pe/pasarela.php"}
      ],
      "menu_academico": [
        {"seccion": "Ingeniería de Sistemas", "url": "https://net.upt.edu.pe/alumno.php?ir=1"},
        {"seccion": "Notas", "url": "https://net.upt.edu.pe/alumno.php?miscursos=1"},
        {"seccion": "2026-I", "url": "https://net.upt.edu.pe/alumno.php?im=11"},
        {"seccion": "Horario", "url": "https://net.upt.edu.pe/alumno.php?mihorario=1"},
        {"seccion": "Asistencia", "url": "https://net.upt.edu.pe/alumno.php?asistencias=1"}
      ],
      "cursos_actuales": {
        "estado": "leida",
        "pagina": "Cursos / récord académico",
        "url": "https://net.upt.edu.pe/alumno.php?ir=1",
        "titulo": "Net.UPT.edu.pe",
        "texto": ["Record Academico"],
        "tablas": []
      },
      "notas_actuales": {
        "estado": "leida",
        "pagina": "Notas del período actual",
        "url": "https://net.upt.edu.pe/alumno.php?miscursos=1",
        "titulo": "Net.UPT.edu.pe",
        "texto": ["Matemática de prueba"],
        "tablas": [
          {
            "indice": 6,
            "titulo": null,
            "cabeceras": ["Unidad", "Criterio", "Peso C.", "Peso U.", "Nota", "Fecha", "Descripción"],
            "filas": [
              ["Unidad I", "", "", "30 %", "", "", ""],
              ["", "Examen", "100 %", "", "17", "09/11/2026", "Examen parcial"],
              ["", "Promedio", "", "17", ""]
            ],
            "registros": [
              {"Unidad": "Unidad I", "Criterio": "", "Peso C.": "", "Peso U.": "30 %", "Nota": "", "Fecha": "", "Descripción": ""},
              {"Unidad": "", "Criterio": "Examen", "Peso C.": "100 %", "Peso U.": "", "Nota": "17", "Fecha": "09/11/2026", "Descripción": "Examen parcial"}
            ]
          }
        ],
        "cursos_con_notas": [
          {
            "curso": "Matemática de prueba",
            "unidades": [
              {
                "unidad": "Unidad I",
                "peso_unidad": "30 %",
                "evaluaciones": [
                  {
                    "Unidad": "",
                    "Criterio": "Examen",
                    "Peso C.": "100 %",
                    "Peso U.": "",
                    "Nota": "17",
                    "Fecha": "09/11/2026",
                    "Descripción": "Examen parcial"
                  }
                ],
                "resumen_final": ["", "Promedio", "", "17", ""]
              }
            ]
          }
        ]
      },
      "periodos_anteriores": [
        {
          "estado": "leida",
          "pagina": "Cursos del período",
          "periodo": "2026-I",
          "url": "https://net.upt.edu.pe/alumno.php?im=11",
          "titulo": "Net.UPT.edu.pe",
          "texto": ["Semestre 2026-I"],
          "tablas": []
        }
      ],
      "horario": {
        "estado": "leida",
        "pagina": "Horario",
        "url": "https://net.upt.edu.pe/alumno.php?mihorario=1",
        "titulo": "Net.UPT.edu.pe",
        "texto": [],
        "tablas": []
      },
      "asistencia": {
        "estado": "leida",
        "pagina": "Asistencia",
        "url": "https://net.upt.edu.pe/alumno.php?asistencias=1",
        "titulo": "Net.UPT.edu.pe",
        "texto": [],
        "tablas": []
      },
      "cursos_extracurriculares": {
        "estado": "no_disponible",
        "codigo": "ENLACE_NO_DISPONIBLE",
        "pagina": "Cursos extracurriculares (TAEX)",
        "url": null,
        "texto": [],
        "tablas": []
      },
      "economia_inicio": {
        "estado": "leida",
        "pagina": "Información económica",
        "url": "https://net.upt.edu.pe/inicio.php",
        "titulo": "Net.UPT.edu.pe",
        "texto": ["Nro", "Descripción", "Monto", "Vence", "Dependencia", "Semestre", "1", "Cuarta cuota", "200.50", "30/11/2026", "Escuela de prueba", "2026-II", "Total S/.", "200.50"],
        "tablas": [
          {
            "indice": 6,
            "titulo": null,
            "cabeceras": ["Nro", "Descripción", "Monto", "Vence", "Dependencia", "Semestre"],
            "filas": [
              ["1", "Cuarta cuota", "200.50", "30/11/2026", "Escuela de prueba", "2026-II"],
              ["Total S/.", "200.50", ""]
            ],
            "registros": [
              {
                "Nro": "1",
                "Descripción": "Cuarta cuota",
                "Monto": "200.50",
                "Vence": "30/11/2026",
                "Dependencia": "Escuela de prueba",
                "Semestre": "2026-II"
              }
            ]
          }
        ],
        "obligaciones": [
          {
            "Nro": "1",
            "Descripción": "Cuarta cuota",
            "Monto": "200.50",
            "Vence": "30/11/2026",
            "Dependencia": "Escuela de prueba",
            "Semestre": "2026-II"
          }
        ],
        "total": "200.50",
        "deuda_biblioteca": "No tiene deuda de libro hasta la fecha"
      },
      "comprobantes_electronicos": {
        "estado": "leida",
        "pagina": "Comprobantes electrónicos",
        "url": "https://net.upt.edu.pe/reporte_comprobantesElectronicos.php",
        "titulo": "Net.UPT.edu.pe",
        "texto": ["Comprobantes Electrónicos"],
        "tablas": []
      },
      "pasarela": {
        "estado": "requiere_autenticacion",
        "codigo": "ACCESO_PASARELA_REQUERIDO",
        "pagina": "Pasarela de pagos (consulta)",
        "url": "https://net.upt.edu.pe/pasarela.php",
        "texto": [],
        "tablas": []
      },
      "errores": [
        {
          "seccion": "cursos_extracurriculares",
          "codigo": "ENLACE_NO_DISPONIBLE"
        },
        {
          "seccion": "pasarela",
          "codigo": "ACCESO_PASARELA_REQUERIDO"
        }
      ]
    }
  }
}
```

## Estados de extracción dentro de `200 OK`

| Valor de `datos.datos_estudiante.estado` | Significado | Acción en la app |
| --- | --- | --- |
| `completo` | Se leyó al menos una página y `errores` está vacío. | Mostrar las secciones y sus datos. Puede haber listas vacías. |
| `parcial` | Se leyó al menos una página y falló o quedó pendiente otra. | Mostrar lo disponible. Indicar el estado de las secciones pendientes. |
| `no_disponible` | Falló la extracción de todas las páginas o el servicio no llegó a construir el resultado detallado. | Informar el fallo de la consulta y permitir reintentar con otro CAPTCHA. La verificación de identidad ya fue exitosa. |

Si la API inicia la recopilación y ninguna página resulta legible, puede
devolver la estructura normal con `errores`. Si la extracción falla antes de
construir ese resultado, el objeto `datos.datos_estudiante` puede contener
únicamente estos dos campos. El resto de `datos` conserva el perfil básico.

```json
{
  "estado": "no_disponible",
  "codigo": "EXTRACCION_INTRANET_NO_DISPONIBLE"
}
```

### Estado y código de una página

Si una página falla, `errores` incluye un objeto `ErrorSeccion` con
`seccion: string` y `codigo: string`. Si corresponde a
`periodos_anteriores`, también incluye `periodo: string`. La clave de
`seccion` coincide con el campo del objeto de extracción.

| `estado` | `codigo` | Motivo |
| --- | --- | --- |
| `leida` | Ausente | La API pudo leer la página. |
| `no_disponible` | `ENLACE_NO_DISPONIBLE` | El menú no publicó un enlace para esa sección. |
| `no_disponible` | `INFORMACION_ECONOMICA_NO_DISPONIBLE` | En Inicio no se identificó la tabla de cuotas ni el texto de deuda de biblioteca. |
| `requiere_autenticacion` | `ACCESO_PASARELA_REQUERIDO` | La pasarela mostró o indicó un acceso adicional. Las obligaciones de Inicio se pueden mostrar si se leyeron. |
| `redirigido_al_acceso` | `SESION_INTRANET_EXPIRADA` | La intranet volvió a mostrar su formulario de acceso durante la extracción. |
| `error` | `PAGINA_INTRANET_NO_DISPONIBLE` | La página devolvió un error o falló su lectura. |
| `error` | `DESTINO_INTRANET_INESPERADO` | La sección redirigió a un destino ajeno a la consulta esperada. |
| `error` | `TIEMPO_PAGINA_AGOTADO` | La página superó su tiempo de espera. |
| `error` | `TIEMPO_CONSULTA_AGOTADO` | Se agotó el presupuesto total antes de solicitar esa página. |

## Errores HTTP

Los fallos de entrada o autenticación responden con estado HTTP de error y
un objeto `error`. Usa `error.codigo` para decidir qué mostrar.

```json
{
  "error": {
    "codigo": "CAPTCHA_EXPIRADO",
    "mensaje": "El CAPTCHA expiró. Solicita uno nuevo."
  }
}
```

| HTTP | Código | Cuándo aparece |
| --- | --- | --- |
| `400` | `JSON_INVALIDO` | El cuerpo contiene JSON mal formado. |
| `400` | `DATOS_INVALIDOS` | El JSON incumple el esquema. Por ejemplo, envía `"true"` como texto o un código de menos de diez dígitos. |
| `401` | `CREDENCIALES_INTRANET_INVALIDAS` | La intranet rechazó el código, la contraseña o el CAPTCHA. |
| `410` | `CAPTCHA_EXPIRADO` | El UUID no existe, venció o ya se usó. Solicita otro CAPTCHA. |
| `415` | `TIPO_CONTENIDO_NO_ADMITIDO` | El POST tiene cuerpo con un tipo de contenido distinto de JSON. |
| `422` | `CODIGO_INTRANET_NO_COINCIDE` | El código devuelto por la intranet difiere del enviado. |
| `422` | `NAVEGACION_INTRANET_INVALIDA` | La intranet no mostró el menú esperado ni se pudo abrir el perfil. |
| `422` | `PERFIL_INTRANET_NO_ENCONTRADO` | La API no pudo obtener el perfil después del ingreso. |
| `429` | `INTRANET_SATURADA` | Se alcanzó la capacidad de transacciones activas del CAPTCHA. |
| `503` | `NAVEGADOR_NO_DISPONIBLE` | El servidor no encontró Chrome o Chromium para iniciar la consulta. |
| `503` | `INTRANET_NO_DISPONIBLE` | El servidor no pudo abrir o verificar la intranet. |

Un fallo de una sección académica o económica tras verificar las
credenciales se representa en `datos.datos_estudiante` dentro de un
`200 OK`. Los errores del proxy o de red pueden tener otro formato.

## Tiempos de espera y uso desde Flutter

1. Al abrir la opción del perfil, llama a `obtenerCaptchaIntranet()`.
   El cliente Dart usa un tiempo de espera de **45 segundos** para ese GET.
2. Al pulsar **Consultar datos**, llama a
   `consultarDatosEstudianteIntranet(...)` con el UUID de la imagen,
   el código del perfil y ambos valores del formulario. El método agrega
   `incluir_datos_estudiante: true` y usa **120 segundos** para el POST.
   El servidor destina hasta **7 segundos por lectura** y un presupuesto de
   **45 segundos para las solicitudes de extracción**, después de validar
   las credenciales y el perfil.
3. Si el POST devuelve `200`, comprueba `datos.codigo` y lee
   `datos.datos_estudiante.estado`. En `parcial` revisa el estado de
   cada página de forma individual. Si falta `datos_estudiante` tras
   solicitarlo, el cliente trata la respuesta como incompatible.
4. Si el POST vence o falla durante la verificación, carga una nueva imagen
   antes de otro envío. Un timeout del cliente puede dejar una verificación
   en curso en el servidor.
5. Mantén las credenciales y el CAPTCHA en memoria durante el formulario.
   Descarta la contraseña y la respuesta del CAPTCHA al enviar. Mantén los
   resultados en memoria mientras la consulta esté abierta, y descártalos
   al salir o cerrar la sesión. Evita registrar el cuerpo de la solicitud o
   la respuesta con datos del estudiante.

En el proyecto de pruebas, la implementación Dart está en
`paquetes/cliente_api_upt/lib/servicios/cliente_api.dart` y el modelo de
respuesta en `paquetes/cliente_api_upt/lib/modelos/datos_estudiante_intranet.dart`.

[Prueba del contrato con una intranet simulada](../test/datos_estudiante_intranet.prueba.js)
