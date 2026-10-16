import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/typography';

// Last-resort fallback for errors not caught by a closer error boundary.
export const MainErrorFallback = () => {
  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <Heading level="h2">Algo se rompió</Heading>
      <Text variant="muted">
        No es tu culpa. Recarga la página; tu mandato y tus vales siguen
        intactos.
      </Text>
      <Button onClick={() => window.location.assign(window.location.origin)}>
        Recargar
      </Button>
    </div>
  );
};
