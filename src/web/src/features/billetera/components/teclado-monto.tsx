import { Delete } from 'lucide-react';

// Teclado numérico grande (patrón Satispay): monto en pesos, sin decimales.
// Teclas de 56 px para usar con el pulgar y a pleno sol.

const TECLAS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '000',
  '0',
  'borrar',
];

export const TecladoMonto = ({
  value,
  onChange,
  max = 9_999_999,
}: {
  value: number;
  onChange: (next: number) => void;
  max?: number;
}) => {
  const pulsar = (tecla: string) => {
    if (tecla === 'borrar') return onChange(Math.floor(value / 10));
    const next = Number(`${value || ''}${tecla}`);
    if (next <= max) onChange(next);
  };
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado">
      {TECLAS.map((tecla) => (
        <button
          key={tecla}
          type="button"
          onClick={() => pulsar(tecla)}
          aria-label={tecla === 'borrar' ? 'Borrar' : tecla}
          className="cifra flex h-14 items-center justify-center rounded-2xl bg-paper-raised text-2xl text-grafito transition-colors hover:bg-hueso-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-hueso-2"
        >
          {tecla === 'borrar' ? (
            <Delete className="size-6" aria-hidden="true" />
          ) : (
            tecla
          )}
        </button>
      ))}
    </div>
  );
};
