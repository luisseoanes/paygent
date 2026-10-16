import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { Button } from '../button';
import { Link } from '../link';

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
};

// Pagination stored in the URL (?page=2) so it survives reloads and can be shared.
export const Pagination = ({ currentPage, totalPages }: PaginationProps) => {
  const [searchParams] = useSearchParams();

  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    return `?${params.toString()}`;
  };

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4"
    >
      <p className="text-sm text-muted-foreground">
        Page <span className="font-medium text-foreground">{currentPage}</span>{' '}
        of <span className="font-medium text-foreground">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          asChild={hasPrevious}
          disabled={!hasPrevious}
        >
          {hasPrevious ? (
            <Link variant="unstyled" to={hrefFor(currentPage - 1)}>
              <ChevronLeft aria-hidden="true" /> Previous
            </Link>
          ) : (
            <>
              <ChevronLeft aria-hidden="true" /> Previous
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          asChild={hasNext}
          disabled={!hasNext}
        >
          {hasNext ? (
            <Link variant="unstyled" to={hrefFor(currentPage + 1)}>
              Next <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <>
              Next <ChevronRight aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </nav>
  );
};
