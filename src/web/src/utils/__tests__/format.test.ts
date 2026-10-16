import { formatCurrency, formatNumber } from '../format';

test('formatCurrency includes the amount', () => {
  expect(formatCurrency(1234.5, 'USD')).toMatch(/1.?234/);
});

test('formatNumber formats integers', () => {
  expect(formatNumber(1000)).toMatch(/1.?000/);
});
