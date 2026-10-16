import { cn } from '@/utils/cn';

// Ícono de Paygent: una nube pixel art (el cielo de la marca) que atraviesan
// dos flechas azules en X, una hacia cada lado: el pago que sale y el que
// llega, con o sin señal. Cuadrícula de 24×24 pixeles, sin antialias.

const RELLENO =
  'M11 4h5v1h-5zM10 5h7v1h-7zM9 6h8v1h-8zM8 7h8v1h-8zM18 7h1v1h-1zM5 8h2v1h-2zM9 8h6v1h-6zM17 8h3v1h-3zM4 9h4v1h-4zM10 9h4v1h-4zM16 9h5v1h-5zM4 10h5v1h-5zM11 10h2v1h-2zM15 10h6v1h-6zM4 11h6v1h-6zM14 11h8v1h-8zM3 12h8v1h-8zM13 12h9v1h-9zM2 13h8v1h-8zM14 13h8v1h-8zM2 14h7v1h-7zM11 14h2v1h-2zM15 14h7v1h-7zM2 15h6v1h-6zM10 15h4v1h-4zM16 15h6v1h-6zM3 16h4v1h-4zM9 16h6v1h-6zM17 16h5v1h-5zM3 17h3v1h-3zM8 17h8v1h-8zM18 17h3v1h-3z';
const CONTORNO =
  'M11 3h5v1h-5zM10 4h1v1h-1zM16 4h1v1h-1zM9 5h1v1h-1zM17 5h1v1h-1zM7 6h2v1h-2zM5 7h1v1h-1zM19 7h1v1h-1zM4 8h1v1h-1zM20 8h1v1h-1zM3 9h1v1h-1zM21 9h1v1h-1zM3 10h1v1h-1zM21 10h1v1h-1zM3 11h1v1h-1zM22 11h1v1h-1zM2 12h1v1h-1zM22 12h1v1h-1zM1 13h1v1h-1zM22 13h1v1h-1zM1 14h1v1h-1zM22 14h1v1h-1zM1 15h1v1h-1zM22 15h1v1h-1zM2 16h1v1h-1zM22 16h1v1h-1zM2 17h1v1h-1zM21 17h1v1h-1zM2 18h3v1h-3zM7 18h10v1h-10zM19 18h3v1h-3z';
const FLECHAS =
  'M1 1h5v1h-5zM18 1h5v1h-5zM1 2h5v1h-5zM18 2h5v1h-5zM1 3h3v1h-3zM20 3h3v1h-3zM1 4h4v1h-4zM19 4h4v1h-4zM1 5h2v1h-2zM4 5h2v1h-2zM18 5h2v1h-2zM21 5h2v1h-2zM5 6h2v1h-2zM17 6h2v1h-2zM6 7h2v1h-2zM16 7h2v1h-2zM7 8h2v1h-2zM15 8h2v1h-2zM8 9h2v1h-2zM14 9h2v1h-2zM9 10h2v1h-2zM13 10h2v1h-2zM10 11h4v1h-4zM11 12h2v1h-2zM10 13h4v1h-4zM9 14h2v1h-2zM13 14h2v1h-2zM8 15h2v1h-2zM14 15h2v1h-2zM7 16h2v1h-2zM15 16h2v1h-2zM6 17h2v1h-2zM16 17h2v1h-2zM5 18h2v1h-2zM17 18h2v1h-2zM4 19h2v1h-2zM18 19h2v1h-2zM3 20h2v1h-2zM19 20h2v1h-2zM2 21h2v1h-2zM20 21h2v1h-2zM1 22h2v1h-2zM21 22h2v1h-2z';

export const LogoPaygent = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    shapeRendering="crispEdges"
    aria-hidden="true"
    className={cn('size-8', className)}
  >
    <path d={RELLENO} fill="var(--paper-raised)" />
    <path d={CONTORNO} fill="var(--grafito)" />
    <path d={FLECHAS} fill="var(--firma)" />
  </svg>
);
