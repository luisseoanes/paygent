import { type MandateTree } from '@/types/api';

import {
  amountToNumber,
  buildInterval,
  disponibleParaDelegar,
  intervalLabel,
  nextRenewal,
  parseMoney,
  ramasDelegables,
  toAmount,
  usd,
} from '../mandate';

const rama = (id: string, max: number): MandateTree => ({
  id,
  parentId: null,
  holderType: 'person',
  holderId: id,
  holderName: id,
  maxDebit: usd(max),
  interval: 'R/2026-10-01T00:00:00Z/P1M',
  spentInPeriod: usd(0),
  categories: ['mercado'],
  canSpend: true,
  expiresAt: '2027-01-01T00:00:00Z',
  revoked: false,
  frozen: false,
  signature: '',
  children: [],
});

test('converts gateway amounts using their asset scale', () => {
  const amount = { value: '15050', assetCode: 'USD', assetScale: 2 };
  expect(amountToNumber(amount)).toBe(150.5);
  expect(toAmount(20, amount)).toEqual({ ...amount, value: '2000' });
});

test('reads ISO 8601 repeating intervals', () => {
  expect(intervalLabel('R/2026-10-01T00:00:00Z/P1M')).toBe('/ mes');
  expect(intervalLabel('R/2026-10-01T00:00:00Z/PT5M')).toBe('cada 5 min');
  expect(
    nextRenewal(
      'R/2026-10-01T00:00:00Z/P1M',
      new Date('2026-10-16T00:00:00Z'),
    )?.toISOString(),
  ).toBe('2026-11-01T00:00:00.000Z');
});

test('builds the interval the root grant asks for', () => {
  const now = new Date('2026-10-16T15:30:00Z');
  expect(buildInterval('mes', now)).toBe('R/2026-10-01T00:00:00.000Z/P1M');
  expect(buildInterval('demo', now)).toBe('R/2026-10-16T15:30:00.000Z/PT5M');
  expect(parseMoney('12,50')).toBe(12.5);
  expect(parseMoney('')).toBeNaN();
});

test('only lets a branch hand out what its active children leave', () => {
  const root = {
    ...rama('root', 300),
    children: [rama('a', 150), { ...rama('b', 100), revoked: true }],
  };
  expect(disponibleParaDelegar(root)).toBe(150);
  expect(ramasDelegables(root).map((n) => n.id)).toEqual(['root', 'a']);
});

test('parses Colombian thousands separators', () => {
  expect(parseMoney('1.200.000')).toBe(1_200_000);
  expect(parseMoney('40.000')).toBe(40_000);
  expect(parseMoney('12,50')).toBe(12.5);
  expect(parseMoney('12.50')).toBe(12.5);
});
