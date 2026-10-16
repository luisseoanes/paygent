import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'

// SMS-02: celular de teclas simulado. Usa el mismo endpoint que Twilio.
const PHONE = '+573001112233' // Doña Carmen (semilla)

interface Msg {
  from: 'me' | 'agent'
  text: string
}

export default function Celular() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs])

  const send = async (body = text) => {
    if (!body.trim()) return
    setText('')
    setMsgs((m) => [...m, { from: 'me', text: body }])
    setBusy(true)
    try {
      const { reply } = await api<{ reply: string }>('/sms/inbound', { json: { From: PHONE, Body: body } })
      setMsgs((m) => [...m, { from: 'agent', text: reply }])
    } catch (e) {
      setMsgs((m) => [...m, { from: 'agent', text: `[error] ${(e as Error).message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-800 p-4">
      <div className="w-72 rounded-[2.5rem] bg-slate-700 p-5 shadow-2xl">
        <div className="mb-3 text-center text-xs tracking-widest text-slate-400">NOKIA-ISH</div>
        <div className="h-80 overflow-y-auto rounded-md bg-[#c7d3a4] p-2 font-mono text-[13px] leading-tight text-[#1f2a12]">
          <p className="mb-2 border-b border-[#1f2a12]/30 pb-1 text-[11px]">Mensajes · Asistente</p>
          {msgs.map((m, i) => (
            <p key={i} className={`mb-2 ${m.from === 'me' ? 'text-right' : ''}`}>
              {m.from === 'me' ? '> ' : ''}
              {m.text}
            </p>
          ))}
          {busy && <p className="animate-pulse">...</p>}
          <div ref={end} />
        </div>
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <input
            className="w-full rounded-md bg-[#c7d3a4] px-2 py-1 font-mono text-sm text-[#1f2a12] outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribir…"
          />
        </form>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
            <button key={k} className="rounded-full bg-slate-600 py-2 text-white active:bg-slate-500" onClick={() => setText((t) => t + k)}>
              {k}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {['necesito la pastilla de la presión', '1234', 'cuánto me queda?'].map((s) => (
            <button key={s} className="rounded bg-slate-600 px-2 py-1 text-[10px] text-slate-200" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
