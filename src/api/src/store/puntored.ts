import { s, opt, iso, clean, type Row, type Sql } from './rows.ts'

// Acreditaciones de Puntored a los tenderos sin wallet (lo que sería su reporte de conciliación).

export interface CreditRow {
  id: string
  paymentId: string
  merchantId: string
  llave: string
  pesos: number
  comisionPesos: number
  estado: 'pendiente' | 'acreditado' | 'fallido'
  ref?: string
  motivo?: string
  creadoEn: string
  acreditadoEn?: string
}

const toCredit = (r: Row): CreditRow =>
  clean({
    id: r.id,
    paymentId: r.payment_id,
    merchantId: r.merchant_id,
    llave: r.llave,
    pesos: Number(r.pesos),
    comisionPesos: Number(r.comision_pesos),
    estado: r.estado,
    ref: opt(r.ref),
    motivo: opt(r.motivo),
    creadoEn: iso(r.creado_en),
    acreditadoEn: r.acreditado_en ? iso(r.acreditado_en) : undefined,
  })

/** false si ese pago ya tenía su acreditación (no se acredita dos veces). */
export const insertCredit = async (c: Pick<CreditRow, 'id' | 'paymentId' | 'merchantId' | 'llave' | 'pesos' | 'comisionPesos'>, conn?: Sql) =>
  (
    await s(conn).query(
      `insert into puntored_credits (id, payment_id, merchant_id, llave, pesos, comision_pesos, estado)
       values ($1, $2, $3, $4, $5, $6, 'pendiente') on conflict (payment_id) do nothing returning id`,
      [c.id, c.paymentId, c.merchantId, c.llave, c.pesos, c.comisionPesos],
    )
  ).length > 0

export const settleCredit = async (id: string, r: { estado: 'acreditado' | 'fallido'; ref?: string; motivo?: string }, conn?: Sql) => {
  await s(conn).query(
    `update puntored_credits set estado = $2, ref = $3, motivo = $4, acreditado_en = case when $2 = 'acreditado' then now() end where id = $1`,
    [id, r.estado, r.ref ?? null, r.motivo ?? null],
  )
}

export const creditsOfMerchant = async (merchantId: string, conn?: Sql) =>
  (await s(conn).query(`select * from puntored_credits where merchant_id = $1 order by creado_en desc`, [merchantId])).map(toCredit)
