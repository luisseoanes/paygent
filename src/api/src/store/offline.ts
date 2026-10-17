import type { DeviceCert, Voucher } from '@openroute/shared'
import { s, j, opt, iso, clean, type Row, type Sql } from './rows.ts'

// Modo sin señal: llaves de los celulares, certificados y vales presentados.

export interface DeviceKey {
  deviceKeyId: string
  mandateId: string
  publicKey: string
}

export interface StoredVoucher {
  voucher: Voucher
  status: 'settled' | 'rejected' | 'flagged'
  reason?: string
  paymentId?: string
  receivedAt: string
}

export const findDevice = async (mandateId: string, publicKey: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from device_keys where mandate_id = $1 and public_key = $2`, [mandateId, publicKey])
  return r ? ({ deviceKeyId: r.device_key_id, mandateId: r.mandate_id, publicKey: r.public_key } as DeviceKey) : undefined
}
export const insertDevice = async (d: DeviceKey, conn?: Sql) => {
  await s(conn).query(`insert into device_keys (device_key_id, mandate_id, public_key) values ($1, $2, $3)`, [d.deviceKeyId, d.mandateId, d.publicKey])
}
export const insertCert = async (c: DeviceCert, conn?: Sql) => {
  await s(conn).query(`insert into device_certs (cert_id, device_key_id, mandate_id, cert) values ($1, $2, $3, $4::jsonb)`, [
    c.certId,
    c.deviceKeyId,
    c.mandateId,
    j(c),
  ])
}
export const getCert = async (certId: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select cert from device_certs where cert_id = $1`, [certId])
  return r ? (r.cert as DeviceCert) : undefined
}

const toVoucher = (r: Row): StoredVoucher =>
  clean({ voucher: r.voucher, status: r.status, reason: opt(r.reason), paymentId: opt(r.payment_id), receivedAt: iso(r.received_at) })

export const getVoucher = async (key: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from vouchers where key = $1`, [key])
  return r ? toVoucher(r) : undefined
}
export const putVoucher = async (key: string, v: StoredVoucher, conn?: Sql) => {
  await s(conn).query(
    `insert into vouchers (key, voucher, device_key_id, mandate_id, status, reason, payment_id, received_at)
     values ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
     on conflict (key) do update set voucher = $2::jsonb, status = $5, reason = $6, payment_id = $7, received_at = $8`,
    [key, j(v.voucher), v.voucher.deviceKeyId, v.voucher.deviceCert.mandateId, v.status, v.reason ?? null, v.paymentId ?? null, v.receivedAt],
  )
}
export const listVouchers = async (conn?: Sql) => (await s(conn).query(`select * from vouchers order by received_at desc`)).map(toVoucher)
export const vouchersOfDevices = async (deviceKeyIds: string[], conn?: Sql) =>
  (await s(conn).query(`select * from vouchers where device_key_id = any($1::text[])`, [deviceKeyIds])).map(toVoucher)
export const vouchersOfMandate = async (mandateId: string, conn?: Sql) =>
  (await s(conn).query(`select * from vouchers where mandate_id = $1`, [mandateId])).map(toVoucher)


/** Todos los certificados emitidos, por id (el decodificador de vales por SMS los busca de forma síncrona). */
export const certsById = async (conn?: Sql) =>
  new Map((await s(conn).query(`select cert_id, cert from device_certs`)).map((r) => [r.cert_id as string, r.cert as DeviceCert]))
