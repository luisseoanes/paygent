import { amount as A, type MandateNode } from '@openroute/shared'
import { Bar } from './ui.tsx'

const ICON = { person: '👤', device: '📱', agent: '🤖' } as const

interface Props {
  node: MandateNode
  onRevoke: (id: string) => void
  onUnfreeze: (id: string) => void
  depth?: number
}

/** FE-02: árbol visual con gasto por rama y revocación por rama. */
export const MandateTree = ({ node, onRevoke, onUnfreeze, depth = 0 }: Props) => {
  const spent = A.toNumber(node.spentInPeriod)
  const max = A.toNumber(node.maxDebit)
  const off = node.revoked
  return (
    <div className={depth ? 'ml-4 border-l-2 border-slate-200 pl-3' : ''}>
      <div className={`my-2 rounded-xl p-3 ring-1 ring-slate-200 ${off ? 'bg-slate-100 opacity-60' : 'bg-white'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">
              {ICON[node.holderType]} {node.holderName}
              {node.revoked && <span className="ml-2 text-xs text-rose-700">REVOCADO</span>}
              {node.frozen && <span className="ml-2 text-xs text-amber-700">CONGELADO</span>}
            </p>
            <p className="text-xs text-slate-500">
              {node.categories.join(' · ')}
              {node.pinThreshold && ` · PIN si > ${A.format(node.pinThreshold)}`}
              {node.offlineCap && ` · sin señal hasta ${A.format(node.offlineCap)}`}
              {!node.canSpend && ' · solo puede restringir'}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {node.frozen && !node.revoked && (
              <button className="btn-ghost" onClick={() => onUnfreeze(node.id)}>
                Descongelar
              </button>
            )}
            {!node.revoked && (
              <button className="btn-ghost text-rose-700" onClick={() => onRevoke(node.id)}>
                Revocar
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <Bar value={spent} max={max} />
          <span className="shrink-0">
            {A.format(node.spentInPeriod)} / {A.format(node.maxDebit)}
          </span>
        </div>
      </div>
      {node.children.map((c) => (
        <MandateTree key={c.id} node={c} onRevoke={onRevoke} onUnfreeze={onUnfreeze} depth={depth + 1} />
      ))}
    </div>
  )
}
