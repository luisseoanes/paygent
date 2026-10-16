import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { amount as A, monthly, type DeliveryAddress, type MandateNode } from '@openroute/shared'
import { agents, api, useFeed, type DemoStatus } from '../lib/api.ts'
import { Feed } from '../components/Feed.tsx'
import { MandateTree } from '../components/MandateTree.tsx'
import { Page } from '../components/ui.tsx'

const INTERVALS = {
  'Mensual (real)': () => monthly(),
  'Cada 5 min (demo)': () => `R/${new Date().toISOString()}/PT5M`,
}

export default function Juan() {
  const [params] = useSearchParams()
  const embed = params.has('embed')
  const feed = useFeed()
  const [tree, setTree] = useState<MandateNode | null>(null)
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [maxUsd, setMaxUsd] = useState(300)
  const [interval, setRenewal] = useState<keyof typeof INTERVALS>('Mensual (real)')
  const [intent, setIntent] = useState('Hasta 300 dólares al mes para mi mamá y María; medicinas sin preguntar hasta 10 dólares')
  const [summary, setSummary] = useState('')
  const [msg, setMsg] = useState('')
  const [address, setAddress] = useState<DeliveryAddress>({ recipientName: '', address: '' })

  useEffect(() => {
    api<DeliveryAddress | null>('/delivery-address/root').then((a) => a && setAddress(a))
  }, [])

  // Solo Juan registra a dónde llegan los domicilios: el agente no puede cambiarla.
  const saveAddress = () => api('/delivery-address/root', { method: 'PUT', json: address })

  const refresh = useCallback(async () => {
    setTree(await api<MandateNode>('/mandates/root/tree'))
    setStatus(await api<DemoStatus>('/demo/status'))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, feed.length])

  useEffect(() => {
    if (params.get('ok') === '1') setMsg('✅ Mandato aprobado en tu billetera')
    if (params.get('ok') === '0') setMsg(`❌ No se aprobó el mandato ${params.get('error') ?? ''}`)
  }, [params])

  // OP-02: el consentimiento real ocurre en la billetera de Juan.
  const approve = async (usd: number) => {
    const { redirectUrl } = await api<{ redirectUrl: string }>('/mandates/root', {
      json: { maxDebit: A.usd(usd), interval: INTERVALS[interval]() },
    })
    window.location.href = redirectUrl
  }

  // INT-01/02: frase → árbol propuesto. TODO INT-02: crear los sub-mandatos del árbol tras el callback.
  const compile = async () => {
    try {
      const r = await agents<{ tree: { maxUsd: number }; summary: string }>('/intent/compile', { json: { text: intent } })
      setSummary(r.summary)
      setMaxUsd(r.tree.maxUsd)
    } catch (e) {
      setSummary(`⚠️ ${(e as Error).message}`)
    }
  }

  const act = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn()
    } catch (e) {
      setMsg(`⚠️ ${(e as Error).message}`)
    }
    refresh()
  }

  return (
    <Page title="Juan">
      {msg && <div className="card text-sm">{msg}</div>}
      {status?.mockOp && (
        <div className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
          ⚠️ MOCK_OP=1: Open Payments simulado. Nunca en la demo.
        </div>
      )}

      {!embed && (
        <section className="card space-y-3">
          <h2 className="font-semibold">1. ¿Qué quieres autorizar?</h2>
          <textarea className="input h-20" value={intent} onChange={(e) => setIntent(e.target.value)} />
          <button className="btn-ghost" onClick={compile}>
            Proponer árbol
          </button>
          {summary && <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs">{summary}</pre>}
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              Tope (USD)
              <input className="input" type="number" value={maxUsd} onChange={(e) => setMaxUsd(Number(e.target.value))} />
            </label>
            <label className="text-sm">
              Renovación
              <select className="input" value={interval} onChange={(e) => setRenewal(e.target.value as keyof typeof INTERVALS)}>
                {Object.keys(INTERVALS).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <button className="btn" onClick={act(() => approve(maxUsd))}>
              Aprobar en mi billetera
            </button>
          </div>
          <p className="text-xs text-slate-500">Grant raíz: {status?.rootGrant ? '✅ activo' : '— sin aprobar'}</p>
        </section>
      )}

      {!embed && (
        <section className="card space-y-3">
          <h2 className="font-semibold">2. ¿A dónde llevan los pedidos?</h2>
          <p className="text-sm text-slate-500">
            Cuando el asistente compra con domicilio, la tienda lo lleva aquí. El envío se paga junto con el producto.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              Quién recibe
              <input
                className="input"
                value={address.recipientName}
                onChange={(e) => setAddress({ ...address, recipientName: e.target.value })}
              />
            </label>
            <label className="grow text-sm">
              Dirección
              <input className="input" value={address.address} onChange={(e) => setAddress({ ...address, address: e.target.value })} />
            </label>
            <button className="btn" onClick={act(saveAddress)}>
              Guardar dirección
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Árbol de mandatos</h2>
            <button className="btn-ghost" onClick={act(() => api('/guardian/review', { method: 'POST' }))}>
              🛡️ Revisar topes
            </button>
          </div>
          {tree && (
            <MandateTree
              node={tree}
              onRevoke={(id) => act(() => api(`/mandates/${id}/revoke`, { method: 'POST' }))()}
              onUnfreeze={(id) => act(() => api(`/mandates/${id}/unfreeze`, { method: 'POST' }))()}
            />
          )}
        </section>
        <section className="card">
          <h2 className="mb-2 font-semibold">Feed en vivo</h2>
          <Feed events={feed} />
        </section>
      </div>

      {!embed && (
        <button
          className="btn-ghost"
          onClick={act(async () => {
            await api('/demo/reset', { json: {} })
            await agents('/assistant/reset', { json: {} }).catch(() => {})
          })}
        >
          ↺ Reset demo
        </button>
      )}
    </Page>
  )
}
