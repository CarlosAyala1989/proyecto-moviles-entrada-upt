import { Router } from 'express';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorRegistroEstudiante } from '../controladores/registro_estudiante.controlador.js';
import { RepositorioRegistroEstudianteMariaDb } from '../repositorios/repositorio_registro_estudiante_mariadb.js';
import { ServicioGoogleEstudiante } from '../servicios/google_estudiante.servicio.js';
import { ServicioIntranetUpt } from '../servicios/intranet_upt.servicio.js';
import { ServicioAccesoIntranet } from '../servicios/acceso_intranet.servicio.js';
import { limitarSolicitudesIntranet } from '../../../middleware/limitar_solicitudes_intranet.js';
import {
  esquemaIniciarGoogle,
  esquemaTransaccionGoogle,
  esquemaVerificarIntranet,
} from '../validacion/registro_estudiante.esquemas.js';

export function crearEnrutadorRegistroEstudiante({
  servicioIntranet = new ServicioIntranetUpt(),
  servicioGoogle,
  configuracionGoogle,
  repositorio = new RepositorioRegistroEstudianteMariaDb(),
  servicioAutenticacion,
  soloIntranet = true,
} = {}) {
  const enrutador = Router();
  enrutador.use(limitarSolicitudesIntranet());
  const proveedorGoogle = servicioGoogle ?? new ServicioGoogleEstudiante({
    configuracion: configuracionGoogle,
    servicioIntranet,
    repositorio,
    servicioAutenticacion,
  });
  const controlador = crearControladorRegistroEstudiante(
    servicioIntranet,
    proveedorGoogle,
    soloIntranet ? new ServicioAccesoIntranet({ servicioIntranet, repositorio, servicioAutenticacion }) : undefined,
  );

  enrutador.get('/intranet/captcha', controlador.obtenerCaptchaIntranet);
  enrutador.post(
    '/intranet/verificar',
    validarDatos({ cuerpo: esquemaVerificarIntranet }),
    controlador.verificarIntranet,
  );
  if (!soloIntranet) enrutador.post(
    '/google/iniciar',
    validarDatos({ cuerpo: esquemaIniciarGoogle }),
    controlador.iniciarGoogle,
  );
  if (!soloIntranet) enrutador.get('/google/callback', controlador.retornarGoogle);
  if (!soloIntranet) enrutador.get('/google/resultado', controlador.mostrarResultadoGoogle);
  if (!soloIntranet) enrutador.get(
    '/google/estado/:transaccion_id',
    validarDatos({ parametros: esquemaTransaccionGoogle }),
    controlador.consultarEstadoGoogle,
  );
  return enrutador;
}
