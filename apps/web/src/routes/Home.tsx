import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/juan', icon: '🧑‍💼', title: 'Juan (Texas)', desc: 'Aprueba el mandato, ve el árbol y el feed, revoca ramas' },
  { to: '/maria', icon: '📱', title: 'María', desc: 'Paga con QR, incluso en modo avión' },
  { to: '/tendero', icon: '🏪', title: 'Tendero', desc: 'Escanea, verifica sin internet y liquida al reconectar' },
  { to: '/celular', icon: '📟', title: 'Celular de teclas', desc: 'La mamá le escribe al Asistente por SMS' },
  { to: '/demo', icon: '🎬', title: 'Vista del proyector', desc: 'Juan · celular · tendero en una sola pantalla' },
]

export default function Home() {
  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-3xl font-bold text-teal-800">OpenRoute</h1>
      <p className="text-slate-600">Juan autoriza una vez. María y sus agentes pagan donde sea.</p>
      {LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="card flex items-center gap-4 hover:ring-teal-500">
          <span className="text-3xl">{l.icon}</span>
          <span>
            <span className="block font-semibold">{l.title}</span>
            <span className="text-sm text-slate-500">{l.desc}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
