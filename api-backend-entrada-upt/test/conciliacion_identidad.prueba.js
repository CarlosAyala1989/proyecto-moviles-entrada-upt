import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  coincidenNombres,
  conciliarIdentidadEstudiante,
  extraerCodigoCorreoInstitucional,
  separarNombreIntranet,
} from '../src/modulos/registro_estudiante/servicios/conciliacion_identidad.servicio.js';

describe('Conciliación de identidad de estudiante', () => {
  it('extrae únicamente el código de un correo institucional UPT válido', () => {
    assert.equal(
      extraerCodigoCorreoInstitucional('CA2022074266@virtual.upt.pe'),
      '2022074266',
    );
    assert.equal(
      extraerCodigoCorreoInstitucional('dc2021051033@virtual.upt.pe'),
      '2021051033',
    );
    assert.equal(extraerCodigoCorreoInstitucional('2022074266@gmail.com'), null);
    assert.equal(extraerCodigoCorreoInstitucional('ca202207426@virtual.upt.pe'), null);
  });

  it('reordena el nombre de la intranet y compara tildes y mayúsculas', () => {
    assert.deepEqual(
      separarNombreIntranet('AYALA RAMOS, CARLOS DANIEL'),
      {
        apellidos: 'AYALA RAMOS',
        nombres: 'CARLOS DANIEL',
        nombreCompleto: 'CARLOS DANIEL AYALA RAMOS',
      },
    );
    assert.equal(
      coincidenNombres('Carlos Dániel Ayala Ramos', 'CARLOS DANIEL AYALA RAMOS'),
      true,
    );
  });

  it('acepta el perfil de ejemplo cuando código y nombre pertenecen a la misma persona', () => {
    const resultado = conciliarIdentidadEstudiante({
      correoGoogle: 'ca2022074266@virtual.upt.pe',
      nombreGoogle: 'CARLOS DANIEL AYALA RAMOS',
      codigoIntranet: '2022074266',
      nombreApellidosIntranet: 'AYALA RAMOS, CARLOS DANIEL',
    });

    assert.deepEqual(resultado, {
      valida: true,
      codigo: '2022074266',
      correoInstitucional: 'ca2022074266@virtual.upt.pe',
      nombres: 'CARLOS DANIEL',
      apellidos: 'AYALA RAMOS',
      nombreGoogle: 'CARLOS DANIEL AYALA RAMOS',
      nombreIntranet: 'AYALA RAMOS, CARLOS DANIEL',
    });
  });

  it('rechaza una coincidencia parcial de código o de nombre', () => {
    assert.equal(
      conciliarIdentidadEstudiante({
        correoGoogle: 'ca2022074266@virtual.upt.pe',
        nombreGoogle: 'CARLOS DANIEL AYALA RAMOS',
        codigoIntranet: '2022074000',
        nombreApellidosIntranet: 'AYALA RAMOS, CARLOS DANIEL',
      }).motivo,
      'CODIGOS_NO_COINCIDEN',
    );
    assert.equal(
      conciliarIdentidadEstudiante({
        correoGoogle: 'ca2022074266@virtual.upt.pe',
        nombreGoogle: 'CARLOS DANIEL AYALA RAMOS',
        codigoIntranet: '2022074266',
        nombreApellidosIntranet: 'AYALA RAMOS, MARIA DANIELA',
      }).motivo,
      'NOMBRES_NO_COINCIDEN',
    );
  });
});
