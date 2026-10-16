import { type Category } from '@openroute/shared';
import { Banknote, Pill, ShoppingBasket, Wifi } from 'lucide-react';

// Ícono por categoría de comercio (mercado, farmacia, efectivo, datos).
const ICONOS = {
  mercado: ShoppingBasket,
  farmacia: Pill,
  efectivo: Banknote,
  datos: Wifi,
} satisfies Record<Category, unknown>;

export const ComercioIcono = ({ category }: { category: Category }) => {
  const Icono = ICONOS[category] ?? ShoppingBasket;
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-firma-tint text-firma"
    >
      <Icono className="size-5" />
    </span>
  );
};
