import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import {
  amount as A,
  decodeVoucher,
  verifyVoucherOffline,
  type Merchant,
  type Voucher,
  type VoucherSettleResult,
} from '@openroute/shared'
import { api, useOnline } from '../lib/api.ts'
import { idb, type QueuedVoucher } from '../lib/store.ts'
import { FxNote, OnlineBadge, Page } from '../components/ui.tsx'

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
