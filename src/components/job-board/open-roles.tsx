import type { RefObject } from "react";

import type { BoardListing } from "@/lib/board-page";
import { getEmptyResultsMessage } from "./empty-results-message";
import type { FilterState, SortKey } from "./filter-model";
import { ResultsPanel } from "./results-panel";

export function OpenRolesSection({
  clearFilters,
  currentPage,
  filters,
  hideViewed,
  listedJobs,
  loading,
  onPageChange,
  onRetry,
  onSortChange,
  onToggleHideViewed,
  onToggleSaved,
  onToggleSavedOnly,
  pageEnd,
  pageStart,
  pendingScope,
  queryError,
  resultsRef,
  savedIds,
  savedOnly,
  selectedJobIds,
  signedIn,
  toggleComparison,
  totalJobs,
  totalPages,
  viewedIds,
  viewingSaved
}: {
  clearFilters: () => void;
  currentPage: number;
  filters: FilterState;
  hideViewed: boolean;
  listedJobs: readonly BoardListing[];
  loading: boolean;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onSortChange: (value: SortKey) => void;
  onToggleHideViewed: () => void;
  onToggleSaved: (job: BoardListing) => void;
  onToggleSavedOnly: () => void;
  pageEnd: number;
  pageStart: number;
  pendingScope: boolean;
  queryError: boolean;
  resultsRef: RefObject<HTMLElement | null>;
  savedIds: ReadonlySet<string>;
  savedOnly: boolean;
  selectedJobIds: Set<string>;
  signedIn: boolean;
  toggleComparison: (job: BoardListing) => void;
  totalJobs: number;
  totalPages: number;
  viewedIds: ReadonlySet<string>;
  viewingSaved: boolean;
}) {
  const busy = loading || pendingScope;

  return (
    <section
      aria-busy={busy}
      className="board-grid"
      id="open-roles"
      ref={resultsRef}
    >
      {busy ? <p className="sr-only">Loading results</p> : null}
      {queryError ? (
        <p className="board-query-error" role="alert">
          Results did not refresh.
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </p>
      ) : null}
      {pendingScope ? null : (
        <ResultsPanel
          clearFilters={clearFilters}
          currentPage={currentPage}
          emptyMessage={getEmptyResultsMessage(filters, viewingSaved ? {
            savedOnly: true,
            savedJobCount: savedIds.size
          } : undefined)}
          hideViewed={signedIn ? hideViewed : undefined}
          onPageChange={onPageChange}
          onSortChange={onSortChange}
          onToggleHideViewed={signedIn ? onToggleHideViewed : undefined}
          onToggleSaved={signedIn ? onToggleSaved : undefined}
          onToggleSavedOnly={signedIn ? onToggleSavedOnly : undefined}
          pageEnd={pageEnd}
          pageStart={pageStart}
          query={filters.query}
          savedIds={savedIds}
          savedOnly={signedIn ? savedOnly : undefined}
          selectedJobIds={selectedJobIds}
          sort={filters.sort}
          toggleComparison={toggleComparison}
          totalJobs={totalJobs}
          totalPages={totalPages}
          viewedIds={viewedIds}
          visibleJobs={listedJobs}
        />
      )}
    </section>
  );
}
