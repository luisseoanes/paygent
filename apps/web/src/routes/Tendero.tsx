import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import {
  amount as A,
  decodeVoucher,
  verifyVoucherOffline,
  type Merchant,
  type Payment,
  type Payout,
  type Voucher,
  type VoucherSettleResult,
} from '@openroute/shared'
import { api, useOnline } from '../lib/api.ts'
import { idb, type QueuedVoucher } from '../lib/store.ts'
import { FxNote, OnlineBadge, Page } from '../components/ui.tsx'
import { maskKey } from '../components/Feed.tsx'

const STATUS = {
  pending: '⏳ por liquidar',
  settled: '✅ liquidado',
  flagged: '⚠️ liquidado con alerta',
  rejected: '❌ rechazado',
}

export default function Tendero() {
  const online = useOnline()
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [me, setMe] = useState<string>('')
  const [gatewayKey, setGatewayKey] = useState('')
  const [queue, setQueue] = useState<QueuedVoucher[]>([])
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null)
  const [paste, setPaste] = useState('')
  const [scanning, setScanning] = useState(false)
  const [fx, setFx] = useState(4000)
  const queueRef = useRef(queue)
  queueRef.current = queue

  const saveQueue = async (q: QueuedVoucher[]) => {
    setQueue(q)
    await idb.set('tendero-queue', q)
  }

  // Carga lo cacheado (funciona en modo avión) y refresca si hay señal.
  useEffect(() => {
    ;(async () => {
      setMerchants((await idb.get<Merchant[]>('tendero-merchants')) ?? [])
      setMe((await idb.get<string>('tendero-me')) ?? '')
      setGatewayKey((await idb.get<string>('gateway-key')) ?? '')
      setQueue((await idb.get<QueuedVoucher[]>('tendero-queue')) ?? [])
      if (navigator.onLine) {
        try {
          const ms = (await api<Merchant[]>('/merchants')).filter((m) => !m.isAgent)
          const { publicKey } = await api<{ publicKey: string }>('/gateway/public-key')
          const { fxCopPerUsd } = await api<{ fxCopPerUsd: number }>('/demo/status')
          setMerchants(ms)
          setGatewayKey(publicKey)
          setFx(fxCopPerUsd)
          await idb.set('tendero-merchants', ms)
          await idb.set('gateway-key', publicKey)
        } catch {
          /* sin api: seguimos con la caché */
        }
      }
    })()
  }, [])

  const myMerchant = merchants.find((m) => m.id === me)

  // Cómo cobra: directo a su wallet de Open Payments o, si no tiene, por Puntored a su llave Bre-B.
  const [payoutVia, setPayoutVia] = useState<Payout['via']>('puntored')
  const [payoutValue, setPayoutValue] = useState('')
  useEffect(() => {
    const p = myMerchant?.payout
    setPayoutVia(p?.via ?? 'wallet')
    setPayoutValue(p?.via === 'puntored' ? p.llave : p?.via === 'wallet' ? p.wallet : (myMerchant?.wallet ?? ''))
  }, [myMerchant])

  const savePayout = async () => {
    if (!myMerchant) return
    const body: Payout = payoutVia === 'puntored' ? { via: 'puntored', llave: payoutValue } : { via: 'wallet', wallet: payoutValue }
    try {
      const updated = await api<Merchant>(`/merchants/${myMerchant.id}/payout`, { method: 'PUT', json: body })
      const ms = merchants.map((m) => (m.id === updated.id ? updated : m))
      setMerchants(ms)
      await idb.set('tendero-merchants', ms)
      setLast({ ok: true, text: payoutVia === 'puntored' ? 'Cobrarás por Puntored' : 'Cobrarás directo a tu wallet' })
    } catch (e) {
      setLast({ ok: false, text: (e as Error).message })
    }
  }

  // Pedidos pagados por el Asistente: para recoger o para llevar a la casa que registró Juan.
  const [orders, setOrders] = useState<Payment[]>([])
  useEffect(() => {
    if (!me || !online) return
    const load = () => api<Payment[]>(`/merchants/${me}/orders`).then(setOrders).catch(() => {})
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [me, online])

  // OFF-05: verificación 100% offline.
  const accept = useCallback(
    async (raw: string) => {
      let v: Voucher
      try {
        v = decodeVoucher(raw.trim())
      } catch {
        return setLast({ ok: false, text: 'QR ilegible' })
      }
      if (!gatewayKey) return setLast({ ok: false, text: 'Abre esta página con señal una vez para descargar la llave del gateway' })
      const check = verifyVoucherOffline(v, gatewayKey)
      if (!check.ok) return setLast({ ok: false, text: check.reason })
      if (myMerchant && v.merchantWallet !== myMerchant.wallet) return setLast({ ok: false, text: 'El vale es para otro comercio' })
      const dup = queueRef.current.some((q) => q.voucher.deviceCert.certId === v.deviceCert.certId && q.voucher.counter === v.counter)
      if (dup) return setLast({ ok: false, text: 'Este vale ya fue recibido' })
      await saveQueue([{ voucher: v, status: 'pending', scannedAt: new Date().toISOString() }, ...queueRef.current])
      setLast({ ok: true, text: `Vale válido por ${A.formatCop(A.usdToCop(v.amount, fx))}` })
    },
    [gatewayKey, myMerchant, fx],
  )

  // OFF-06: al volver la señal, liquida la cola sola.
  const sync = useCallback(async () => {
    const pending = queueRef.current.filter((q) => q.status === 'pending')
    if (!pending.length) return
    try {
      const { results } = await api<{ results: VoucherSettleResult[] }>('/vouchers/settle', {
        json: { vouchers: pending.map((p) => p.voucher) },
      })
      await saveQueue(
        queueRef.current.map((q) => {
          const r = results.find((x) => x.voucherId === q.voucher.voucherId)
          return r && q.status === 'pending' ? { ...q, status: r.status, reason: r.reason } : q
        }),
      )
    } catch (e) {
      setLast({ ok: false, text: `No se pudo liquidar: ${(e as Error).message}` })
    }
  }, [])

  useEffect(() => {
    if (online) sync()
  }, [online, sync, queue.length])

  // OFF-08: botón de demo para reenviar un vale ya liquidado (doble gasto).
  const replay = async (v: Voucher) => {
    const { results } = await api<{ results: VoucherSettleResult[] }>('/vouchers/settle', { json: { vouchers: [v] } })
    setLast({ ok: false, text: `Reenvío: ${results[0].status} (${results[0].reason ?? ''})` })
  }

  useEffect(() => {
    if (!scanning) return
    const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 260 }, false)
    scanner.render(
      (text) => {
        accept(text)
        setScanning(false)
      },
      () => {},
    )
    return () => {
      scanner.clear().catch(() => {})
    }
  }, [scanning, accept])

  const total = queue.filter((q) => q.status !== 'rejected').reduce((s, q) => s + A.usdToCop(q.voucher.amount, fx), 0)

  return (
    <Page title="Tendero" right={<OnlineBadge online={online} />}>
      <div className="card space-y-2">
        <label className="block text-sm">
          Mi comercio
          <select
            className="input"
            value={me}
            onChange={async (e) => {
              setMe(e.target.value)
              await idb.set('tendero-me', e.target.value)
            }}
          >
            <option value="">— elegir —</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {myMerchant && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            <p>
              Cobras:{' '}
              <b>
                {myMerchant.payout?.via === 'puntored'
                  ? `por Puntored a tu llave Bre-B ${maskKey(myMerchant.payout.llave)}`
                  : 'directo a tu wallet de Open Payments'}
              </b>
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <select className="input w-auto" value={payoutVia} onChange={(e) => setPayoutVia(e.target.value as Payout['via'])}>
                <option value="wallet">Tengo wallet</option>
                <option value="puntored">No tengo wallet: Puntored</option>
              </select>
              <input
                className="input grow"
                placeholder={payoutVia === 'puntored' ? 'Llave Bre-B (celular de 10 dígitos)' : 'https://… (tu wallet)'}
                value={payoutValue}
                onChange={(e) => setPayoutValue(e.target.value)}
              />
              <button className="btn-ghost" disabled={!online} onClick={savePayout}>
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>

      {last && (
        <div className={`rounded-2xl p-6 text-center text-xl font-bold ${last.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {last.ok ? '✓' : '✗'} {last.text}
        </div>
      )}

      <div className="card space-y-3">
        <button className="btn w-full" onClick={() => setScanning((s) => !s)}>
          {scanning ? 'Cerrar cámara' : '📷 Escanear QR de María'}
        </button>
        {scanning && <div id="reader" />}
        <details>
          <summary className="cursor-pointer text-sm text-slate-500">Pegar vale (pruebas en el computador)</summary>
          <textarea className="input mt-2 h-20 font-mono text-xs" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button className="btn-ghost mt-2" onClick={() => accept(paste)}>
            Verificar
          </button>
        </details>
      </div>

      {orders.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Pedidos ya pagados</h2>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl bg-slate-50 p-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{o.delivery?.mode === 'delivery' ? '🛵 Llevar' : '🏪 Recoge en tienda'}</span>
                  <span>{A.formatCop(A.usdToCop(o.amount, fx))}</span>
                </div>
                <p className="text-slate-600">{o.reason}</p>
                {o.delivery?.mode === 'delivery' && (
                  <p className="text-slate-600">
                    Para {o.delivery.recipientName}: {o.delivery.address}
                  </p>
                )}
                <p className="text-xs text-slate-500">Pida el código {o.delivery?.code} al entregar</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Recibido: {A.formatCop(total)}</h2>
          <button className="btn-ghost" disabled={!online} onClick={sync}>
            Liquidar ahora
          </button>
        </div>
        <FxNote fx={fx} />
        <div className="mt-2 space-y-2">
          {queue.map((q) => (
            <div key={q.voucher.voucherId} className="flex items-center justify-between rounded-xl bg-slate-50 p-2 text-sm">
              <span>
                #{q.voucher.counter} · {A.formatCop(A.usdToCop(q.voucher.amount, fx))}
                <span className="ml-2 text-slate-500">{STATUS[q.status]}</span>
                {q.reason && <span className="block text-xs text-rose-700">{q.reason}</span>}
              </span>
              {q.status !== 'pending' && (
                <button className="btn-ghost text-xs" disabled={!online} onClick={() => replay(q.voucher)}>
                  Reenviar (fraude)
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Page>
  )
}
