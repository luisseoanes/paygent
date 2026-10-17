import { ArrowUp, FolderOpen, Search } from 'lucide-react';

import { Container } from '@/components/layouts';
import { Heading } from '@/components/ui/typography';
import { cn } from '@/utils/cn';

// "Qué es" con la estructura de Cofounder (Mobbin): titular centrado en dos
// tonos y, debajo, una maqueta del producto en un marco fino: el árbol del
// mandato en forma radial a la izquierda y la conversación por SMS a la derecha.

const ramas = [
  { nombre: 'Familiar', angulo: -90, tono: 'ink' },
  { nombre: 'Agente de compras', angulo: -30, tono: 'agente' },
  { nombre: 'Inventario', angulo: 30, tono: 'agente' },
  { nombre: 'Guardián', angulo: 90, tono: 'anulado' },
  { nombre: 'PIN por SMS', angulo: 150, tono: 'ink' },
  { nombre: 'Llave sin señal', angulo: 210, tono: 'ink' },
] as const;

const R = 38; // % del lienzo

const DiagramaRadial = () => (
  <div className="relative aspect-[4/3] w-full bg-[radial-gradient(circle,var(--hueso-2)_1px,transparent_1.5px)] bg-[length:18px_18px]">
    <svg
      aria-hidden="true"
      viewBox="0 0 100 75"
      className="absolute inset-0 h-full w-full"
    >
      <circle
        cx={50}
        cy={37.5}
        r={R * 0.75}
        fill="none"
        stroke="var(--rule-strong)"
        strokeWidth={0.25}
      />
      {ramas.map((r) => {
        const rad = (r.angulo * Math.PI) / 180;
        return (
          <line
            key={r.nombre}
            x1={50}
            y1={37.5}
            x2={50 + Math.cos(rad) * R * 0.75}
            y2={37.5 + Math.sin(rad) * R * 0.75}
            stroke="var(--rule-strong)"
            strokeWidth={0.25}
            strokeDasharray="1 1"
          />
        );
      })}
    </svg>
    <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg border border-hueso-2 bg-paper-raised px-4 py-3 text-center shadow-sm sm:px-6 sm:py-4">
      <span
        aria-hidden="true"
        className="size-5 rounded-full border-2 border-double border-firma sm:size-8 sm:border-4"
      />
      <span className="font-geist text-xs font-medium text-grafito sm:text-base">
        Paygent
      </span>
      <span className="num text-[0.625rem] text-grafito-2 sm:text-sm">
        $300 / mes
      </span>
    </div>
    {ramas.map((r) => {
      const rad = (r.angulo * Math.PI) / 180;
      return (
        <span
          key={r.nombre}
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-hueso-2 bg-paper-raised px-2 py-1 font-geist text-[0.6875rem] whitespace-nowrap shadow-sm sm:px-3 sm:py-1.5 sm:text-sm',
            r.tono === 'agente' && 'text-agente',
            r.tono === 'anulado' && 'text-anulado',
            r.tono === 'ink' && 'text-grafito',
          )}
          style={{
            left: `${50 + Math.cos(rad) * R * 0.75}%`,
            top: `${50 + Math.sin(rad) * R}%`,
          }}
        >
          {r.nombre}
        </span>
      );
    })}
  </div>
);

const PanelSms = () => (
  <div className="flex h-full flex-col rounded-lg border border-hueso-2 bg-paper-raised">
    <div className="flex gap-1 border-b border-hueso-2 p-2 font-geist text-[0.6875rem] text-grafito-2">
      {['Inicio', 'Ramas', 'Libreta', 'Vales'].map((t, i) => (
        <span
          key={t}
          className={cn(
            'rounded px-2 py-1',
            i === 0 && 'bg-hueso text-grafito',
          )}
        >
          {t}
        </span>
      ))}
    </div>
    <div className="flex flex-1 flex-col justify-end gap-2 p-3 font-geist text-xs sm:gap-3 sm:p-4 sm:text-sm">
      <p className="ml-auto max-w-[85%] rounded-lg bg-hueso px-3 py-2 text-grafito">
        necesito la pastilla de la presion
      </p>
      <p className="max-w-[85%] rounded-lg border border-hueso-2 px-3 py-2 text-grafito">
        Farmacia San José la tiene a $12.000, a 3 cuadras. Responde tu PIN para
        pagar.
      </p>
      <p className="ml-auto max-w-[85%] rounded-lg bg-hueso px-3 py-2 text-grafito">
        ••••
      </p>
      <p className="max-w-[85%] rounded-lg border border-liquidado/40 bg-liquidado-tint px-3 py-2 text-liquidado">
        Pagado. Código de retiro 4821.
      </p>
    </div>
    <div className="m-2 flex items-center justify-between gap-2 rounded-md border border-hueso-2 px-3 py-2 font-geist text-xs text-grafito-2">
      Escribe lo que necesitas…
      <span className="flex size-6 items-center justify-center rounded bg-grafito text-hueso">
        <ArrowUp className="size-3.5" aria-hidden="true" />
      </span>
    </div>
  </div>
);

export const QueEs = () => (
  <section aria-labelledby="que-es-title" className="bg-hueso">
    <Container className="py-16 sm:py-24">
      <Heading
        level="h2"
        id="que-es-title"
        className="mx-auto max-w-3xl text-center font-geist text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.15] tracking-[-0.02em]"
        style={{ fontWeight: 400 }}
      >
        <span className="text-grafito">
          Paygent es una red de permisos delegables
        </span>{' '}
        <span className="text-grafito-2">
          para que personas y agentes paguen con la señal que haya.
        </span>
      </Heading>

      <figure className="mx-auto mt-12 max-w-6xl rounded-xl border border-hueso-2 bg-paper-raised/70 p-2 shadow-[0_30px_60px_-40px_rgb(28_34_48/0.35)]">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="rounded-lg border border-hueso-2 bg-hueso/60">
            <div className="flex items-center justify-between border-b border-hueso-2 px-3 py-2 font-geist text-[0.6875rem] text-grafito-2 sm:text-xs">
              <span className="flex items-center gap-2">
                <span className="rounded bg-hueso-2 px-1.5 py-0.5 text-grafito">
                  MR
                </span>
                Mandato raíz · Titular
              </span>
              <span className="flex items-center gap-2">
                <FolderOpen className="size-3.5" aria-hidden="true" />
                <Search className="size-3.5" aria-hidden="true" />
              </span>
            </div>
            <DiagramaRadial />
          </div>
          <div className="min-h-[320px] lg:min-h-[460px]">
            <PanelSms />
          </div>
        </div>
        <figcaption className="sr-only">
          Maqueta: el mandato raíz de $300 al mes repartido en ramas para un
          familiar, un agente de compras, el inventario, el guardián, el PIN por
          SMS y la llave sin señal, junto a una conversación por SMS que termina
          en un pago.
        </figcaption>
      </figure>
    </Container>
  </section>
);
