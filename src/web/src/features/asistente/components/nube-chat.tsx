import { motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';

import { NubePixel } from '@/components/brand/nube-pixel';

// Nube grande del paisaje que se infla desde abajo a la izquierda y deja
// dentro el chat. Al cerrarse se desvanece hacia el mismo punto.

const Bocanada = ({
  className,
  delay,
}: {
  className: string;
  delay: number;
}) => (
  <motion.span
    aria-hidden="true"
    className={`absolute rounded-full bg-paper-raised/80 ${className}`}
    initial={{ scale: 0, opacity: 0.9 }}
    animate={{ scale: [0, 1.4, 1.8], opacity: [0.9, 0.6, 0] }}
    transition={{ duration: 0.9, delay, ease: 'easeOut' }}
  />
);

export const NubeChat = ({ children }: { children: React.ReactNode }) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="relative w-full max-w-2xl"
      style={{ originX: 0.5, originY: 0.6 }}
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.25, y: 60, filter: 'blur(10px)' }
      }
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.6, y: 40, filter: 'blur(8px)' }
      }
      transition={{ type: 'spring', stiffness: 170, damping: 22, mass: 0.9 }}
    >
      {!reduceMotion && (
        <>
          <Bocanada className="-bottom-4 left-6 size-16" delay={0} />
          <Bocanada className="-bottom-8 left-24 size-10" delay={0.08} />
          <Bocanada className="bottom-10 -left-6 size-12" delay={0.14} />
        </>
      )}
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      >
        <NubePixel className="drop-shadow-[0_24px_40px_rgb(20_60_120/0.28)]">
          {children}
        </NubePixel>
      </motion.div>
    </motion.div>
  );
};
