import { Router } from 'express';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorRegistroEstudiante } from '../controladores/registro_estudiante.controlador.js';
import { RepositorioRegistroEstudianteMariaDb } from '../repositorios/repositorio_registro_estudiante_mariadb.js';
import { ServicioGoogleEstudiante } from '../servicios/google_estudiante.servicio.js';
import { ServicioIntranetUpt } from '../servicios/intranet_upt.servicio.js';
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
} = {}) {
  const enrutador = Router();
  const proveedorGoogle = servicioGoogle ?? new ServicioGoogleEstudiante({
    configuracion: configuracionGoogle,
    servicioIntranet,
    repositorio,
    servicioAutenticacion,
  });
  const controlador = crearControladorRegistroEstudiante(
    servicioIntranet,
    proveedorGoogle,
  );

  enrutador.get('/intranet/captcha', controlador.obtenerCaptchaIntranet);
  enrutador.post(
    '/intranet/verificar',
    validarDatos({ cuerpo: esquemaVerificarIntranet }),
    controlador.verificarIntranet,
  );
  enrutador.post(
    '/google/iniciar',
    validarDatos({ cuerpo: esquemaIniciarGoogle }),
    controlador.iniciarGoogle,
  );
  enrutador.get('/google/callback', controlador.retornarGoogle);
  enrutador.get('/google/resultado', controlador.mostrarResultadoGoogle);
  enrutador.get(
    '/google/estado/:transaccion_id',
    validarDatos({ parametros: esquemaTransaccionGoogle }),
    controlador.consultarEstadoGoogle,
  );
  return enrutador;
}
