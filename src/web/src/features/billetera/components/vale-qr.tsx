import { encodeVoucher, type Merchant, type Voucher } from '@openroute/shared';
import { Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { Button } from '@/components/ui/button';
import { useNotifications } from '@/components/ui/notifications';
import { useOnline } from '@/hooks/use-online';
import { cn } from '@/utils/cn';
import { formatCop } from '@/utils/format';

// El vale: QR sobre papel claro (se lee a pleno sol), con perforación arriba
// como un vale de papel. Borde sólido con señal (se cobra ya) y discontinuo
// sin ella (el tendero lo guarda y lo cobra después).
//
// Cabe entero en la pantalla del celular, sin scroll: ocupa la altura visible
// (100dvh menos el encabezado de 4rem y el relleno del main, 2.5rem) y el QR
// toma todo el espacio que sobra, lo más grande posible sin desbordar.

export const ValeQr = ({
  voucher,
  merchant,
  cop,
  onListo,
}: {
  voucher: Voucher;
  merchant: Merchant;
  cop: number;
  onListo: () => void;
}) => {
  const online = useOnline();
  const addNotification = useNotifications((s) => s.addNotification);
  const texto = encodeVoucher(voucher);

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-[29rem] flex-col gap-3 lg:h-auto lg:min-h-0 lg:gap-5 lg:pt-4">
      <div
        className={cn(
          'perforacion-top flex min-h-0 flex-1 flex-col rounded-b-3xl border-2 bg-paper-raised px-4 pt-5 pb-4 shadow-[0_1px_2px_rgb(28_34_48/0.04),0_12px_32px_-22px_rgb(28_34_48/0.3)] lg:flex-none lg:px-5 lg:pt-7 lg:pb-5',
          online
            ? 'border-solid border-rule'
            : 'border-dashed border-rule-strong',
        )}
      >
        <p className="text-center text-sm text-ink-2">Muéstraselo al tendero</p>
        {/* El QR crece hasta llenar el alto libre; nunca más ancho que el vale */}
        <div className="mt-2 flex min-h-0 flex-1 items-center justify-center lg:flex-none">
          <QRCodeSVG
            value={texto}
            level="L"
            marginSize={2}
            className="aspect-square h-full max-h-[18rem] w-auto max-w-full bg-paper-raised lg:h-auto lg:w-full"
            role="img"
            aria-label={`Vale por ${formatCop(cop)} para ${merchant.name}`}
          />
        </div>
        <p className="cifra mt-2 text-center text-[2.25rem] leading-none font-light tracking-[-0.03em] text-grafito lg:mt-3 lg:text-[2.5rem]">
          {formatCop(cop)}
        </p>
        <p className="mt-1.5 truncate text-center text-sm text-grafito">
          {merchant.name}{' '}
          <span className="num text-xs text-ink-2">
            · Vale N.º {voucher.counter}
          </span>
        </p>
      </div>

      <p
        className={cn(
          'rounded-2xl px-3 py-2 text-center text-xs leading-snug lg:p-3 lg:text-sm',
          online
            ? 'bg-liquidado-tint text-liquidado'
            : 'bg-pendiente-tint text-pendiente',
        )}
      >
        {online
          ? 'Con señal: el tendero lo cobra al instante.'
          : 'Sin señal: el tendero lo guarda y se cobra solo al volver la señal.'}
      </p>

      <div className="space-y-1 lg:mt-auto lg:space-y-2">
        <Button size="lg" className="w-full rounded-full" onClick={onListo}>
          Listo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full rounded-full text-ink-2"
          icon={<Copy aria-hidden="true" />}
          onClick={async () => {
            await navigator.clipboard?.writeText(texto);
            addNotification({ type: 'success', title: 'Vale copiado' });
          }}
        >
          Copiar vale (demo en computador)
        </Button>
      </div>
    </div>
  );
};
