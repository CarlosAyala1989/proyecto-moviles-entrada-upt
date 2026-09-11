# Administración de usuarios

El Hito 3 incorpora operaciones HTTP para registrar y administrar usuarios.
Todas las rutas se encuentran bajo `/api/administracion`.

## Protección temporal de desarrollo

Hasta implementar las sesiones y la autorización por roles del Hito 4, las
rutas exigen la cabecera `x-clave-administracion-desarrollo`. Su valor procede
exclusivamente de `CLAVE_ADMINISTRACION_DESARROLLO` y debe tener al menos 32
caracteres aleatorios.

Esta protección se deshabilita automáticamente cuando `NODE_ENV=production`.
Una clave ausente o corta responde `503`; una clave incorrecta responde `401`.
En el Hito 4 será sustituida por una sesión autenticada cuyo usuario tenga el
rol `ADMINISTRADOR`.

## Administrador inicial

El primer administrador se crea solamente mediante un comando local. Antes de
ejecutarlo, define las variables `ADMIN_INICIAL_*` en el archivo `.env`
excluido de Git y usa una contraseña de entre 14 y 128 caracteres que incluya
mayúsculas, minúsculas, números y símbolos.

```bash
npm run crear:administrador-inicial
```

Para un entorno local nuevo también se puede generar automáticamente una
identidad ficticia, una contraseña robusta y una clave administrativa
aleatorias:

```bash
npm run crear:administrador-desarrollo
```

Los secretos generados quedan exclusivamente en
`credenciales_administrador_local.txt`, con permisos `600` y excluidos de Git y
Docker. El comando solo informa que terminó; nunca imprime la contraseña ni la
clave administrativa.

La contraseña se almacena usando bcrypt con factor de costo 12. El comando no
imprime la contraseña ni su hash y se deshabilita después de encontrar el
primer usuario con rol `ADMINISTRADOR`. También rechaza su ejecución en
producción.

## Endpoints

| Método | Ruta | Operación |
| --- | --- | --- |
| `GET` | `/api/administracion/roles` | Consultar roles habilitados. |
| `GET` | `/api/administracion/usuarios` | Consultar usuarios con paginación. |
| `POST` | `/api/administracion/usuarios` | Registrar un usuario. |
| `GET` | `/api/administracion/usuarios/:id` | Consultar un usuario. |
| `PATCH` | `/api/administracion/usuarios/:id` | Actualizar datos personales. |
| `PATCH` | `/api/administracion/usuarios/:id/estado` | Habilitar, bloquear o deshabilitar. |
| `PUT` | `/api/administracion/usuarios/:id/roles` | Reemplazar los roles asignados. |

La consulta admite `pagina`, `limite`, `buscar` y `estado`. El límite máximo
es 100 registros por página.

## Peticiones reproducibles

Configura la clave en `.env`, inicia el backend y exporta el mismo valor en la
terminal desde la que ejecutarás las pruebas.

```bash
curl --request POST http://127.0.0.1:3000/api/administracion/usuarios \
  --header "x-clave-administracion-desarrollo: $CLAVE_ADMINISTRACION_DESARROLLO" \
  --header "content-type: application/json" \
  --data '{
    "codigo_institucional": "PRUEBA-MANUAL-001",
    "correo_institucional": "manual@example.invalid",
    "nombres": "Usuario",
    "apellidos": "De Prueba",
    "estado": "ACTIVO",
    "estado_autorizacion": "AUTORIZADO",
    "identidad_verificada": true,
    "roles": ["ESTUDIANTE"]
  }'
```

```bash
curl "http://127.0.0.1:3000/api/administracion/usuarios?buscar=PRUEBA-MANUAL-001" \
  --header "x-clave-administracion-desarrollo: $CLAVE_ADMINISTRACION_DESARROLLO"
```

```bash
curl --request PATCH http://127.0.0.1:3000/api/administracion/usuarios/ID/estado \
  --header "x-clave-administracion-desarrollo: $CLAVE_ADMINISTRACION_DESARROLLO" \
  --header "content-type: application/json" \
  --data '{"estado":"INACTIVO","estado_autorizacion":"DENEGADO"}'
```

Las respuestas nunca incluyen `contrasena_hash`. Los códigos o correos
duplicados responden `409`, los datos inválidos `400` y los usuarios
inexistentes `404`.
