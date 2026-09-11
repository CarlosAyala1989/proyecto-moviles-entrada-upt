import { Router } from 'express';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorCodigosQr } from '../controladores/codigos_qr.controlador.js';
import { RepositorioCodigosQrMariaDb } from '../repositorios/repositorio_codigos_qr_mariadb.js';
import { crearServicioCodigosQr } from '../servicios/codigos_qr.servicio.js';
import {
  esquemaConsultaCodigoQrActual,
  esquemaGenerarCodigoQr,
} from '../validacion/codigos_qr.esquemas.js';

export function crearEnrutadorCodigosQr({
  requerirAutenticacion,
  repositorio = new RepositorioCodigosQrMariaDb(),
}) {
  const enrutador = Router();
  const servicio = crearServicioCodigosQr(repositorio);
  const controlador = crearControladorCodigosQr(servicio);

  enrutador.use(requerirAutenticacion);
  enrutador.post(
    '/',
    validarDatos({ cuerpo: esquemaGenerarCodigoQr }),
    controlador.generar,
  );
  enrutador.get(
    '/actual',
    validarDatos({ consulta: esquemaConsultaCodigoQrActual }),
    controlador.consultarActual,
  );
  enrutador.delete(
    '/actual',
    validarDatos({ consulta: esquemaConsultaCodigoQrActual }),
    controlador.revocarActual,
  );

  return enrutador;
}
