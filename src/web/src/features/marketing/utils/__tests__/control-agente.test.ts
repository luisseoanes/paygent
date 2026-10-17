import { evaluarIntentos, gastoAprobado } from '../control-agente';

const intentos = [
  { que: 'Losartán', monto: 3, categoria: 'farmacia' },
  { que: 'Insulina', monto: 22, categoria: 'farmacia' },
  { que: 'Mercado', monto: 35, categoria: 'mercado' },
  { que: 'Licor', monto: 8, categoria: 'licor' },
];
const categorias = ['farmacia', 'mercado'];

test('approves within the monthly limit and asks for a PIN above $10', () => {
  const r = evaluarIntentos(intentos, {
    tope: 40,
    periodo: 'mes',
    estado: 'activa',
    categorias,
  });
  expect(r.map((x) => x.veredicto)).toEqual([
    { tipo: 'aprobado', conPin: false },
    { tipo: 'aprobado', conPin: true },
    { tipo: 'rechazado', motivo: 'Pasa el tope del mes' },
    { tipo: 'rechazado', motivo: 'Fuera de sus categorías' },
  ]);
  expect(gastoAprobado(r)).toBe(25);
});

test('a per-purchase limit checks each payment on its own', () => {
  const r = evaluarIntentos(intentos, {
    tope: 30,
    periodo: 'compra',
    estado: 'activa',
    categorias,
  });
  expect(r[1]!.veredicto).toEqual({ tipo: 'aprobado', conPin: true });
  expect(r[2]!.veredicto).toEqual({
    tipo: 'rechazado',
    motivo: 'Pasa el tope por compra',
  });
});

test('a frozen or revoked branch rejects every payment', () => {
  for (const estado of ['congelada', 'revocada'] as const) {
    const r = evaluarIntentos(intentos, {
      tope: 100,
      periodo: 'mes',
      estado,
      categorias,
    });
    expect(r.every((x) => x.veredicto.tipo === 'rechazado')).toBe(true);
    expect(gastoAprobado(r)).toBe(0);
  }
});
