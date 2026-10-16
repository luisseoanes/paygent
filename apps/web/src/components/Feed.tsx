import { amount as A, type FeedEvent } from '@openroute/shared'

export const maskKey = (llave: string) => (llave.length > 6 ? `${llave.slice(0, 3)}•••${llave.slice(-4)}` : llave)

const STYLE: Record<FeedEvent['kind'], { icon: string; cls: string }> = {
  payment: { icon: '💸', cls: 'bg-white' },
  agent_to_agent: { icon: '🤖→🤖', cls: 'bg-violet-50 ring-violet-300' }, // INV-04: estilo propio
  voucher_settled: { icon: '🎟️', cls: 'bg-sky-50' },
  guardian: { icon: '🛡️', cls: 'bg-amber-50 ring-amber-300' },
  revoked: { icon: '⛔', cls: 'bg-rose-50' },
  denied: { icon: '✋', cls: 'bg-rose-50' },
  grant: { icon: '✅', cls: 'bg-emerald-50' },
}

export const Feed = ({ events }: { events: FeedEvent[] }) => (
  <div className="space-y-2">
    {events.length === 0 && <p className="text-sm text-slate-500">Sin movimientos todavía.</p>}
    {events.map((e) => (
      <div key={e.id} className={`rounded-xl p-3 text-sm ring-1 ring-slate-200 ${STYLE[e.kind].cls}`}>
        <div className="flex justify-between gap-2">
          <span className="font-semibold">
            {STYLE[e.kind].icon} {e.actor.name}
            {e.merchant ? <span className="font-normal"> → {e.merchant}</span> : null}
          </span>
          <span className="shrink-0 text-slate-500">{e.amount ? A.format(e.amount) : ''}</span>
        </div>
        {e.reason && <p className="mt-1 text-slate-600">{e.reason}</p>}
        {e.payout?.via === 'puntored' && (
          <p className="mt-1 text-xs text-slate-600">
            🏪 Sin wallet: cobra por Puntored → llave Bre-B {maskKey(e.payout.llave)} (acreditación final simulada)
          </p>
        )}
        {e.delivery && (
          <p className="mt-1 text-xs text-slate-600">
            {e.delivery.mode === 'delivery'
              ? `🛵 Domicilio a casa de ${e.delivery.recipientName} · ${e.delivery.address}`
              : '🏪 Para recoger en el comercio'}
            {' · código '}
            {e.delivery.code}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">{new Date(e.at).toLocaleTimeString('es-CO')}</p>
      </div>
    ))}
  </div>
)
