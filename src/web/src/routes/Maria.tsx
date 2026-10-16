import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  amount as A,
  encodeVoucher,
  generateKeyPair,
  randomId,
  signVoucher,
  type Amount,
  type Category,
  type DeviceCert,
  type Merchant,
  type Voucher,
} from '@openroute/shared'
import { api, useOnline, type DemoStatus } from '../lib/api.ts'
import { idb, type DeviceState } from '../lib/store.ts'
import { FxNote, OnlineBadge, Page } from '../components/ui.tsx'

const MANDATE_ID = 'maria-device' // TODO FE-03: vincular con un código en vez de fijo
const KEY = 'maria-device'

export default function Maria() {
  const online = useOnline()
  const [dev, setDev] = useState<DeviceState | null>(null)
  const [remaining, setRemaining] = useState<Amount | null>(null)
  const [fx, setFx] = useState(4000)
  const [merchantId, setMerchantId] = useState('')
  const [cop, setCop] = useState(20000)
  const [voucher, setVoucher] = useState<Voucher | null>(null)
  const [error, setError] = useState('')

  const save = async (next: DeviceState) => {
    await idb.set(KEY, next)
    setDev(next)
  }

  useEffect(() => {
    idb.get<DeviceState>(KEY).then((d) => d && setDev(d))
    const cachedFx = localStorage.getItem('fx')
    if (cachedFx) setFx(Number(cachedFx))
  }, [])

  // OFF-04: genera el par de llaves en el celular y pide un certificado al gateway.
  const link = async (existing?: DeviceState | null) => {
    setError('')
    try {
      const keys = existing ?? { ...generateKeyPair(), cert: null, counter: 0, cumulativeCents: 0, gatewayPublicKey: '', merchants: [] }
      const res = await api<{ cert: DeviceCert; gatewayPublicKey: string }>(`/mandates/${MANDATE_ID}/device-key`, {
        json: { publicKey: keys.publicKey },
      })
      const merchants = (await api<Merchant[]>('/merchants')).filter((m) => !m.isAgent)
      await save({ ...keys, cert: res.cert, gatewayPublicKey: res.gatewayPublicKey, merchants, counter: 0, cumulativeCents: 0 })
      if (!merchantId && merchants[0]) setMerchantId(merchants[0].id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Con señal: saldo real y certificado fresco (reinicia el tope offline consumido).
  useEffect(() => {
    if (!online || !dev?.cert) return
    api<{ remaining: Amount }>(`/mandates/${MANDATE_ID}`).then((m) => setRemaining(m.remaining)).catch(() => {})
    api<DemoStatus>('/demo/status')
      .then((s) => {
        setFx(s.fxCopPerUsd)
        localStorage.setItem('fx', String(s.fxCopPerUsd))
      })
      .catch(() => {})
    if (dev.counter > 0) link(dev)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, dev?.cert?.certId])

  useEffect(() => {
    if (dev?.merchants[0] && !merchantId) setMerchantId(dev.merchants[0].id)
  }, [dev, merchantId])

  // Firma el vale SIN conexión.
  const createVoucher = async () => {
    setError('')
    if (!dev?.cert) return
    const merchant = dev.merchants.find((m) => m.id === merchantId)
    if (!merchant) return
    const amount = A.copToUsd(cop, fx)
    const cumulativeCents = dev.cumulativeCents + Number(amount.value)
    if (cumulativeCents > Number(dev.cert.offlineCap.value)) {
      setError(`Supera tu tope sin señal (${A.format(dev.cert.offlineCap)}). Conéctate para renovarlo.`)
      return
    }
    const counter = dev.counter + 1
    const v = signVoucher(
      {
        voucherId: randomId('v_'),
        deviceKeyId: dev.cert.deviceKeyId,
        deviceCert: dev.cert,
        merchantWallet: merchant.wallet,
        category: merchant.category as Category,
        amount,
        counter,
        cumulative: A.USD(cumulativeCents),
        createdAt: new Date().toISOString(),
      },
      dev.secretKey,
    )
    await save({ ...dev, counter, cumulativeCents })
    setVoucher(v)
  }

  const offlineLeft = dev?.cert ? A.USD(Number(dev.cert.offlineCap.value) - dev.cumulativeCents) : null

  return (
    <Page title="María" right={<OnlineBadge online={online} />}>
      {error && <div className="rounded-xl bg-rose-100 p-3 text-sm text-rose-800">{error}</div>}

      {!dev?.cert ? (
        <div className="card space-y-3">
          <p>Este celular todavía no está vinculado.</p>
          <button className="btn" disabled={!online} onClick={() => link()}>
            Vincular este celular
          </button>
        </div>
      ) : (
        <>
          <div className="card grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-slate-500">Disponible este mes</p>
              <p className="text-lg font-semibold">{remaining ? A.formatCop(A.usdToCop(remaining, fx)) : '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Sin señal puedo gastar</p>
              <p className="text-lg font-semibold">{offlineLeft ? A.formatCop(A.usdToCop(offlineLeft, fx)) : '—'}</p>
            </div>
          </div>

          <div className="card space-y-3">
            <label className="block text-sm">
              ¿Dónde pagas?
              <select className="input" value={merchantId} onChange={(e) => setMerchantId(e.target.value)}>
                {dev.merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Valor (COP)
              <input className="input text-2xl" type="number" step={1000} value={cop} onChange={(e) => setCop(Number(e.target.value))} />
            </label>
            <button className="btn w-full" onClick={createVoucher}>
              Generar QR de pago
            </button>
            <FxNote fx={fx} />
          </div>

          {voucher && (
            <div className="card flex flex-col items-center gap-2">
              <QRCodeSVG value={encodeVoucher(voucher)} size={300} level="L" marginSize={2} />
              <p className="text-sm">
                Vale #{voucher.counter} · {A.formatCop(A.usdToCop(voucher.amount, fx))}
              </p>
              <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(encodeVoucher(voucher))}>
                Copiar vale (para probar en el computador)
              </button>
            </div>
          )}
        </>
      )}
    </Page>
  )
}
