import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps,
} from 'react-router';

import { cn } from '@/utils/cn';

export type LinkProps = RouterLinkProps & {
  // "unstyled" is for links that look like something else, e.g.
  // <Button asChild><Link variant="unstyled" to={...}>Go</Link></Button>
  variant?: 'default' | 'unstyled';
};

// Wraps the router Link so the whole app shares the same link styles and
// the underlying routing library can be swapped in a single place.
export const Link = ({
  className,
  variant = 'default',
  children,
  ...props
}: LinkProps) => {
  return (
    <RouterLink
      className={cn(
        variant === 'default' &&
          'font-medium text-ink underline decoration-rule-strong underline-offset-4 transition-colors hover:decoration-ink',
        className,
      )}
      {...props}
    >
      {children}
    </RouterLink>
  );
};
