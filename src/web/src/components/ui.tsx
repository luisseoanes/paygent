import { amount as A, type Amount } from '@openroute/shared'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export const Page = ({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) => (
  <div className="mx-auto max-w-3xl space-y-4 p-4">
    <header className="flex items-center justify-between">
      <Link to="/" className="text-xl font-bold text-teal-800">
        Paygent <span className="font-normal text-slate-500">· {title}</span>
      </Link>
      {right}
    </header>
    {children}
  </div>
)

export const OnlineBadge = ({ online }: { online: boolean }) => (
  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${online ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
    {online ? '● En línea' : '✈ Sin señal'}
  </span>
)

export const Money = ({ amount, fx }: { amount: Amount; fx?: number }) => (
  <span>
    {A.format(amount)}
    {fx ? <span className="text-slate-500"> · {A.formatCop(A.usdToCop(amount, fx))}</span> : null}
  </span>
)

export const FxNote = ({ fx }: { fx: number }) => (
  <p className="text-xs text-slate-500">COP con tasa de referencia simulada: 1 USD = {fx.toLocaleString('es-CO')} COP</p>
)

export const Bar = ({ value, max }: { value: number; max: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
    <div className="h-full bg-teal-600" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
  </div>
)
