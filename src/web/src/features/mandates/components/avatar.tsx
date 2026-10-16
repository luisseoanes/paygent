import { Bot, ShieldCheck, Smartphone } from 'lucide-react';

import { type HolderType } from '@/types/api';
import { cn } from '@/utils/cn';

// Inicial o icono del titular de una rama: azul firma para personas,
// violeta para agentes y rojo para el agente que solo restringe (Guardián).
export const Avatar = ({
  holderType,
  name,
  restringe = false,
  size = 'md',
}: {
  holderType: HolderType;
  name: string;
  restringe?: boolean;
  size?: 'sm' | 'md';
}) => {
  const agente = holderType === 'agent';
  const Icon = restringe
    ? ShieldCheck
    : agente
      ? Bot
      : holderType === 'device'
        ? Smartphone
        : undefined;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-geist font-medium',
        size === 'md' ? 'size-9 text-sm' : 'size-7 text-xs',
        restringe
          ? 'bg-anulado-tint text-anulado'
          : agente
            ? 'bg-agente-tint text-agente'
            : 'bg-firma-tint text-firma',
      )}
    >
      {Icon ? (
        <Icon className={size === 'md' ? 'size-4' : 'size-3.5'} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
};
