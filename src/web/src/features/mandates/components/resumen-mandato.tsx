import { GitBranchPlus, NotebookPen } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import cielo from '@/assets/paisaje-cielo.png';
import { MarcaDeAutenticidad } from '@/components/brand/marca-autenticidad';
import { Button } from '@/components/ui/button';
import { type MandateTree } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

import {
  type TramoDeGasto,
  amountToNumber,
  intervalLabel,
  money,
  nextRenewal,
  quedanDe,
  repartoDelGasto,
} from '../utils/mandate';

// Lo primero que Juan quiere saber: cuánto queda, quién lo gastó y qué puede
// hacer ahora. El paisaje es el mismo cielo de la portada.

// Personas en azul firma y agentes en violeta, cada tramo un poco más claro
// para distinguirlos sin inventar colores.
const tonoTramo = (tramo: TramoDeGasto, i: number) =>
  cn(
    tramo.holderType === 'agent' ? 'bg-agente' : 'bg-firma',
    ['', 'opacity-75', 'opacity-55', 'opacity-40'][Math.min(i, 3)],
  );

const BarraDeReparto = ({
  tramos,
  limit,
}: {
  tramos: TramoDeGasto[];
  limit: number;
}) => {
  const reduceMotion = useReducedMotion();
  const total = tramos.reduce((sum, t) => sum + t.spent, 0);
  return (
    <div className="space-y-3">
      <div
        role="meter"
        aria-label="Gastado del mandato"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.round(total * 100) / 100}
        aria-valuetext={`${money(total)} gastado de ${money(limit)}`}
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-hueso-2"
      >
        {tramos.map((tramo, i) => (
          <motion.span
            key={tramo.id}
            className={cn('h-full first:rounded-l-full', tonoTramo(tramo, i))}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{
              width: `${limit > 0 ? (tramo.spent / limit) * 100 : 0}%`,
            }}
            transition={{ duration: 0.42, delay: i * 0.06 }}
          />
        ))}
      </div>
      {tramos.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
          {tramos.map((tramo, i) => (
            <li key={tramo.id} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn('size-2 rounded-full', tonoTramo(tramo, i))}
              />
              <span className="text-grafito">{tramo.name}</span>
              <span className="cifra">{money(tramo.spent)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-2">Nadie ha gastado este periodo.</p>
      )}
    </div>
  );
};

export type ResumenMandatoProps = {
  root: MandateTree;
  // El gateway corre sin Test Wallet (MOCK_OP)
  simulado?: boolean;
  onDelegar?: () => void;
  onLibreta: () => void;
};

export const ResumenMandato = ({
  root,
  simulado = false,
  onDelegar,
  onLibreta,
}: ResumenMandatoProps) => {
  const limit = amountToNumber(root.maxDebit);
  const renueva = nextRenewal(root.interval);
  const periodo = intervalLabel(root.interval);

  return (
    <div className="space-y-3">
      <section
        aria-labelledby="resumen-mandato"
        className="relative isolate overflow-hidden rounded-3xl bg-firma"
      >
        <img
          src={cielo}
          alt=""
          width={320}
          height={180}
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_35%] pixelado"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-grafito/45 via-grafito/15 to-transparent" />

        <div className="flex flex-col gap-6 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3 text-paper-raised">
            <h2 id="resumen-mandato" className="text-sm opacity-90">
              Tu mandato{' '}
              {periodo && <span className="opacity-80">{periodo}</span>}
            </h2>
            <MarcaDeAutenticidad
              kind={simulado ? 'simulado' : 'real'}
              label={simulado ? 'Grant simulado' : 'Grant · testnet'}
              className="border-vidrio-borde bg-vidrio text-grafito backdrop-blur-md"
            />
          </div>

          <div className="text-paper-raised drop-shadow-[0_1px_8px_rgb(20_40_80/0.35)]">
            <p className="text-sm opacity-90">Quedan</p>
            <p className="cifra text-[clamp(2.75rem,9vw,3.75rem)] leading-none font-light tracking-[-0.03em]">
              {money(quedanDe(root))}
            </p>
            <p className="mt-2 text-sm opacity-90">
              de <span className="cifra">{money(limit)}</span>
              {renueva &&
                ` · se renueva el ${formatDate(renueva, { day: 'numeric', month: 'long' })}`}
            </p>
          </div>

          <div className="rounded-2xl border border-vidrio-borde bg-paper-raised/85 p-4 backdrop-blur-md">
            <p className="mb-3 flex justify-between text-xs text-ink-2">
              <span>Quién lo gastó</span>
              <span className="cifra">
                {money(amountToNumber(root.spentInPeriod))} gastado
              </span>
            </p>
            <BarraDeReparto tramos={repartoDelGasto(root)} limit={limit} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="rounded-full"
          icon={<GitBranchPlus aria-hidden="true" />}
          onClick={onDelegar}
          disabled={!onDelegar}
        >
          Delegar
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="rounded-full bg-paper-raised"
          icon={<NotebookPen aria-hidden="true" />}
          onClick={onLibreta}
        >
          Libreta
        </Button>
      </div>
    </div>
  );
};
