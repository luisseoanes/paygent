import { ChevronRight, Plus } from 'lucide-react';

import { Sello } from '@/components/brand/sello';
import { type MandateTree } from '@/types/api';
import { cn } from '@/utils/cn';

import {
  amountToNumber,
  categoryLabels,
  money,
  quedanDe,
  statusOf,
} from '../utils/mandate';

import { Avatar } from './avatar';

// Los delegados como una lista de personas: quién, cuánto le queda y en qué
// puede gastar. Las sub-ramas cuelgan de su rama con una línea. Al final,
// "Delegar a alguien más"; el Guardián va aparte porque no gasta.

const subtitulo = (node: MandateTree) => {
  if (node.holderType === 'device')
    return node.offlineCap
      ? `Paga sin señal hasta ${money(amountToNumber(node.offlineCap))}`
      : 'Llave del celular';
  const categorias = node.categories.map((c) => categoryLabels[c]).join(', ');
  return node.holderType === 'agent' ? `Agente · ${categorias}` : categorias;
};

const FilaRama = ({
  node,
  onOpen,
  nivel = 0,
}: {
  node: MandateTree;
  onOpen: (id: string) => void;
  nivel?: number;
}) => {
  const status = statusOf(node);
  const limit = amountToNumber(node.maxDebit);
  const spent = amountToNumber(node.spentInPeriod);
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const hijos = node.children.filter((c) => c.canSpend);

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(node.id)}
        aria-label={`${node.holderName}: ver detalle`}
        className="group relative flex min-h-16 w-full items-center gap-2.5 rounded-2xl px-2.5 py-3 text-left transition-colors hover:bg-paper-sunken/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:gap-3 sm:px-3"
      >
        <Avatar
          holderType={node.holderType}
          name={node.holderName}
          size={nivel ? 'sm' : 'md'}
        />
        <span
          className={cn(
            'min-w-0 flex-1 space-y-1.5',
            status !== 'active' && 'opacity-55',
          )}
        >
          <span className="flex items-baseline justify-between gap-3">
            <span
              className={cn(
                'truncate text-[0.9375rem] font-medium text-grafito',
                status === 'revoked' && 'line-through decoration-anulado',
              )}
            >
              {node.holderName}
            </span>
            <span className="cifra shrink-0 text-[0.9375rem] text-grafito">
              {money(quedanDe(node))}
            </span>
          </span>
          <span className="flex items-baseline justify-between gap-3 text-xs text-ink-2">
            <span className="truncate">{subtitulo(node)}</span>
            <span className="cifra shrink-0">de {money(limit)}</span>
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-hueso-2">
            <span
              className={cn(
                'block h-full rounded-full',
                node.holderType === 'agent' ? 'bg-agente' : 'bg-firma',
              )}
              style={{ width: `${pct}%` }}
            />
          </span>
        </span>
        {status !== 'active' && (
          <Sello
            variant={status === 'revoked' ? 'anulado' : 'congelado'}
            size="sm"
            seed={node.id}
            className="absolute top-1/2 right-10 -translate-y-1/2 bg-paper-raised/80"
          />
        )}
        <ChevronRight
          className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
      {hijos.length > 0 && (
        <ul className="ml-[1.85rem] border-l-2 border-rule pl-1 sm:pl-2">
          {hijos.map((hijo) => (
            <FilaRama
              key={hijo.id}
              node={hijo}
              onOpen={onOpen}
              nivel={nivel + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export type DelegadosProps = {
  root: MandateTree;
  onOpen: (id: string) => void;
  onDelegar?: () => void;
};

export const Delegados = ({ root, onOpen, onDelegar }: DelegadosProps) => {
  const ramas = root.children.filter((c) => c.canSpend);

  return (
    <ul className="rounded-3xl bg-paper-raised p-1.5 shadow-[0_1px_2px_rgb(28_34_48/0.04),0_12px_32px_-22px_rgb(28_34_48/0.3)]">
      {ramas.map((node) => (
        <FilaRama key={node.id} node={node} onOpen={onOpen} />
      ))}
      {onDelegar && (
        <li>
          <button
            type="button"
            onClick={onDelegar}
            className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-paper-sunken/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-firma/60 text-firma"
            >
              <Plus className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-firma">
                {ramas.length
                  ? 'Delegar a alguien más'
                  : 'Delegar tu primera rama'}
              </span>
              <span className="block text-xs text-ink-2">
                Una persona, un agente o un celular, con su propio tope.
              </span>
            </span>
          </button>
        </li>
      )}
    </ul>
  );
};

// El Guardián no gasta: solo restringe. Va en su propia tarjeta para que no
// se confunda con alguien que tiene dinero.
export const TarjetaGuardian = ({
  root,
  onOpen,
}: {
  root: MandateTree;
  onOpen: (id: string) => void;
}) => {
  const guardianes = root.children.filter((c) => !c.canSpend);
  if (guardianes.length === 0) return null;

  return (
    <ul className="space-y-2">
      {guardianes.map((g) => (
        <li key={g.id}>
          <button
            type="button"
            onClick={() => onOpen(g.id)}
            aria-label={`${g.holderName}: ver detalle`}
            className="group flex w-full items-center gap-3 rounded-3xl border border-dashed border-anulado/35 bg-anulado-tint/40 px-4 py-3.5 text-left transition-colors hover:bg-anulado-tint/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Avatar holderType={g.holderType} name={g.holderName} restringe />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-grafito">
                {g.holderName}
                {statusOf(g) !== 'active' && (
                  <span className="ml-2 text-xs text-anulado">
                    {statusOf(g) === 'revoked' ? 'revocado' : 'en pausa'}
                  </span>
                )}
              </span>
              <span className="block text-xs text-ink-2">
                Vigila tus ramas: puede congelar o bajar topes, nunca gastar.
              </span>
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </li>
      ))}
    </ul>
  );
};
