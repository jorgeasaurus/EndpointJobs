import type { RefObject } from "react";

import type { BoardListing } from "@/lib/board-page";
import { getEmptyResultsMessage } from "./empty-results-message";
import type { FilterState, SortKey } from "./filter-model";
import { ResultsPanel } from "./results-panel";

function BoardQueryNotice({
  busy,
  onRetry,
  queryError
}: {
  busy: boolean;
  onRetry: () => void;
  queryError: boolean;
}) {
  return (
    <>
      {busy ? <p className="sr-only">Loading results</p> : null}
      {queryError ? (
        <p className="board-query-error" role="alert">
          Results did not refresh.
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </p>
      ) : null}
    </>
  );
}

function emptyMessageForView(
  filters: FilterState,
  viewingSaved: boolean,
  savedJobCount: number
) {
  if (!viewingSaved) return getEmptyResultsMessage(filters);
  return getEmptyResultsMessage(filters, { savedOnly: true, savedJobCount });
}

function signedInControls({
  hideViewed,
  onToggleHideViewed,
  onToggleSaved,
  onToggleSavedOnly,
  savedOnly,
  signedIn
}: {
  hideViewed: boolean;
  onToggleHideViewed: () => void;
  onToggleSaved: (job: BoardListing) => void;
  onToggleSavedOnly: () => void;
  savedOnly: boolean;
  signedIn: boolean;
}) {
  if (!signedIn) return {};
  return {
    hideViewed,
    onToggleHideViewed,
    onToggleSaved,
    onToggleSavedOnly,
    savedOnly
  };
}

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
      <BoardQueryNotice busy={busy} onRetry={onRetry} queryError={queryError} />
      {pendingScope ? null : (
        <ResultsPanel
          clearFilters={clearFilters}
          currentPage={currentPage}
          emptyMessage={emptyMessageForView(filters, viewingSaved, savedIds.size)}
          onPageChange={onPageChange}
          onSortChange={onSortChange}
          pageEnd={pageEnd}
          pageStart={pageStart}
          query={filters.query}
          savedIds={savedIds}
          selectedJobIds={selectedJobIds}
          sort={filters.sort}
          toggleComparison={toggleComparison}
          totalJobs={totalJobs}
          totalPages={totalPages}
          viewedIds={viewedIds}
          visibleJobs={listedJobs}
          {...signedInControls({
            hideViewed,
            onToggleHideViewed,
            onToggleSaved,
            onToggleSavedOnly,
            savedOnly,
            signedIn
          })}
        />
      )}
    </section>
  );
}
