import type * as React from 'react';

import { cn } from '@/utils/cn';

// Nube pixel art como las del paisaje: borde ondulado de bultos cortos y
// seguidos (círculos pixelados que se superponen y asoman poco) y la "panza"
// azulada: la misma silueta repetida un par de pixeles más abajo. El tamaño
// del pixel es la variable --px, así la nube se achica sin deformarse.

// Sangría de cada fila (en pixeles de nube) para un cuarto de círculo de
// radio `r`, como en el pixel art: más sangría arriba.
const perfilCirculo = (r: number) =>
  Array.from({ length: r }, (_, i) => {
    const y = r - i - 0.5;
    return Math.round(r - Math.sqrt(r * r - y * y));
  });

const px = (n: number) => `calc(${n} * var(--px))`;
const desdeElFinal = (n: number) => `calc(100% - ${n} * var(--px))`;

// polygon() con las cuatro esquinas en escalera según `perfil`.
const recorte = (perfil: number[]) => {
  const n = perfil.length;
  const tl: [number, number][] = [[0, n]];
  for (let i = n - 1; i >= 0; i--) {
    tl.push([perfil[i]!, i + 1], [perfil[i]!, i]);
  }
  const punto = ([x, y]: [number, number], derecha: boolean, abajo: boolean) =>
    `${derecha ? desdeElFinal(x) : px(x)} ${abajo ? desdeElFinal(y) : px(y)}`;
  const puntos = [
    ...tl.map((p) => punto(p, false, false)),
    ...[...tl].reverse().map((p) => punto(p, true, false)),
    ...tl.map((p) => punto(p, true, true)),
    ...[...tl].reverse().map((p) => punto(p, false, true)),
  ];
  return `polygon(${puntos.join(', ')})`;
};

type Lado = 'arriba' | 'abajo' | 'izquierda' | 'derecha';

type Forma = {
  clase: string;
  esquina: number;
  // Cuántos bultos por lado (0 = lado liso)
  bultos: Record<Lado, number>;
  // Diámetros (en pixeles de nube) que se van alternando: variedad sin azar
  diametros: number[];
  // Qué fracción del bulto asoma fuera del borde
  asoma: number;
  relleno: string;
};

const FORMAS = {
  md: {
    clase: '[--px:5px] sm:[--px:8px]',
    esquina: 3,
    bultos: { arriba: 9, abajo: 8, izquierda: 7, derecha: 7 },
    diametros: [8, 10, 7, 9, 11, 8, 10, 7, 9],
    asoma: 0.4,
    relleno: 'px-6 py-7 sm:px-9 sm:py-9',
  },
  // Nube chica (el logo): base plana y bultos arriba, como una nube suelta
  sm: {
    clase: '[--px:3px]',
    esquina: 2,
    bultos: { arriba: 6, abajo: 0, izquierda: 1, derecha: 1 },
    diametros: [10, 12, 11, 10, 12, 10],
    asoma: 0.25,
    relleno: 'px-3 pt-1 pb-1.5',
  },
} satisfies Record<string, Forma>;

type Bulto = { estilo: React.CSSProperties; diametro: number };

// Reparte los bultos a lo largo de cada lado, con un leve vaivén.
const repartir = (forma: Forma): Bulto[] =>
  (Object.keys(forma.bultos) as Lado[]).flatMap((lado, l) => {
    const n = forma.bultos[lado];
    return Array.from({ length: n }, (_, i) => {
      const d = forma.diametros[(i + l * 2) % forma.diametros.length]!;
      const vaiven = i % 2 === 0 ? -1.5 : 1.5;
      const a = n === 1 ? 50 : 7 + (86 * i) / (n - 1) + vaiven;
      const sobre = `calc(${a}% - ${d / 2} * var(--px))`;
      const fuera = `calc(${-d * forma.asoma} * var(--px))`;
      const estilo: React.CSSProperties =
        lado === 'arriba'
          ? { left: sobre, top: fuera }
          : lado === 'abajo'
            ? { left: sobre, bottom: fuera }
            : lado === 'izquierda'
              ? { top: sobre, left: fuera }
              : { top: sobre, right: fuera };
      return { estilo, diametro: d };
    });
  });

const Silueta = ({
  forma,
  bultos,
  className,
  children,
}: {
  forma: Forma;
  bultos: Bulto[];
  className: string;
  children?: React.ReactNode;
}) => (
  <>
    {bultos.map(({ estilo, diametro }, i) => (
      <span
        key={i}
        aria-hidden="true"
        className={cn('absolute', className)}
        style={{
          ...estilo,
          width: px(diametro),
          height: px(diametro),
          clipPath: recorte(perfilCirculo(diametro / 2)),
        }}
      />
    ))}
    <div
      className={cn(
        'relative',
        className,
        children ? forma.relleno : 'absolute inset-0',
      )}
      style={{ clipPath: recorte(perfilCirculo(forma.esquina)) }}
      aria-hidden={children ? undefined : true}
    >
      {children}
    </div>
  </>
);

export const NubePixel = ({
  children,
  tamano = 'md',
  className,
}: {
  children: React.ReactNode;
  tamano?: keyof typeof FORMAS;
  className?: string;
}) => {
  const forma: Forma = FORMAS[tamano];
  const bultos = repartir(forma);
  return (
    <div className={cn('relative isolate', forma.clase, className)}>
      {/* Panza: la misma silueta, 2 pixeles más abajo y azulada */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ transform: `translateY(${px(tamano === 'sm' ? 1 : 2)})` }}
      >
        <Silueta forma={forma} bultos={bultos} className="bg-firma-tint" />
      </div>
      <Silueta forma={forma} bultos={bultos} className="bg-paper-raised">
        {children}
      </Silueta>
    </div>
  );
};
