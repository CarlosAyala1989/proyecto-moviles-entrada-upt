# Administración de usuarios

Las operaciones administrativas se encuentran bajo `/api/administracion` y
requieren una sesión activa con el rol `ADMINISTRADOR`. La antigua cabecera de
desarrollo ya no concede acceso.

## Administrador inicial

El primer administrador se crea solamente mediante un comando local. Define
las variables `ADMIN_INICIAL_*` en el archivo `.env` excluido de Git y utiliza
una contraseña de 14 a 128 caracteres con mayúsculas, minúsculas, números y
símbolos.

```bash
npm run crear:administrador-inicial
```

En un entorno local nuevo también se pueden generar credenciales ficticias:

```bash
npm run crear:administrador-desarrollo
```

Los valores generados quedan únicamente en
`credenciales_administrador_local.txt`, con permisos `600` y excluidos de Git
y Docker. El comando nunca imprime la contraseña. La contraseña se almacena
con bcrypt y factor de costo 12; el procedimiento se deshabilita después de
encontrar el primer administrador y no funciona en producción.

## Endpoints

| Método | Ruta | Operación |
| --- | --- | --- |
| `GET` | `/api/administracion/roles` | Consultar roles habilitados. |
| `GET` | `/api/administracion/usuarios` | Consultar usuarios con paginación. |
| `POST` | `/api/administracion/usuarios` | Registrar un usuario y, opcionalmente, su contraseña local. |
| `GET` | `/api/administracion/usuarios/:id` | Consultar un usuario. |
| `PATCH` | `/api/administracion/usuarios/:id` | Actualizar datos personales. |
| `PATCH` | `/api/administracion/usuarios/:id/estado` | Habilitar, bloquear o deshabilitar. |
| `PUT` | `/api/administracion/usuarios/:id/roles` | Reemplazar los roles asignados. |
| `PUT` | `/api/administracion/usuarios/:id/credencial-local` | Cambiar la contraseña y revocar sus sesiones activas. |

La consulta admite `pagina`, `limite`, `buscar` y `estado`, con un máximo de
100 registros por página. Un administrador no puede deshabilitar su propia
cuenta ni quitarse su propio rol administrativo.

## Peticiones reproducibles

Primero inicia sesión según `docs/autenticacion_temporal.md` y conserva el
token de acceso en una variable local:

```bash
export TOKEN_ACCESO='reemplazar-por-el-token-recibido'
```

Registrar un usuario habilitado con credencial local:

```bash
curl --request POST http://127.0.0.1:3000/api/administracion/usuarios \
  --header "authorization: Bearer $TOKEN_ACCESO" \
  --header "content-type: application/json" \
  --data '{
    "codigo_institucional": "PRUEBA-MANUAL-001",
    "correo_institucional": "manual@example.invalid",
    "contrasena": "Cambiar-Esta-Clave!2026",
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
  --header "authorization: Bearer $TOKEN_ACCESO"
```

```bash
curl --request PATCH http://127.0.0.1:3000/api/administracion/usuarios/ID/estado \
  --header "authorization: Bearer $TOKEN_ACCESO" \
  --header "content-type: application/json" \
  --data '{"estado":"INACTIVO","estado_autorizacion":"DENEGADO"}'
```

Las respuestas nunca incluyen contraseñas ni hashes. Los identificadores
duplicados responden `409`, los datos inválidos `400`, los usuarios
inexistentes `404` y un rol insuficiente `403`.
