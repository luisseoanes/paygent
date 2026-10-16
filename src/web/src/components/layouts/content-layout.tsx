import type * as React from 'react';

import { Head } from '@/components/seo';
import { Heading, Text } from '@/components/ui/typography';

import { Container } from './container';

type ContentLayoutProps = {
  title: string;
  description?: string;
  // Slot for page-level actions (buttons) next to the title.
  actions?: React.ReactNode;
  children: React.ReactNode;
};

// Standard wrapper for every inner page: SEO + title + consistent spacing.
export const ContentLayout = ({
  title,
  description,
  actions,
  children,
}: ContentLayoutProps) => {
  return (
    <>
      <Head title={title} description={description} />
      <Container className="py-8 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <Heading level="h1">{title}</Heading>
            {description && <Text variant="muted">{description}</Text>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
        <div className="mt-8">{children}</div>
      </Container>
    </>
  );
};
