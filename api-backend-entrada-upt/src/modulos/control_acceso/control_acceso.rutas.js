import { Router } from 'express';
import { requerirRoles } from '../../middleware/requerir_roles.js';
import { validarDatos } from '../../middleware/validar_datos.js';
import { comprobarUbicacionSeguridad } from '../seguridad_operativa/seguridad_operativa.js';
import * as esquemas from './control_acceso.esquemas.js';
import * as repositorio from './control_acceso.repositorio.js';

export function crearRutasOperacionSeguridad(requerirAutenticacion) {
  const rutas = Router();
  rutas.use(requerirAutenticacion, requerirRoles('SEGURIDAD'));
  rutas.post('/identidades/buscar', validarDatos({ cuerpo: esquemas.esquemaBusqueda }), async (solicitud, respuesta) => {
    const datos = solicitud.datosValidados.cuerpo;
    await comprobarUbicacionSeguridad(solicitud.usuarioAutenticado.id, datos.ubicacion);
    respuesta.json({ datos: await repositorio.buscarIdentidad(datos, solicitud.usuarioAutenticado.id) });
  });
  rutas.post('/turnos', validarDatos({ cuerpo: esquemas.esquemaTurno }), async (solicitud, respuesta) => {
    const asignacion = await comprobarUbicacionSeguridad(solicitud.usuarioAutenticado.id, solicitud.datosValidados.cuerpo.ubicacion);
    respuesta.status(201).json({ datos: await repositorio.iniciarTurno(solicitud.usuarioAutenticado.id, asignacion.punto_acceso.id) });
  });
  rutas.get('/turnos', validarDatos({ consulta: esquemas.vacio }), async (solicitud, respuesta) => {
    respuesta.json({ datos: await repositorio.listarTurnos(solicitud.usuarioAutenticado.id) });
  });
  rutas.get('/turnos/actual', validarDatos({ consulta: esquemas.vacio }), async (solicitud, respuesta) => {
    respuesta.json({ datos: await repositorio.listarTurnos(solicitud.usuarioAutenticado.id, true) });
  });
  rutas.post('/turnos/:id/cerrar', validarDatos({ parametros: esquemas.id, cuerpo: esquemas.vacio }), async (solicitud, respuesta) => {
    respuesta.json({ datos: await repositorio.cerrarTurno(solicitud.usuarioAutenticado.id, solicitud.datosValidados.parametros.id) });
  });
  return rutas;
}

export function crearRutasIncidencias(requerirAutenticacion) {
  const rutas = Router();
  rutas.use('/:id/incidencias', requerirAutenticacion, requerirRoles('SEGURIDAD'));
  rutas.post('/:id/incidencias', validarDatos({ parametros: esquemas.id, cuerpo: esquemas.esquemaIncidencia }), async (solicitud, respuesta) => {
    const resultado = await repositorio.crearIncidencia(solicitud.usuarioAutenticado.id, solicitud.datosValidados.parametros.id, solicitud.datosValidados.cuerpo);
    respuesta.status(resultado.creada ? 201 : 200).json({ datos: resultado.incidencia });
  });
  rutas.get('/:id/incidencias', validarDatos({ parametros: esquemas.id, consulta: esquemas.vacio }), async (solicitud, respuesta) => {
    respuesta.json({ datos: await repositorio.listarIncidencias(solicitud.usuarioAutenticado.id, solicitud.datosValidados.parametros.id) });
  });
  return rutas;
}

export function crearRutasAdministracionAcceso() {
  // Se monta dentro del enrutador que ya exige ADMINISTRADOR.
  const rutas = Router();
  rutas.get('/incidencias', validarDatos({ consulta: esquemas.paginacion }), async (solicitud, respuesta) => {
    respuesta.json(await repositorio.consultarIncidencias(solicitud.datosValidados.consulta));
  });
  rutas.get('/reglas-acceso', validarDatos({ consulta: esquemas.paginacion }), async (solicitud, respuesta) => {
    respuesta.json(await repositorio.listarReglas(solicitud.datosValidados.consulta));
  });
  rutas.post('/reglas-acceso', validarDatos({ cuerpo: esquemas.esquemaRegla }), async (solicitud, respuesta) => {
    respuesta.status(201).json({ datos: await repositorio.guardarRegla(solicitud.usuarioAutenticado.id, solicitud.datosValidados.cuerpo) });
  });
  rutas.put('/reglas-acceso/:id', validarDatos({ parametros: esquemas.id, cuerpo: esquemas.esquemaRegla }), async (solicitud, respuesta) => {
    respuesta.json({ datos: await repositorio.guardarRegla(solicitud.usuarioAutenticado.id, solicitud.datosValidados.cuerpo, solicitud.datosValidados.parametros.id) });
  });
  rutas.get('/usuarios/:id/bloqueos', validarDatos({ parametros: esquemas.id, consulta: esquemas.vacio }), async (solicitud, respuesta) => {
    respuesta.json({ datos: await repositorio.listarBloqueos(solicitud.datosValidados.parametros.id) });
  });
  rutas.post('/usuarios/:id/bloqueos', validarDatos({ parametros: esquemas.id, cuerpo: esquemas.esquemaBloqueo }), async (solicitud, respuesta) => {
    respuesta.status(201).json({ datos: await repositorio.bloquearIdentidad(solicitud.usuarioAutenticado.id, solicitud.datosValidados.parametros.id, solicitud.datosValidados.cuerpo) });
  });
  rutas.post('/usuarios/:id/bloqueos/:bloqueo_id/rehabilitar', validarDatos({ parametros: esquemas.idBloqueo, cuerpo: esquemas.esquemaRehabilitar }), async (solicitud, respuesta) => {
    respuesta.json({ datos: await repositorio.rehabilitarIdentidad(solicitud.usuarioAutenticado.id, solicitud.datosValidados.parametros.id, solicitud.datosValidados.parametros.bloqueo_id, solicitud.datosValidados.cuerpo) });
  });
  return rutas;
}
