import { motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';

// Aparece al entrar en pantalla (una sola vez): se desliza desde un lado y
// se funde. Con prefers-reduced-motion se muestra sin moverse.

const DESDE = {
  abajo: { y: 56 },
  izquierda: { x: -56 },
  derecha: { x: 56 },
  escala: { scale: 0.94, y: 24 },
} as const;

export type RevelarProps = {
  children: React.ReactNode;
  desde?: keyof typeof DESDE;
  retraso?: number;
  className?: string;
};

export const Revelar = ({
  children,
  desde = 'abajo',
  retraso = 0,
  className,
}: RevelarProps) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, ...DESDE[desde] }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.8, delay: retraso, ease: [0.3, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
};
