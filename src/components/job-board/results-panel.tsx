import { Clock3, Layers3 } from "lucide-react";

import type { BoardListing } from "@/lib/board-page";

import { AnimatedNumber } from "./animated-number";
import { maximumComparedJobs } from "./comparison-selection";
import { JobCard } from "./job-card";
import { sortOptions, type SortKey } from "./filter-model";
import { toSortKey } from "./filter-url";
import { PaginationControls, type PaginationState } from "./pagination-controls";

export function ResultsPanel({
  clearFilters,
  currentPage,
  emptyMessage,
  hideViewed,
  onPageChange,
  onSortChange,
  onToggleHideViewed,
  onToggleSaved,
  onToggleSavedOnly,
  savedOnly,
  savedIds,
  sort,
  pageEnd,
  pageStart,
  totalJobs,
  totalPages,
  query,
  selectedJobIds,
  toggleComparison,
  viewedIds,
  visibleJobs
}: PaginationState & {
  clearFilters: () => void;
  emptyMessage: string;
  hideViewed?: boolean;
  onPageChange: (page: number) => void;
  onSortChange: (sort: SortKey) => void;
  onToggleHideViewed?: () => void;
  onToggleSaved?: (job: BoardListing) => void;
  onToggleSavedOnly?: () => void;
  savedOnly?: boolean;
  savedIds?: ReadonlySet<string>;
  sort: SortKey;
  query: string;
  selectedJobIds: Set<string>;
  toggleComparison: (job: BoardListing) => void;
  viewedIds?: ReadonlySet<string>;
  visibleJobs: readonly BoardListing[];
}) {
  return (
    <section className="results-panel" aria-label="Job listings">
      <div className="results-heading">
        <div>
          <span className="section-kicker">Open roles</span>
          <h2>
            <span className="sr-only">{totalJobs} </span>
            <AnimatedNumber
              className="slot-number slot-number--heading"
              value={totalJobs}
            />{" "}
            endpoint opportunities
          </h2>
        </div>
        <div className="results-heading-controls">
          <label className="field results-sort">
            <span>Sort by</span>
            <select
              id="results-sort"
              name="resultsSort"
              value={sort}
              onChange={(event) => onSortChange(toSortKey(event.currentTarget.value))}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span className="feed-note">
            <Clock3 size={16} aria-hidden="true" />
            Daily refresh
          </span>
          {onToggleHideViewed ? (
            <button
              aria-pressed={hideViewed ? "true" : "false"}
              className="compare-button hide-viewed-button"
              type="button"
              onClick={onToggleHideViewed}
            >
              {hideViewed ? "Showing unseen" : "Hide viewed"}
            </button>
          ) : null}
          {onToggleSavedOnly ? (
            <button
              aria-label="Saved jobs only"
              aria-pressed={savedOnly ? "true" : "false"}
              className={`compare-button saved-only-button${savedOnly ? " is-active" : ""}`}
              type="button"
              onClick={onToggleSavedOnly}
            >
              {savedOnly ? "Showing saved" : "Saved jobs only"}
            </button>
          ) : null}
        </div>
      </div>

      {totalJobs > 0 ? (
        <>
          <PaginationControls
            currentPage={currentPage}
            onPageChange={onPageChange}
            pageEnd={pageEnd}
            pageStart={pageStart}
            totalJobs={totalJobs}
            totalPages={totalPages}
          />
          <div className="job-list">
            {visibleJobs.map((job) => (
              <JobCard
                compareDisabled={selectedJobIds.size >= maximumComparedJobs && !selectedJobIds.has(job.id)}
                isCompared={selectedJobIds.has(job.id)}
                isSaved={savedIds?.has(job.id) ?? false}
                isViewed={viewedIds?.has(job.id) ?? false}
                key={job.id}
                job={job}
                onToggleComparison={toggleComparison}
                onToggleSaved={onToggleSaved}
                query={query}
              />
            ))}
          </div>
          <PaginationControls
            currentPage={currentPage}
            onPageChange={onPageChange}
            pageEnd={pageEnd}
            pageStart={pageStart}
            totalJobs={totalJobs}
            totalPages={totalPages}
          />
        </>
      ) : (
        <div className="empty-state">
          <Layers3 size={34} aria-hidden="true" />
          <h3>No matching roles</h3>
          <p>{emptyMessage}</p>
          <button className="clear-button" type="button" onClick={clearFilters}>
            Reset filters
          </button>
        </div>
      )}
    </section>
  );
}
