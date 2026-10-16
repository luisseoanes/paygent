// FE-06: vista del proyector. Tres columnas con las vistas reales embebidas.
export default function Demo() {
  return (
    <div className="grid h-screen grid-cols-[1.3fr_1fr_1fr] gap-2 bg-slate-900 p-2">
      <iframe title="Juan" src="/juan?embed=1" className="h-full w-full rounded-xl bg-white" />
      <iframe title="Celular" src="/celular" className="h-full w-full rounded-xl" />
      <iframe title="Tendero" src="/tendero" className="h-full w-full rounded-xl bg-white" />
    </div>
  )
}
