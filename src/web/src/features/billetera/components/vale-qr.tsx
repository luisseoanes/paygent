import { encodeVoucher, type Merchant, type Voucher } from '@openroute/shared';
import { Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { Button } from '@/components/ui/button';
import { useNotifications } from '@/components/ui/notifications';
import { useOnline } from '@/hooks/use-online';
import { cn } from '@/utils/cn';
import { formatCop } from '@/utils/format';

// El vale: QR enorme sobre papel claro (se lee a pleno sol), con perforación
// arriba como un vale de papel. Borde sólido con señal (se cobra ya) y
// discontinuo sin ella (el tendero lo guarda y lo cobra después).

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
    <div className="flex flex-1 flex-col gap-5 pt-4">
      <div
        className={cn(
          'perforacion-top rounded-b-3xl border-2 bg-paper-raised px-5 pt-7 pb-5 shadow-[0_1px_2px_rgb(28_34_48/0.04),0_12px_32px_-22px_rgb(28_34_48/0.3)]',
          online
            ? 'border-solid border-rule'
            : 'border-dashed border-rule-strong',
        )}
      >
        <p className="text-center text-sm text-ink-2">Muéstraselo al tendero</p>
        <div className="mx-auto mt-3 w-full max-w-[18rem] bg-paper-raised">
          <QRCodeSVG
            value={texto}
            level="L"
            marginSize={2}
            className="h-auto w-full"
            role="img"
            aria-label={`Vale por ${formatCop(cop)} para ${merchant.name}`}
          />
        </div>
        <p className="cifra mt-3 text-center text-[2.5rem] leading-none font-light tracking-[-0.03em] text-grafito">
          {formatCop(cop)}
        </p>
        <p className="mt-2 text-center text-[0.9375rem] text-grafito">
          {merchant.name}
        </p>
        <p className="num mt-1 text-center text-xs text-ink-2">
          Vale N.º {voucher.counter}
        </p>
      </div>

      <p
        className={cn(
          'rounded-2xl p-3 text-center text-sm',
          online
            ? 'bg-liquidado-tint text-liquidado'
            : 'bg-pendiente-tint text-pendiente',
        )}
      >
        {online
          ? 'Con señal: el tendero lo cobra al instante.'
          : 'Sin señal: el tendero lo guarda y se cobra solo cuando vuelva la señal.'}
      </p>

      <div className="mt-auto space-y-2">
        <Button size="xl" className="w-full rounded-full" onClick={onListo}>
          Listo
        </Button>
        <Button
          variant="ghost"
          className="w-full rounded-full"
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
