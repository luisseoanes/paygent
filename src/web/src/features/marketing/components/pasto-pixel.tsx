import { cn } from '@/utils/cn';

// Borde de píxeles (referencia: el borde que se deshace en el hero y la
// franja de pasto del footer de Cofounder). Patrón pseudoaleatorio fijo.

const COLS = 160;
const ROWS = 10;

const aleatorio = (semilla: number) => {
  let s = semilla;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};

const celdas = (semilla: number, densidad: (fila: number) => number) => {
  const r = aleatorio(semilla);
  const out: { x: number; y: number; t: number }[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const v = r();
      if (v < densidad(y)) out.push({ x, y, t: r() });
    }
  }
  return out;
};

// Disuelve la imagen hacia el fondo de la página: más densidad abajo.
const DISOLVER = celdas(7, (y) => (y + 1) / ROWS);
// Pasto: más denso abajo, con briznas sueltas arriba.
const PASTO = celdas(11, (y) => Math.min(1, ((y + 1) / ROWS) ** 1.4 + 0.05));

export const PastoPixel = ({
  variante,
  className,
}: {
  variante: 'disolver' | 'pasto';
  className?: string;
}) => {
  const puntos = variante === 'disolver' ? DISOLVER : PASTO;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${COLS} ${ROWS}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={cn('block h-10 w-full sm:h-14', className)}
    >
      {variante === 'pasto' && (
        <rect
          x={0}
          y={ROWS - 3}
          width={COLS}
          height={3}
          fill="var(--liquidado)"
          opacity={0.85}
        />
      )}
      {puntos.map((p) => (
        <rect
          key={`${p.x}-${p.y}`}
          x={p.x}
          y={p.y}
          width={1}
          height={1}
          fill={
            variante === 'disolver'
              ? 'var(--hueso)'
              : p.t > 0.6
                ? 'var(--liquidado)'
                : p.t > 0.25
                  ? 'var(--led)'
                  : 'var(--liquidado-tint)'
          }
        />
      ))}
    </svg>
  );
};
