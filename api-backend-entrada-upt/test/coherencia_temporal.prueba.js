import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { grupoConexiones } from '../src/config/database.js';
import { entorno } from '../src/config/env.js';

after(async () => {
  await grupoConexiones.end();
});

function fechaLocal(fecha) {
  const numero = (valor) => String(valor).padStart(2, '0');
  return `${fecha.getFullYear()}-${numero(fecha.getMonth() + 1)}-${numero(fecha.getDate())}`;
}

describe('Coherencia temporal entre Node y MariaDB', () => {
  it('fija America/Lima como zona del proceso y de la sesión SQL', async () => {
    const [resultado] = await grupoConexiones.query(
      'SELECT @@session.time_zone AS zona',
    );

    assert.equal(entorno.zonaHoraria, 'America/Lima');
    assert.equal(process.env.TZ, 'America/Lima');
    assert.equal(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      'America/Lima',
    );
    assert.equal(resultado.zona, '-05:00');
  });

  it('interpreta CURRENT_TIMESTAMP como el mismo instante', async () => {
    const [resultado] = await grupoConexiones.query(
      `SELECT
        CURRENT_TIMESTAMP(3) AS fecha,
        UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) AS epoch`,
    );

    const diferenciaMilisegundos = Math.abs(
      resultado.fecha.getTime() - Number(resultado.epoch) * 1000,
    );
    assert.ok(diferenciaMilisegundos < 2, {
      diferenciaMilisegundos,
      fecha: resultado.fecha,
      epoch: resultado.epoch,
    });
  });

  it('conserva un instante enviado desde Node', async () => {
    const instante = new Date('2026-09-12T14:30:45.123Z');
    const [resultado] = await grupoConexiones.query(
      'SELECT CAST(? AS DATETIME(3)) AS fecha, UNIX_TIMESTAMP(?) AS epoch',
      [instante, instante],
    );

    assert.equal(resultado.fecha.getTime(), instante.getTime());
    assert.equal(Number(resultado.epoch), instante.getTime() / 1000);
  });

  it('usa el mismo día operativo que Node', async () => {
    const [resultado] = await grupoConexiones.query(
      'SELECT CAST(CURRENT_DATE() AS CHAR) AS dia',
    );

    assert.equal(resultado.dia, fechaLocal(new Date()));
  });
});
