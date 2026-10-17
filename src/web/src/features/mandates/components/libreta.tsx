import { NotebookPen } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { type FeedEvent } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/format';

import { agruparPorDia, amountToNumber, money } from '../utils/mandate';

import { Avatar } from './avatar';

// Libreta: cada movimiento del feed en vivo, agrupado por día y con su porqué
// siempre a la vista. Lo que el Guardián frenó o el gateway rechazó se marca
// en rojo: es lo primero que Juan tiene que ver.

const merchant = (e: FeedEvent) => e.merchant ?? 'un comercio';

// Una frase que se entiende sola: quién hizo qué.
export const describeEvent = (e: FeedEvent) => {
  const actor = e.actor.name;
  switch (e.kind) {
    case 'payment':
      return `${actor} pagó en ${merchant(e)}`;
    case 'agent_to_agent':
      return `${actor} le pagó a ${merchant(e)}`;
    case 'voucher_settled':
      return `Vale de ${actor} cobrado en ${merchant(e)}`;
    case 'guardian':
      return e.actor.type === 'agent'
        ? `${actor} intervino`
        : `${actor} ajustó una rama`;
    case 'revoked':
      return `${actor} revocó una rama`;
    case 'denied':
      return e.merchant
        ? `Pago de ${actor} en ${e.merchant} rechazado`
        : `Pago de ${actor} rechazado`;
    case 'grant':
      return `${actor} firmó el mandato en su billetera`;
    case 'payout':
      return e.reason?.startsWith('Puntored no pudo')
        ? `Puntored no pudo acreditarle a ${merchant(e)}`
        : `Puntored le acreditó a ${merchant(e)}`;
    default:
      return actor;
  }
};

// Lo que Juan debe mirar: el Guardián actuó o un pago no pasó.
export const esAlerta = (e: FeedEvent) =>
  e.kind === 'denied' || (e.kind === 'guardian' && e.actor.type === 'agent');

const sale = (e: FeedEvent) =>
  e.kind === 'payment' ||
  e.kind === 'agent_to_agent' ||
  e.kind === 'voucher_settled';

export const EntradaLibreta = ({ event }: { event: FeedEvent }) => {
  const alerta = esAlerta(event);

  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl px-3 py-3',
        alerta && 'bg-anulado-tint/60',
      )}
    >
      <Avatar
        holderType={event.actor.type}
        name={event.actor.name}
        restringe={alerta || event.kind === 'revoked'}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              'text-[0.9375rem] leading-snug text-grafito',
              alerta && 'text-anulado',
            )}
          >
            {describeEvent(event)}
          </p>
          {event.amount && (
            <span
              className={cn(
                'cifra shrink-0 text-[0.9375rem] font-medium',
                event.kind === 'denied'
                  ? 'text-anulado line-through'
                  : sale(event)
                    ? 'text-grafito'
                    : 'text-liquidado',
              )}
            >
              {sale(event) && '−'}
              {money(amountToNumber(event.amount))}
            </span>
          )}
        </div>
        {event.reason && (
          <p className="mt-0.5 text-sm leading-snug text-ink-2">
            {event.reason}
          </p>
        )}
        <time
          dateTime={event.at}
          className="cifra mt-1 block text-xs text-ink-2"
        >
          {formatTime(event.at).slice(0, 5)}
        </time>
      </div>
    </div>
  );
};

export type LibretaProps = {
  events: FeedEvent[];
  // Solo los movimientos de estas ramas
  mandateIds?: string[];
  // Máximo de movimientos a mostrar
  limit?: number;
  className?: string;
};

export const Libreta = ({
  events,
  mandateIds,
  limit,
  className,
}: LibretaProps) => {
  const visible = (
    mandateIds ? events.filter((e) => mandateIds.includes(e.mandateId)) : events
  ).slice(0, limit);

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={<NotebookPen />}
        title="Todavía no hay movimientos"
        description="Cada pago, vale y decisión de un agente quedará anotado aquí, con su porqué."
        className={cn('rounded-2xl', className)}
      />
    );
  }

  return (
    <div aria-live="polite" className={cn('space-y-4', className)}>
      {agruparPorDia(visible).map((grupo) => (
        <section key={grupo.label} aria-label={grupo.label}>
          <h3 className="px-3 pb-1 text-xs font-medium text-ink-2">
            {grupo.label}
          </h3>
          <ol className="space-y-0.5">
            {grupo.items.map((event) => (
              <li key={event.id}>
                <EntradaLibreta event={event} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
};
