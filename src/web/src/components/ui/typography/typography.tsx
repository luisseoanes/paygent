import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/utils/cn';

// The typographic scale of the app. Use <Heading> and <Text> instead of
// styling raw h1/p tags so every screen shares the same hierarchy.

const headingVariants = cva(
  // Weight, tracking and case come from the design system tokens (theme.css).
  'font-heading [letter-spacing:var(--heading-tracking)] text-foreground [text-transform:var(--heading-case)]',
  {
    variants: {
      level: {
        // Fraunces opsz 144, clamp(48px, 7vw, 104px) / 0.95, −0.02em
        display:
          'text-[clamp(2.75rem,7vw,6.5rem)] leading-[0.95] [font-weight:var(--heading-weight)] tracking-[-0.02em] [font-variation-settings:"opsz"_144,"SOFT"_30]',
        // Fraunces opsz 72, 40 / 1.1
        h1: 'text-[2rem] leading-[1.1] [font-weight:var(--heading-weight)] [font-variation-settings:"opsz"_72,"SOFT"_30] sm:text-[2.5rem]',
        // Public Sans 28 / 1.2, 650
        h2: 'font-sans text-[1.5rem] leading-[1.2] [font-weight:var(--subheading-weight)] tracking-normal sm:text-[1.75rem]',
        // Public Sans 20 / 1.3, 600
        h3: 'font-sans text-[1.25rem] leading-[1.3] font-semibold tracking-normal',
        h4: 'font-sans text-[1.0625rem] leading-[1.35] font-semibold tracking-normal',
      },
    },
    defaultVariants: { level: 'h2' },
  },
);

const headingTags = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
} as const;

export type HeadingProps = React.ComponentProps<'h2'> &
  VariantProps<typeof headingVariants> & {
    // Render a different tag than the visual level (e.g. h2 styled as h1).
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  };

export const Heading = ({ level, as, className, ...props }: HeadingProps) => {
  const Tag = as ?? headingTags[level ?? 'h2'];
  return (
    <Tag className={cn(headingVariants({ level }), className)} {...props} />
  );
};

const textVariants = cva('', {
  variants: {
    variant: {
      lead: 'max-w-[52ch] text-lg leading-[1.5] text-muted-foreground sm:text-xl',
      body: 'text-base leading-[1.55]',
      small: 'text-sm leading-[1.45]',
      muted: 'text-sm leading-[1.45] text-muted-foreground',
      caption: 'text-xs text-muted-foreground',
      // Etiqueta / folio: Plex Mono MAYÚS 12 +0.08em
      label: 'folio text-muted-foreground',
      // Nota "por qué": Fraunces itálica opsz 14, 15 / 1.45
      why: 'font-heading text-[0.9375rem] leading-[1.45] italic [font-variation-settings:"opsz"_14]',
      // Montos e IDs
      mono: 'num',
    },
  },
  defaultVariants: { variant: 'body' },
});

export type TextProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof textVariants> & {
    as?: 'p' | 'span' | 'div';
  };

export const Text = ({
  variant,
  as: Tag = 'p',
  className,
  ...props
}: TextProps) => {
  return (
    <Tag className={cn(textVariants({ variant }), className)} {...props} />
  );
};
