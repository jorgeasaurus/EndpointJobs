"use client";

import { useMemo, useRef, useState } from "react";

import type { BoardListing, BoardPage } from "@/lib/board-page";
import type { EndpointTool } from "@/types/job";
import { withInitialTools, type FilterAction } from "./job-board/filter-model";

import { getActiveFilterItems } from "./job-board/active-filters";
import { updateComparisonSelection } from "./job-board/comparison-selection";
import { CommandPanel, CommandStatusRail, StickyActiveFilters } from "./job-board/controls";
import { JobMap } from "./job-board/job-map";
import { JobComparison } from "./job-board/job-comparison";
import { ParallaxBackground } from "./job-board/parallax-background";
import { ResultsPanel } from "./job-board/results-panel";
import { SiteFooter, Topbar } from "./job-board/topbar";
import { useBoardMap, useBoardPage, useDebouncedFilters } from "./job-board/use-board-results";
import { useSearchFocusShortcut } from "./job-board/use-search-focus-shortcut";
import { useUrlSyncedFilters } from "./job-board/use-url-synced-filters";

export function JobBoard({
  initialPage,
  initialSelectedTools
}: {
  initialPage: BoardPage;
  initialSelectedTools?: readonly EndpointTool[];
}) {
  const [filters, dispatchFilters] = useUrlSyncedFilters(initialSelectedTools);
  const initialFilterKey = useMemo(
    () => JSON.stringify(withInitialTools(initialSelectedTools ?? [])),
    [initialSelectedTools]
  );
  const [pagination, setPagination] = useState({
    filterKey: initialFilterKey,
    page: 1
  });
  const [mapExpanded, setMapExpanded] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [seenState, setSeenState] = useState(() => ({
    jobs: initialPage.jobs,
    map: new Map(initialPage.jobs.map((job) => [job.id, job]))
  }));
  const resultsSectionRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useSearchFocusShortcut(searchInputRef);

  const debouncedFilters = useDebouncedFilters(filters);
  const debouncedFilterKey = JSON.stringify(debouncedFilters);
  const requestedPage = pagination.filterKey === debouncedFilterKey ? pagination.page : 1;
  const board = useBoardPage(initialPage, debouncedFilters, requestedPage, initialFilterKey);
  const map = useBoardMap(debouncedFilters, mapExpanded);
  const snapshot = board.page;
  let seenJobs = seenState.map;

  if (seenState.jobs !== snapshot.jobs) {
    const nextMap = new Map(seenState.map);
    for (const job of snapshot.jobs) nextMap.set(job.id, job);
    seenJobs = nextMap;
    setSeenState({ jobs: snapshot.jobs, map: nextMap });
  }

  const comparedJobs = useMemo(() => {
    return [...selectedJobIds]
      .map((jobId) => seenJobs.get(jobId))
      .filter((job): job is BoardListing => Boolean(job));
  }, [seenJobs, selectedJobIds]);

  const totalPages = snapshot.totalPages;
  const currentPage = board.status === "loading" ? requestedPage : snapshot.page;
  const pageStartIndex = (currentPage - 1) * snapshot.pageSize;
  const pageStart = snapshot.total === 0 ? 0 : pageStartIndex + 1;
  const pageEnd = Math.min(pageStartIndex + snapshot.pageSize, snapshot.total);
  const activeFilterItems = getActiveFilterItems(filters);
  const activeFilterCount = activeFilterItems.length;
  const activeFilterLabel =
    activeFilterCount +
    " active " +
    (activeFilterCount === 1 ? "filter" : "filters");

  function dispatch(action: FilterAction) {
    if (action.type === "setSort") {
      setPagination({ filterKey: "", page: 1 });
    }
    dispatchFilters(action);
  }

  function clearFilters() {
    dispatch({ type: "clear" });
  }

  function changePage(page: number) {
    const nextPage = Math.min(Math.max(page, 1), totalPages);

    setPagination({ filterKey: debouncedFilterKey, page: nextPage });
    requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      resultsSectionRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });
    });
  }

  function toggleComparison(job: BoardListing) {
    setSeenState((current) => {
      if (current.map.get(job.id) === job) return current;
      const nextMap = new Map(current.map);
      nextMap.set(job.id, job);
      return { jobs: current.jobs, map: nextMap };
    });
    setSelectedJobIds((current) =>
      updateComparisonSelection(current, { type: "toggle", jobId: job.id })
    );
  }

  return (
    <main className="site-frame">
      <ParallaxBackground />

      <div className="site-content">
        <Topbar updatedAt={snapshot.updatedAt} />

        <section
          className="workbench"
          id="search"
          aria-label="Endpoint job search"
        >
          <CommandPanel
            activeFilterCount={activeFilterCount}
            activeFilterLabel={activeFilterLabel}
            activeJobsCount={snapshot.trackedJobsCount}
            clearFilters={clearFilters}
            dispatch={dispatch}
            filters={filters}
            workplaceCounts={snapshot.workplaceCounts}
            searchInputRef={searchInputRef}
            visibleJobsCount={snapshot.total}
            mappedJobsCount={snapshot.metrics.mappedJobsCount}
            remoteJobsCount={snapshot.metrics.remoteJobsCount}
            salaryJobsCount={snapshot.metrics.salaryJobsCount}
          />
        </section>

        <StickyActiveFilters
          activeFilterItems={activeFilterItems}
          clearFilters={clearFilters}
          dispatch={dispatch}
        />

        <JobMap
          expanded={mapExpanded}
          id="map"
          isLoading={map.status === "loading"}
          jobs={map.jobs}
          knownMappedCount={snapshot.metrics.mappedJobsCount}
          loadFailed={map.status === "error"}
          onExpandedChange={setMapExpanded}
          onRetry={map.retry}
          totalJobCount={snapshot.total}
        />

        <JobComparison
          jobs={comparedJobs}
          onClear={() =>
            setSelectedJobIds((current) =>
              updateComparisonSelection(current, { type: "clear" })
            )
          }
          onRemove={(jobId) =>
            setSelectedJobIds((current) =>
              updateComparisonSelection(current, { type: "remove", jobId })
            )
          }
        />

        <section
          aria-busy={board.status === "loading"}
          className="board-grid"
          id="open-roles"
          ref={resultsSectionRef}
        >
          {board.status === "loading" ? <p className="sr-only">Loading results</p> : null}
          {board.status === "error" ? (
            <p className="board-query-error" role="alert">
              Results did not refresh.
              <button type="button" onClick={board.retry}>
                Try again
              </button>
            </p>
          ) : null}
          <ResultsPanel
            clearFilters={clearFilters}
            currentPage={currentPage}
            filters={filters}
            onPageChange={changePage}
            onSortChange={(value) => dispatch({ type: "setSort", value })}
            sort={filters.sort}
            pageEnd={pageEnd}
            pageStart={pageStart}
            totalJobs={snapshot.total}
            totalPages={totalPages}
            query={filters.query}
            selectedJobIds={selectedJobIds}
            toggleComparison={toggleComparison}
            visibleJobs={snapshot.jobs}
          />
        </section>

        <details className="search-coverage-mobile">
          <summary>Coverage stats</summary>
          <CommandStatusRail
            activeJobsCount={snapshot.trackedJobsCount}
            mappedJobsCount={snapshot.metrics.mappedJobsCount}
            remoteJobsCount={snapshot.metrics.remoteJobsCount}
            salaryJobsCount={snapshot.metrics.salaryJobsCount}
            visibleJobsCount={snapshot.total}
          />
        </details>

        <SiteFooter updatedAt={snapshot.updatedAt} />
      </div>
    </main>
  );
}
