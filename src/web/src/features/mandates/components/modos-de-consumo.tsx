import { MessageCircle, MessageSquareText, Plus, QrCode } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/dialog';
import { useNotifications } from '@/components/ui/notifications';
import { MODOS, modoInfo } from '@/config/modos';
import { type ModeView, type SpendMode } from '@/types/api';

import { useEnableModes, useModes, useSetLimits } from '../api/modes';
import { useRevokeMandate } from '../api/revoke-mandate';
import { amountToNumber, money, parseMoney, toAmount } from '../utils/mandate';

// Formas de pagar de un beneficiario, en el panel del titular: qué es cada
// modo, cómo lo usa, su tope (lo puede subir o bajar) y quitarlo.

export const iconoModo: Record<SpendMode, React.ReactNode> = {
  celular: <QrCode aria-hidden="true" />,
  asistente: <MessageCircle aria-hidden="true" />,
  sms: <MessageSquareText aria-hidden="true" />,
};

const CambiarTope = ({ modo }: { modo: ModeView }) => {
  const addNotification = useNotifications((s) => s.addNotification);
  const [valor, setValor] = React.useState(
    String(amountToNumber(modo.maxDebit)),
  );
  const setLimits = useSetLimits({
    mutationConfig: {
      onSuccess: () =>
        addNotification({ type: 'success', title: 'Tope actualizado' }),
    },
  });
  const n = parseMoney(valor);
  const valido = Number.isFinite(n) && n >= 0;
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido)
          setLimits.mutate({
            mandateId: modo.mandateId,
            data: { maxDebit: toAmount(n, modo.maxDebit) },
          });
      }}
    >
      <label className="grid flex-1 gap-1 text-xs text-ink-2">
        Tope ({modo.maxDebit.assetCode})
        <input
          inputMode="decimal"
          aria-label={`Tope de ${modoInfo[modo.mode].nombre}`}
          className="num h-10 rounded-full border border-rule bg-paper px-4 text-base text-grafito"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
      </label>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="h-10 rounded-full"
        disabled={!valido}
        isLoading={setLimits.isPending}
      >
        Guardar
      </Button>
    </form>
  );
};

const Modo = ({ modo }: { modo: ModeView }) => {
  const info = modoInfo[modo.mode];
  const revoke = useRevokeMandate();
  return (
    <li className="space-y-3 py-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-paper-sunken text-grafito [&_svg]:size-5">
          {iconoModo[modo.mode]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium text-grafito">
            {info.nombre}
          </p>
          <p className="cifra text-xs text-ink-2">
            Quedan {money(amountToNumber(modo.remaining))} de{' '}
            {money(amountToNumber(modo.maxDebit))}
            {modo.offlineCap &&
              ` · sin señal hasta ${money(amountToNumber(modo.offlineCap))}`}
            {modo.pinThreshold &&
              (amountToNumber(modo.pinThreshold) === 0
                ? ' · PIN en cada compra'
                : ` · PIN desde ${money(amountToNumber(modo.pinThreshold))}`)}
          </p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink-2">
        {info.como}
        {modo.mode === 'sms' &&
          (modo.phone
            ? ` Su número: ${modo.phone}.`
            : ' Se activa cuando enlace su cuenta con su número de celular.')}
      </p>
      <CambiarTope modo={modo} />
      <ConfirmationDialog
        title={`¿Quitar ${info.nombre}?`}
        body="Esta forma de pagar deja de funcionar y su tope vuelve a quedar libre. Las demás siguen igual; puedes habilitarla otra vez."
        confirmLabel="Quitar"
        isLoading={revoke.isPending}
        isDone={revoke.isSuccess}
        onConfirm={() => revoke.mutate({ mandateId: modo.mandateId })}
        triggerButton={
          <button
            type="button"
            className="text-xs text-anulado underline underline-offset-2"
          >
            Quitar este modo
          </button>
        }
      />
    </li>
  );
};

export const ModosDeConsumo = ({ personaId }: { personaId: string }) => {
  const modos = useModes({ mandateId: personaId });
  const habilitar = useEnableModes();
  const lista = modos.data?.modes ?? [];
  const faltan = MODOS.filter((m) => !lista.some((v) => v.mode === m));

  return (
    <section aria-labelledby="formas-de-pagar" className="space-y-1">
      <h3 id="formas-de-pagar" className="text-sm font-medium text-grafito">
        Formas de pagar
      </h3>
      {modos.isLoading ? (
        <p className="text-sm text-ink-2">Cargando…</p>
      ) : (
        <ul className="divide-y divide-rule">
          {lista.map((m) => (
            <Modo key={m.mandateId} modo={m} />
          ))}
        </ul>
      )}
      {!modos.isLoading && faltan.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 rounded-full"
          icon={<Plus aria-hidden="true" />}
          isLoading={habilitar.isPending}
          onClick={() => habilitar.mutate({ personaId })}
        >
          Habilitar {faltan.map((m) => modoInfo[m].nombre).join(', ')}
        </Button>
      )}
    </section>
  );
};
