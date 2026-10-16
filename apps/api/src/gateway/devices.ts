import { randomId, signDeviceCert, type DeviceCert } from '@openroute/shared'
import { db, save } from '../db.ts'
import { badRequest, forbidden } from './errors.ts'
import { gatewayKey } from './keys.ts'
import { getMandate } from './mandates.ts'

const CERT_TTL_MS = 7 * 24 * 3600_000

/**
 * OFF-02: registra (o reutiliza) la llave pública del celular y emite un certificado nuevo.
 * Cada certificado arranca su contador y su acumulado en cero: el celular pide uno nuevo cada vez que tiene señal.
 */
export const issueDeviceCert = (mandateId: string, publicKey: string): DeviceCert => {
  const m = getMandate(mandateId)
  if (m.holderType !== 'device') throw badRequest('El mandato no es de un dispositivo')
  if (m.revoked || m.frozen) throw forbidden('El mandato del dispositivo está revocado o congelado')
  if (!m.offlineCap) throw badRequest('El mandato no tiene tope offline')

  let device = Object.values(db.devices).find((d) => d.publicKey === publicKey && d.mandateId === mandateId)
  if (!device) {
    device = { deviceKeyId: randomId('dev_'), mandateId, publicKey }
    db.devices[device.deviceKeyId] = device
  }
  const now = new Date()
  const cert = signDeviceCert(
    {
      certId: randomId('cert_'),
      deviceKeyId: device.deviceKeyId,
      mandateId,
      publicKey,
      offlineCap: m.offlineCap,
      issuedAt: now.toISOString(),
      expiresAt: new Date(Math.min(now.getTime() + CERT_TTL_MS, new Date(m.expiresAt).getTime())).toISOString(),
    },
    gatewayKey.secretKey,
  )
  db.certs[cert.certId] = cert
  save()
  return cert
}
