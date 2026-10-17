import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as React from 'react';

import { cn } from '@/utils/cn';

import { type useChat } from '../hooks/use-chat';
import { type MensajeChat } from '../types';

// Chat con el asistente: burbujas que entran con resorte, "pensando" con tres
// puntos, respuesta letra a letra con cursor, copiar, detener y reintentar.

type Chat = ReturnType<typeof useChat>;

const SUGERENCIAS = [
  '¿Cuánto me queda para gastar?',
  '¿Dónde compro la pastilla de la presión?',
  '¿Puedo pagar sin señal?',
];

const resorte = { type: 'spring', stiffness: 520, damping: 34 } as const;

const Avatar = () => (
  <span
    aria-hidden="true"
    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-firma-tint text-firma"
  >
    <Sparkles className="size-4" />
  </span>
);

const Pensando = () => (
  <span
    role="status"
    aria-label="El asistente está pensando"
    className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-paper-sunken px-3.5 py-3"
  >
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="size-1.5 rounded-full bg-ink-2"
        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
      />
    ))}
  </span>
);

const Copiar = ({ texto }: { texto: string }) => {
  const [copiado, setCopiado] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={copiado ? 'Copiado' : 'Copiar respuesta'}
      onClick={() => {
        void navigator.clipboard?.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1400);
      }}
      className="inline-flex size-7 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-paper-sunken hover:text-grafito focus-visible:ring-2 focus-visible:ring-firma focus-visible:outline-none"
    >
      {copiado ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5" />
      )}
    </button>
  );
};

const Burbuja = ({
  mensaje,
  onReintentar,
}: {
  mensaje: MensajeChat;
  onReintentar: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const esUsuario = mensaje.rol === 'usuario';
  const entrada = reduceMotion
    ? false
    : esUsuario
      ? { opacity: 0, y: 14, scale: 0.92 }
      : { opacity: 0, y: 6 };

  return (
    <motion.li
      layout={!reduceMotion}
      initial={entrada}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={resorte}
      className={cn(
        'flex gap-2.5',
        esUsuario ? 'justify-end' : 'justify-start',
      )}
      style={{ originX: esUsuario ? 1 : 0, originY: 1 }}
    >
      {!esUsuario && <Avatar />}
      {esUsuario ? (
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-firma px-3.5 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-paper-raised shadow-sm">
          {mensaje.texto}
        </p>
      ) : mensaje.estado === 'escribiendo' && !mensaje.texto ? (
        <Pensando />
      ) : (
        <div className="group max-w-[88%] min-w-0 pt-1">
          <p
            className={cn(
              'text-[0.9375rem] leading-relaxed whitespace-pre-wrap',
              mensaje.estado === 'error' ? 'text-destructive' : 'text-grafito',
            )}
          >
            {mensaje.texto}
            {mensaje.estado === 'escribiendo' && (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-[1.05em] w-[0.45em] translate-y-[0.15em] animate-pulse rounded-[1px] bg-firma"
              />
            )}
          </p>
          {mensaje.estado === 'listo' && (
            <div className="mt-1 flex opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Copiar texto={mensaje.texto} />
            </div>
          )}
          {mensaje.estado === 'error' && (
            <button
              type="button"
              onClick={onReintentar}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1 text-xs text-grafito transition-colors hover:bg-paper-sunken"
            >
              <RotateCcw aria-hidden="true" className="size-3" />
              Reintentar
            </button>
          )}
        </div>
      )}
    </motion.li>
  );
};

// Sigue el final de la conversación salvo que la persona haya subido a leer.
const useSeguirFinal = (dependencia: unknown) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [alFinal, setAlFinal] = React.useState(true);

  React.useEffect(() => {
    const el = ref.current;
    if (el && alFinal) el.scrollTop = el.scrollHeight;
  }, [dependencia, alFinal]);

  const onScroll = () => {
    const el = ref.current;
    if (el) setAlFinal(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  };
  const bajar = () => {
    const el = ref.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };
  return { ref, alFinal, onScroll, bajar };
};

const Redactor = ({ chat }: { chat: Chat }) => {
  const [texto, setTexto] = React.useState('');
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const ocupado = chat.estado !== 'libre';

  React.useEffect(() => {
    ref.current?.focus();
  }, []);

  // Crece con el texto hasta ~5 líneas.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [texto]);

  const enviar = () => {
    if (!texto.trim() || ocupado) return;
    chat.enviar(texto);
    setTexto('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      className="flex items-end gap-2 rounded-2xl border border-rule bg-paper-raised p-1.5 pl-3.5 shadow-sm transition-shadow focus-within:border-firma/50 focus-within:shadow-[0_0_0_4px_var(--firma-tint)]"
    >
      <label htmlFor="mensaje-asistente" className="sr-only">
        Escribe tu mensaje
      </label>
      <textarea
        ref={ref}
        id="mensaje-asistente"
        rows={1}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            enviar();
          }
        }}
        placeholder="Pregúntale al asistente…"
        className="max-h-33 min-h-9 flex-1 resize-none bg-transparent py-2 text-[0.9375rem] text-grafito placeholder:text-ink-3 focus:outline-none"
      />
      <AnimatePresence mode="popLayout" initial={false}>
        {ocupado ? (
          <motion.button
            key="detener"
            type="button"
            aria-label="Detener respuesta"
            onClick={chat.detener}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-grafito text-paper-raised"
          >
            <Square aria-hidden="true" className="size-3.5 fill-current" />
          </motion.button>
        ) : (
          <motion.button
            key="enviar"
            type="submit"
            aria-label="Enviar mensaje"
            disabled={!texto.trim()}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            whileTap={{ scale: 0.88 }}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-firma text-paper-raised transition-colors disabled:bg-rule disabled:text-ink-3"
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </form>
  );
};

const Vacio = ({ onElegir }: { onElegir: (t: string) => void }) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-2 text-center">
    <Avatar />
    <div>
      <p className="font-geist text-lg font-medium text-grafito">
        Hola. ¿Qué necesitas?
      </p>
      <p className="mt-1 text-sm text-ink-2">
        Te ayudo a encontrar dónde comprar y cuánto te queda. El pago lo
        confirmas tú.
      </p>
    </div>
    <ul className="flex flex-wrap justify-center gap-2">
      {SUGERENCIAS.map((s, i) => (
        <motion.li
          key={s}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.06 }}
        >
          <button
            type="button"
            onClick={() => onElegir(s)}
            className="rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-sm text-grafito transition-colors hover:border-firma/40 hover:bg-firma-tint"
          >
            {s}
          </button>
        </motion.li>
      ))}
    </ul>
  </div>
);

