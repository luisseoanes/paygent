import { amount as A } from '@openroute/shared';
import { RefreshCw, ScanLine } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useNotifications } from '@/components/ui/notifications';
import { cn } from '@/utils/cn';
import { formatCop, formatDate, formatTime } from '@/utils/format';

import { cobrarVales } from '../api/cobrar-vales';
import { type ValeRecibido, useCobroStore } from '../stores/cobro-store';
import { estadoVale } from '../utils/estado';
import { motivoLegible } from '../utils/verificar';

// La caja del tendero (FE-04): cuánto recibió hoy en pesos, qué falta por
// cobrar, el historial con su estado y un botón grande para escanear.

const esHoy = (iso: string) =>
  new Date(iso).toDateString() === new Date().toDateString();

const Chip = ({ vale }: { vale: ValeRecibido }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium',
      estadoVale[vale.status].chip,
    )}
  >
    {estadoVale[vale.status].label}
  </span>
);

const DetalleVale = ({
  vale,
  fx,
  online,
}: {
  vale: ValeRecibido;
  fx: number;
  online: boolean;
}) => {
  const addNotification = useNotifications((s) => s.addNotification);
  const [reenviando, setReenviando] = React.useState(false);

  // OFF-08: demo de doble cobro. El gateway lo rechaza y el Guardián lo
  // anota en la libreta de Juan; aquí el vale original no cambia.
  const reenviar = async () => {
    setReenviando(true);
    try {
      const [r] = await cobrarVales([vale.voucher]);
      addNotification({
        type: r?.status === 'rejected' ? 'warning' : 'info',
        title:
          r?.status === 'rejected'
            ? 'Rechazado: este vale ya se cobró'
            : `Respuesta: ${r?.status ?? 'sin respuesta'}`,
        message: 'El Guardián lo anotó en la libreta de Juan.',
      });
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="cifra text-5xl leading-none font-light tracking-[-0.03em] text-grafito">
          {formatCop(A.toCop(vale.voucher.amount, fx))}
        </p>
        <p className="mt-2 text-sm text-ink-2">
          ≈ US${A.toNumber(vale.voucher.amount).toFixed(2)} · tasa de referencia
        </p>
      </div>
      <Chip vale={vale} />
      {vale.reason && (
        <p className="rounded-2xl bg-paper-sunken/60 p-3 text-sm text-grafito">
          {vale.status === 'rejected'
            ? motivoLegible(vale.reason)
            : vale.reason}
        </p>
      )}
      <dl className="divide-y divide-rule text-sm">
        {[
          ['Vale', `N.º ${vale.voucher.counter}`],
          [
            'Recibido',
            `${formatDate(vale.scannedAt, { day: 'numeric', month: 'long' })}, ${formatTime(vale.scannedAt).slice(0, 5)}`,
          ],
          ['Firmado', formatTime(vale.voucher.createdAt).slice(0, 5)],
          ['Rama', vale.voucher.deviceCert.mandateId],
        ].map(([dt, dd]) => (
          <div key={dt} className="flex justify-between gap-4 py-3">
            <dt className="text-ink-2">{dt}</dt>
            <dd className="num text-grafito">{dd}</dd>
          </div>
        ))}
      </dl>
      {(vale.status === 'settled' || vale.status === 'flagged') && (
        <div className="space-y-2 rounded-2xl border-2 border-dashed border-anulado/40 p-4">
          <p className="text-sm text-grafito">
            Demo: intenta cobrar este vale otra vez. El gateway debe rechazarlo.
          </p>
          <Button
            variant="outline"
            className="w-full rounded-full"
            icon={<RefreshCw aria-hidden="true" />}
            isLoading={reenviando}
            disabled={!online}
            onClick={reenviar}
          >
            Reenviar vale
          </Button>
        </div>
      )}
    </div>
  );
};

export const Caja = ({
  online,
  sincronizando,
  onEscanear,
}: {
  online: boolean;
  sincronizando: boolean;
  onEscanear: () => void;
}) => {
  const vales = useCobroStore((s) => s.vales);
  const fx = useCobroStore((s) => s.fx);
  const tienda = useCobroStore((s) =>
    s.merchants.find((m) => m.id === s.merchantId),
  );
  const elegirTienda = useCobroStore((s) => s.elegirTienda);
  const [abierto, setAbierto] = React.useState<string>();

  const cop = (v: ValeRecibido) => A.toCop(v.voucher.amount, fx);
  const deHoy = vales.filter((v) => esHoy(v.scannedAt));
  const cobrado = deHoy
    .filter((v) => v.status === 'settled' || v.status === 'flagged')
    .reduce((s, v) => s + cop(v), 0);
  const porCobrar = deHoy
    .filter((v) => v.status === 'pending')
    .reduce((s, v) => s + cop(v), 0);
  const pendientes = vales.filter((v) => v.status === 'pending').length;
  const detalle = vales.find((v) => v.voucher.voucherId === abierto);

  return (
    <div className="flex flex-1 flex-col gap-6 pt-4">
      <section
        aria-labelledby="hoy"
        className="space-y-4 rounded-3xl bg-paper-raised p-5 shadow-[0_1px_2px_rgb(28_34_48/0.04),0_12px_32px_-22px_rgb(28_34_48/0.3)]"
      >
        <div>
          <h1 id="hoy" className="text-sm text-ink-2">
            Hoy recibiste
          </h1>
          <p className="cifra text-[2.75rem] leading-none font-light tracking-[-0.03em] text-grafito">
            {formatCop(cobrado + porCobrar)}
          </p>
          {tienda && (
            <p className="mt-1.5 text-sm text-ink-2">
              {tienda.name} ·{' '}
              <button
                type="button"
                onClick={() => elegirTienda(undefined)}
                className="min-h-8 underline underline-offset-2 hover:text-grafito"
              >
                cambiar
              </button>
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="rounded-2xl bg-liquidado-tint p-3 text-liquidado">
            <span className="block text-xs">Cobrado</span>
            <span className="cifra text-base">{formatCop(cobrado)}</span>
          </p>
          <p className="rounded-2xl border-2 border-dashed border-pendiente-borde bg-pendiente-tint p-3 text-pendiente">
            <span className="block text-xs">Por cobrar</span>
            <span className="cifra text-base">{formatCop(porCobrar)}</span>
          </p>
        </div>
        {pendientes > 0 && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-pendiente"
          >
            <RefreshCw
              className={cn(
                'size-4',
                sincronizando && 'animate-spin motion-reduce:animate-none',
              )}
              aria-hidden="true"
            />
            {sincronizando
              ? `Cobrando ${pendientes} ${pendientes === 1 ? 'vale' : 'vales'}…`
              : online
                ? 'Cobrando en un momento…'
                : `${pendientes} ${pendientes === 1 ? 'vale guardado' : 'vales guardados'}: se cobran solos cuando vuelva la señal.`}
          </p>
        )}
      </section>

      <section aria-labelledby="historial" className="space-y-2">
        <h2 id="historial" className="px-1 text-base font-medium text-grafito">
          Vales recibidos
        </h2>
        {vales.length === 0 ? (
          <p className="rounded-2xl bg-paper-raised p-4 text-sm text-ink-2">
            Cuando escanees un vale, aparece aquí con su estado.
          </p>
        ) : (
          <ul className="divide-y divide-rule rounded-3xl bg-paper-raised px-2">
            {vales.slice(0, 30).map((v) => (
              <li key={v.voucher.voucherId}>
                <button
                  type="button"
                  onClick={() => setAbierto(v.voucher.voucherId)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-paper-sunken/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="cifra block text-[0.9375rem] text-grafito">
                      {formatCop(cop(v))}
                    </span>
                    <span className="block truncate text-xs text-ink-2">
                      Vale N.º {v.voucher.counter} ·{' '}
                      {formatTime(v.scannedAt).slice(0, 5)}
                      {v.status === 'rejected' &&
                        ` · ${motivoLegible(v.reason)}`}
                    </span>
                  </span>
                  <Chip vale={v} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky bottom-4 mt-auto">
        <Button
          size="xl"
          className="w-full rounded-full shadow-lg"
          icon={<ScanLine aria-hidden="true" />}
          onClick={onEscanear}
        >
          Escanear vale
        </Button>
      </div>

      <Drawer
        open={!!detalle}
        onOpenChange={(open) => !open && setAbierto(undefined)}
      >
        {detalle && (
          <DrawerContent
            title={`Vale N.º ${detalle.voucher.counter}`}
            description={estadoVale[detalle.status].label}
          >
            <DetalleVale vale={detalle} fx={fx} online={online} />
          </DrawerContent>
        )}
      </Drawer>
    </div>
  );
};
