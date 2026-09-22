import { Router } from 'express';
import { validarDatos } from '../../../middleware/validar_datos.js';
import { crearControladorCodigosQr } from '../controladores/codigos_qr.controlador.js';
import { RepositorioCodigosQrMariaDb } from '../repositorios/repositorio_codigos_qr_mariadb.js';
import { RepositorioCodigosQrOfflineMariaDb } from '../repositorios/repositorio_codigos_qr_offline_mariadb.js';
import { crearServicioCodigosQr } from '../servicios/codigos_qr.servicio.js';
import {
  esquemaConsultaCodigoQrActual,
  esquemaGenerarCodigoQr,
  esquemaPrepararCodigosOffline,
} from '../validacion/codigos_qr.esquemas.js';

export function crearEnrutadorCodigosQr({
  requerirAutenticacion,
  repositorio = new RepositorioCodigosQrMariaDb(),
  repositorioOffline = new RepositorioCodigosQrOfflineMariaDb(),
}) {
  const enrutador = Router();
  const servicio = crearServicioCodigosQr(repositorio, repositorioOffline);
  const controlador = crearControladorCodigosQr(servicio);

  enrutador.use(requerirAutenticacion);
  enrutador.post(
    '/',
    validarDatos({ cuerpo: esquemaGenerarCodigoQr }),
    controlador.generar,
  );
  enrutador.post(
    '/preparar-offline',
    validarDatos({ cuerpo: esquemaPrepararCodigosOffline }),
    controlador.prepararOffline,
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