export type ChatAsistenteProps = {
  chat: Chat;
  onCerrar: () => void;
  className?: string;
};

export const ChatAsistente = ({
  chat,
  onCerrar,
  className,
}: ChatAsistenteProps) => {
  const ultimo = chat.mensajes.at(-1);
  const { ref, alFinal, onScroll, bajar } = useSeguirFinal(
    `${chat.mensajes.length}-${ultimo?.texto.length ?? 0}`,
  );
  // Escape cierra el chat.
  React.useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const subtitulo =
    chat.estado === 'pensando'
      ? 'Pensando…'
      : chat.estado === 'escribiendo'
        ? 'Escribiendo…'
        : 'En línea';

  return (
    <section
      aria-labelledby="chat-asistente-titulo"
      className={cn('flex min-h-0 flex-col', className)}
    >
      <header className="flex items-center gap-3 border-b border-rule/70 pb-3">
        <Avatar />
        <div className="min-w-0 flex-1">
          <h2
            id="chat-asistente-titulo"
            className="font-geist text-[0.9375rem] font-semibold text-grafito"
          >
            Asistente
          </h2>
          <p
            className="flex items-center gap-1.5 text-xs text-ink-2"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                chat.estado === 'libre'
                  ? 'bg-liquidado'
                  : 'animate-pulse bg-firma',
              )}
            />
            {subtitulo}
          </p>
        </div>
        {chat.mensajes.length > 0 && (
          <button
            type="button"
            aria-label="Nueva conversación"
            onClick={chat.reiniciar}
            className="flex size-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-paper-sunken hover:text-grafito"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
          </button>
        )}
        <button
          type="button"
          aria-label="Cerrar chat"
          onClick={onCerrar}
          className="flex size-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-paper-sunken hover:text-grafito"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={ref}
          onScroll={onScroll}
          role="log"
          aria-label="Conversación con el asistente"
          className="h-full [scrollbar-width:thin] overflow-y-auto overscroll-contain py-4"
        >
          {chat.mensajes.length === 0 ? (
            <Vacio onElegir={chat.enviar} />
          ) : (
            <ul className="space-y-4">
              {chat.mensajes.map((m) => (
                <Burbuja
                  key={m.id}
                  mensaje={m}
                  onReintentar={chat.reintentar}
                />
              ))}
            </ul>
          )}
        </div>
        <AnimatePresence>
          {!alFinal && (
            <motion.button
              type="button"
              aria-label="Ir al último mensaje"
              onClick={bajar}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-2 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border border-rule bg-paper-raised text-grafito shadow-md"
            >
              <ArrowDown aria-hidden="true" className="size-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <Redactor chat={chat} />
      <p className="mt-2 text-center text-[0.6875rem] text-ink-2">
        El asistente propone; tú confirmas cada pago con tu PIN.
      </p>
    </section>
  );
};
