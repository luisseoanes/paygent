import {
  signVoucher,
  verifyVoucherSignature,
  deviceCertificate,
  devicePublicKeyHex,
} from '../crypto';
import { createDemoTree } from '../demo-data';
import { applyDebit, canSpend, effectiveRemaining, lowerLimit } from '../rules';

test('a leaf never spends more than its branch or the root', () => {
  const tree = createDemoTree();
  expect(canSpend(tree, 'asistente', 41, 'farmacia').ok).toBe(false);
  expect(canSpend(tree, 'asistente', 3, 'farmacia').ok).toBe(true);
  expect(canSpend(tree, 'guardian', 0.01, 'mercado').ok).toBe(false);
});

test('a payment debits the leaf and every ancestor', () => {
  const tree = applyDebit(createDemoTree(), 'asistente', 3);
  expect(tree.asistente?.spent).toBe(3);
  expect(tree.root?.spent).toBe(3);
  expect(tree.maria?.spent).toBe(0);
  expect(effectiveRemaining(tree, 'inventario')).toBe(0.5);
});

test('limits can only go down (monotonicity)', () => {
  const tree = createDemoTree();
  expect(lowerLimit(tree, 'asistente', 60).asistente?.limit).toBe(40);
  expect(lowerLimit(tree, 'asistente', 25).asistente?.limit).toBe(25);
});

test('vouchers are signed and verified with real ed25519', () => {
  const signed = signVoucher({
    v: 1,
    id: 'vale_1',
    node: 'maria-key',
    usd: 4.5,
    cop: 18000,
    cat: 'mercado',
    iat: 1,
    exp: 2,
  });
  const base = {
    devicePublicKey: devicePublicKeyHex,
    certificate: deviceCertificate,
  };
  expect(verifyVoucherSignature({ ...signed, ...base })).toBe(true);
  const tampered = signed.signature.replace(
    /^./,
    signed.signature[0] === 'a' ? 'b' : 'a',
  );
  expect(
    verifyVoucherSignature({ ...signed, signature: tampered, ...base }),
  ).toBe(false);
});
