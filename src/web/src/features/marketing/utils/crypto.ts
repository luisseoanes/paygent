import nacl from 'tweetnacl';

// Criptografía real ed25519 para los vales offline (tweetnacl).
// Cadena de confianza: llave del gateway → certificado de la llave del
// dispositivo → firma del vale. El tendero la verifica sin red.

const encoder = new TextEncoder();
const decoder = new TextDecoder();
// Uint8Array del realm actual (tweetnacl usa instanceof; jsdom y Node difieren).
const utf8 = (value: string) => Uint8Array.from(encoder.encode(value));

export const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const fromHex = (hex: string) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const toBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

// Semillas fijas de la demo: así todas las pestañas y dispositivos comparten
// las mismas llaves sin backend. En producción la llave del dispositivo se
// genera en el celular de María y nunca sale de él.
const seedFrom = (label: string) => {
  const bytes = new Uint8Array(32);
  const source = utf8(label);
  for (let i = 0; i < 32; i += 1) {
    bytes[i] = (source[i % source.length] ?? 0) ^ (i * 31);
  }
  return bytes;
};

export const gatewayKeys = nacl.sign.keyPair.fromSeed(
  seedFrom('paygent-gateway-demo'),
);
export const deviceKeys = nacl.sign.keyPair.fromSeed(
  seedFrom('paygent-maria-device'),
);

export const gatewayPublicKeyHex = toHex(gatewayKeys.publicKey);
export const devicePublicKeyHex = toHex(deviceKeys.publicKey);

// El gateway firma la llave pública del dispositivo + su sub-mandato.
export const deviceCertificate = toHex(
  nacl.sign.detached(
    utf8(`device:${devicePublicKeyHex}:node:maria-key`),
    gatewayKeys.secretKey,
  ),
);

export type VoucherPayload = {
  v: 1;
  id: string;
  node: string;
  usd: number;
  cop: number;
  cat: string;
  iat: number;
  exp: number;
};

export const signVoucher = (payload: VoucherPayload) => {
  const bytes = utf8(JSON.stringify(payload));
  const signature = nacl.sign.detached(bytes, deviceKeys.secretKey);
  return {
    payload: toBase64Url(bytes),
    signature: toHex(signature),
  };
};

export const decodeVoucherPayload = (
  payload: string,
): VoucherPayload | null => {
  try {
    return JSON.parse(decoder.decode(fromBase64Url(payload))) as VoucherPayload;
  } catch {
    return null;
  }
};

// Verificación offline completa: certificado del dispositivo + firma del vale.
export const verifyVoucherSignature = ({
  payload,
  signature,
  devicePublicKey,
  certificate,
}: {
  payload: string;
  signature: string;
  devicePublicKey: string;
  certificate: string;
}) => {
  try {
    const certOk = nacl.sign.detached.verify(
      utf8(`device:${devicePublicKey}:node:maria-key`),
      fromHex(certificate),
      gatewayKeys.publicKey,
    );
    const sigOk = nacl.sign.detached.verify(
      fromBase64Url(payload),
      fromHex(signature),
      fromHex(devicePublicKey),
    );
    return certOk && sigOk;
  } catch {
    return false;
  }
};

// QR compacto: payload.firma
export const encodeVoucherQr = (payload: string, signature: string) =>
  `OR1.${payload}.${signature}`;

export const decodeVoucherQr = (value: string) => {
  const [prefix, payload, signature] = value.trim().split('.');
  if (prefix !== 'OR1' || !payload || !signature) return null;
  return { payload, signature };
};

// Llave demo de Juan: firma el mandato del hero en el navegador del visitante.
export const juanKeys = nacl.sign.keyPair.fromSeed(
  seedFrom('paygent-juan-demo'),
);

export const signMessageHex = (message: string) =>
  toHex(nacl.sign.detached(utf8(message), juanKeys.secretKey));

export const verifyMessageHex = (message: string, signatureHex: string) =>
  nacl.sign.detached.verify(
    utf8(message),
    fromHex(signatureHex),
    juanKeys.publicKey,
  );
