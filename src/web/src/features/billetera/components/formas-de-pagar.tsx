import { modoInfo } from '@/config/modos';
import { type ModeView } from '@/types/api';
import { formatCop } from '@/utils/format';

// Las formas de pagar que le habilitó su titular, con cómo se usa cada una.
// Los modos llegan de la ruta (vienen de la api de mandatos).

export const FormasDePagar = ({
  modos,
  aCop,
}: {
  modos: ModeView[];
  aCop: (m: ModeView['remaining']) => number;
}) => {
  if (modos.length === 0) return null;
  return (
    <section aria-labelledby="formas-de-pagar" className="space-y-2">
      <h2
        id="formas-de-pagar"
        className="px-1 text-base font-medium text-grafito"
      >
        Formas de pagar
      </h2>
      <ul className="divide-y divide-rule rounded-3xl bg-paper-raised px-4">
        {modos.map((m) => (
          <li key={m.mandateId} className="space-y-1 py-3">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-[0.9375rem] text-grafito">
                {modoInfo[m.mode].nombre}
              </span>
              <span className="cifra text-sm text-grafito">
                {formatCop(aCop(m.remaining))}
              </span>
            </p>
            <p className="text-xs leading-relaxed text-ink-2">
              {modoInfo[m.mode].como}
              {m.mode === 'sms' && m.phone && ` Escribe desde ${m.phone}.`}
              {m.frozen && ' Ahora está en pausa.'}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};
