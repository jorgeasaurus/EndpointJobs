import { ChevronLeft, ChevronRight } from "lucide-react";

export type PaginationState = {
  currentPage: number;
  pageEnd: number;
  pageStart: number;
  totalJobs: number;
  totalPages: number;
};

export function PaginationControls({
  currentPage,
  onPageChange,
  pageEnd,
  pageStart,
  totalJobs,
  totalPages
}: PaginationState & {
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pageItems = getPaginationItems(currentPage, totalPages);

  return (
    <nav className="pagination-bar" aria-label="Job result pages">
      <p className="pagination-summary">
        Showing {pageStart}-{pageEnd} of {totalJobs}
      </p>
      <div className="pagination-controls">
        <button
          aria-label="Go to previous job page"
          className="pagination-button pagination-button--icon"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Previous page"
          type="button"
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <div className="pagination-pages">
          {pageItems.map((item, index) =>
            item === "gap" ? (
              <span
                aria-hidden="true"
                className="pagination-ellipsis"
                key={`gap-${index}`}
              >
                ...
              </span>
            ) : (
              <button
                aria-current={item === currentPage ? "page" : undefined}
                aria-label={`Go to job page ${item}`}
                className={
                  item === currentPage
                    ? "pagination-button is-active"
                    : "pagination-button"
                }
                key={item}
                onClick={() => onPageChange(item)}
                title={`Page ${item}`}
                type="button"
              >
                {item}
              </button>
            )
          )}
        </div>
        <button
          aria-label="Go to next job page"
          className="pagination-button pagination-button--icon"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Next page"
          type="button"
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

type PaginationItem = number | "gap";

function getPaginationItems(
  currentPage: number,
  totalPages: number
): PaginationItem[] {
  const pages = new Set<number>([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1
  ]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 2);
    pages.add(totalPages - 1);
  }

  const visiblePages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second);

  return visiblePages.flatMap((page, index) => {
    const previousPage = visiblePages[index - 1];

    if (previousPage && page - previousPage > 1) {
      return ["gap" as const, page];
    }

    return [page];
  });
}
