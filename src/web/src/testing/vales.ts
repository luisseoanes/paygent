import {
  type DeviceCert,
  type Merchant,
  amount as A,
  generateKeyPair,
  keyPairFromSeed,
  signDeviceCert,
  toB64,
} from '@openroute/shared';

// Gateway, celular y tienda de prueba para los tests de vales sin señal.
export const gatewayDePrueba = keyPairFromSeed(
  toB64(new TextEncoder().encode('paygent-gateway-test-seed-32byte')),
);

export const tiendaDePrueba: Merchant = {
  id: 'tienda',
  name: 'Tienda Doña Rosa',
  wallet: 'https://ilp.interledger-test.dev/tienda-dona-rosa',
  category: 'mercado',
};

export const celularDePrueba = (topeUsd = 20) => {
  const keys = generateKeyPair();
  const now = new Date();
  const cert: DeviceCert = signDeviceCert(
    {
      certId: 'cert_test',
      deviceKeyId: 'dev_test',
      mandateId: 'maria-device',
      publicKey: keys.publicKey,
      offlineCap: A.usd(topeUsd),
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 3600_000).toISOString(),
    },
    gatewayDePrueba.secretKey,
  );
  return { keys, cert };
};
