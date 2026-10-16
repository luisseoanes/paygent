import { type FallbackProps } from 'react-error-boundary';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';

// Fallback for local error boundaries: a broken section must not break the page.
//
// <ErrorBoundary FallbackComponent={SectionErrorFallback}>
//   <SomeFeatureWidget />
// </ErrorBoundary>
export const SectionErrorFallback = ({ resetErrorBoundary }: FallbackProps) => {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-rule-strong p-6 text-center"
    >
      <Text variant="muted">Esta sección no cargó. Nada cambió.</Text>
      <Button size="sm" variant="outline" onClick={resetErrorBoundary}>
        Reintentar
      </Button>
    </div>
  );
};
