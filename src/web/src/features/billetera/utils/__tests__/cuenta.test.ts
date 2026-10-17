import { describe, expect, it } from 'vitest';

import { esDeLaCuenta } from '../cuenta';

// En un mismo navegador pueden entrar dos beneficiarios: cada uno ve solo su celular.
describe('esDeLaCuenta', () => {
  it('el celular de María no es de otra cuenta', () => {
    expect(
      esDeLaCuenta({ mandateId: 'maria-device' }, { mandateIds: ['b_1-cel', 'b_1'] }),
    ).toBe(false);
  });

  it('sí es de la cuenta que tiene esa rama', () => {
    expect(
      esDeLaCuenta({ mandateId: 'b_1-cel' }, { mandateIds: ['b_1-cel', 'b_1'] }),
    ).toBe(true);
  });

  it('una sesión vieja sin mandateIds se compara con su mandateId', () => {
    expect(esDeLaCuenta({ mandateId: 'maria-device' }, { mandateId: 'b_1-cel' })).toBe(false);
  });

  it('sin ramas conocidas no se descarta', () => {
    expect(esDeLaCuenta({ mandateId: 'maria-device' }, {})).toBe(true);
    expect(esDeLaCuenta({ mandateId: 'maria-device' })).toBe(true);
  });
});
