import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

import { useEnviarSms } from '../api/enviar-sms';

// SMS-02: celular de teclas simulado para la demo y el proyector. Conversa de
// verdad con el Agente Asistente: cada mensaje va a POST /sms/inbound, como un
// SMS real, y un PIN correcto hace un pago real desde la wallet de Juan.

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const SUGERENCIAS = [
  'necesito la pastilla de la presión',
  '1234',
  'cuánto me queda?',
];

type Mensaje = { de: 'yo' | 'agente'; texto: string; error?: boolean };

// En pantalla el PIN no se muestra, igual que en el celular de verdad.
const ocultarPin = (texto: string) =>
  /^\d{4,6}$/.test(texto.trim()) ? '•'.repeat(texto.trim().length) : texto;

export type CelularSmsProps = {
  telefono: string;
  className?: string;
};

export const CelularSms = ({ telefono, className }: CelularSmsProps) => {
  const [mensajes, setMensajes] = React.useState<Mensaje[]>([]);
  const [texto, setTexto] = React.useState('');
  const fin = React.useRef<HTMLDivElement>(null);
  const sms = useEnviarSms();

  React.useEffect(() => {
    fin.current?.scrollIntoView?.({ block: 'end' });
  }, [mensajes, sms.isPending]);

  const enviar = (body = texto) => {
    const limpio = body.trim();
    if (!limpio || sms.isPending) return;
    setTexto('');
    setMensajes((m) => [...m, { de: 'yo', texto: limpio }]);
    sms.mutate(
      { from: telefono, body: limpio },
      {
        onSuccess: ({ reply }) =>
          setMensajes((m) => [...m, { de: 'agente', texto: reply }]),
        onError: () =>
          setMensajes((m) => [
            ...m,
            {
              de: 'agente',
              texto: 'No se pudo enviar. Intente de nuevo.',
              error: true,
            },
          ]),
      },
    );
  };

  return (
    <div className={cn('mx-auto w-full max-w-xs', className)}>
      <div className="rounded-[2.5rem] bg-carcasa p-4 shadow-[inset_0_3px_0_rgb(255_255_255/0.1),inset_0_-4px_0_rgb(0_0_0/0.3)]">
        <div className="bg-carcasa-2 p-1.5">
          <div
            role="log"
            aria-label="Mensajes con el Asistente"
            aria-live="polite"
            className="flex h-72 flex-col overflow-y-auto bg-lcd px-2 py-1.5 font-lcd text-[1.05rem] leading-[1.1] text-lcd-ink"
          >
            <p className="mb-1.5 border-b border-lcd-ink/30 pb-0.5 text-[0.9rem]">
              Mensajes · Asistente
            </p>
            {mensajes.length === 0 && (
              <p className="my-auto text-center opacity-60">
                Escriba lo que necesita
              </p>
            )}
            {mensajes.map((m, i) => (
              <p
                key={i}
                className={cn(
                  'mb-1.5 max-w-[85%] px-1',
                  m.de === 'yo'
                    ? 'ml-auto text-right'
                    : 'mr-auto bg-lcd-ink text-lcd',
                  m.error && 'opacity-70',
                )}
              >
                {m.de === 'yo' ? ocultarPin(m.texto) : m.texto}
              </p>
            ))}
            {sms.isPending && (
              <p className="animate-pulse opacity-70">Asistente escribiendo…</p>
            )}
            <div ref={fin} />
          </div>
        </div>

        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <label htmlFor="sms-texto" className="sr-only">
            Mensaje
          </label>
          <input
            id="sms-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribir…"
            autoComplete="off"
            className="w-full bg-lcd px-2 py-1 font-lcd text-lg text-lcd-ink outline-none placeholder:text-lcd-ink/50"
          />
        </form>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setTexto((t) => t.slice(0, -1))}
          >
            Borrar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => enviar()}
            disabled={!texto.trim() || sms.isPending}
          >
            Enviar
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5" aria-label="Teclado">
          {TECLAS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTexto((t) => t + k)}
              className="bg-carcasa-2 py-2 font-lcd text-xl text-paper-raised transition-colors active:bg-firma"
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SUGERENCIAS.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant="outline"
            disabled={sms.isPending}
            onClick={() => enviar(s)}
          >
            {s}
          </Button>
        ))}
      </div>
    </div>
  );
};
