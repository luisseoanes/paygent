import { randomId, signDeviceCert, type DeviceCert } from '@openroute/shared'
import { findDevice, insertCert, insertDevice } from '../db.ts'
import { badRequest, forbidden } from './errors.ts'
import { gatewayKey } from './keys.ts'
import { getMandate } from './mandates.ts'

const CERT_TTL_MS = 7 * 24 * 3600_000

/**
 * Tope sin señal: el titular fija el TECHO (lo máximo que acepta perder sin señal) y el celular arranca con el 40 %.
 * El Guardián lo sube con buen uso y lo baja con alertas, siempre entre el 10 % y el techo.
 */
export const OFFLINE_START_PCT = 40

/**
 * OFF-02: registra (o reutiliza) la llave pública del celular y emite un certificado nuevo.
 * Cada certificado arranca su contador y su acumulado en cero: el celular pide uno nuevo cada vez que tiene señal.
 */
export const issueDeviceCert = async (mandateId: string, publicKey: string): Promise<DeviceCert> => {
  const m = await getMandate(mandateId)
  if (m.holderType !== 'device') throw badRequest('El mandato no es de un dispositivo')
  if (m.revoked || m.frozen) throw forbidden('El mandato del dispositivo está revocado o congelado')
  if (!m.offlineCap) throw badRequest('El mandato no tiene tope offline')

  let device = await findDevice(mandateId, publicKey)
  if (!device) {
    device = { deviceKeyId: randomId('dev_'), mandateId, publicKey }
    await insertDevice(device)
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
  await insertCert(cert)
  return cert
}
