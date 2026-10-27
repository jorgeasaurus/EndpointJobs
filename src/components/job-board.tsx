"use client";

import { useMemo, useRef, useState } from "react";

import { presentBoardResults } from "@/lib/account/records";
import type { BoardListing, BoardPage } from "@/lib/board-page";
import type { EndpointTool } from "@/types/job";
import { withInitialTools, type FilterAction } from "./job-board/filter-model";

import { getActiveFilterItems } from "./job-board/active-filters";
import { updateComparisonSelection } from "./job-board/comparison-selection";
import { CommandPanel, CommandStatusRail, StickyActiveFilters } from "./job-board/controls";
import { JobMap } from "./job-board/job-map";
import { JobComparison } from "./job-board/job-comparison";
import { ParallaxBackground } from "./job-board/parallax-background";
import { OpenRolesSection } from "./job-board/open-roles";
import { SiteFooter, Topbar } from "./job-board/topbar";
import { savedBoardQuery, useBoardMap, useBoardPage, useDebouncedFilters } from "./job-board/use-board-results";
import { useAccountBoard } from "./job-board/use-account-board";
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

  const account = useAccountBoard(filters, dispatchFilters);
  const savedQuery = useMemo(() => savedBoardQuery({
    savedIds: account.savedIds,
    savedOnly: account.savedOnly,
    savedToken: account.savedToken,
    signedIn: account.signedIn,
    usingFixture: account.usingFixture
  }), [
    account.savedIds,
    account.savedOnly,
    account.savedToken,
    account.signedIn,
    account.usingFixture
  ]);
  const debouncedFilters = useDebouncedFilters(filters);
  const debouncedFilterKey = JSON.stringify(debouncedFilters);
  const requestedPage = pagination.filterKey === debouncedFilterKey ? pagination.page : 1;
  const board = useBoardPage(initialPage, debouncedFilters, requestedPage, initialFilterKey, savedQuery);
  const map = useBoardMap(debouncedFilters, mapExpanded, savedQuery);
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

  const results = presentBoardResults({
    hideViewed: account.signedIn && account.hideViewed,
    jobs: snapshot.jobs,
    loading: board.status === "loading",
    page: snapshot.page,
    pageSize: snapshot.pageSize,
    pendingScope: board.pendingScope,
    requestedPage,
    savedIds: account.savedIds,
    savedOnly: account.signedIn && account.savedOnly && board.scope === "saved",
    total: snapshot.total,
    totalPages: snapshot.totalPages,
    viewedIds: account.viewedIds
  });
  const {
    currentPage,
    listedJobs,
    pageEnd,
    pageStart,
    totalJobs,
    totalPages,
    viewingSaved
  } = results;
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
            visibleJobsCount={totalJobs}
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

        <OpenRolesSection
          clearFilters={clearFilters}
          currentPage={currentPage}
          filters={filters}
          hideViewed={account.hideViewed}
          listedJobs={listedJobs}
          loading={board.status === "loading"}
          onPageChange={changePage}
          onRetry={board.retry}
          onSortChange={(value) => dispatch({ type: "setSort", value })}
          onToggleHideViewed={account.toggleHideViewed}
          onToggleSaved={account.toggleSaved}
          onToggleSavedOnly={() => {
            setPagination({ filterKey: "", page: 1 });
            account.toggleSavedOnly();
          }}
          pageEnd={pageEnd}
          pageStart={pageStart}
          pendingScope={board.pendingScope}
          queryError={board.status === "error"}
          resultsRef={resultsSectionRef}
          savedIds={account.savedIds}
          savedOnly={account.savedOnly}
          selectedJobIds={selectedJobIds}
          signedIn={account.signedIn}
          toggleComparison={toggleComparison}
          totalJobs={totalJobs}
          totalPages={totalPages}
          viewedIds={account.viewedIds}
          viewingSaved={viewingSaved}
        />

        <details className="search-coverage-mobile">
          <summary>Coverage stats</summary>
          <CommandStatusRail
            activeJobsCount={snapshot.trackedJobsCount}
            mappedJobsCount={snapshot.metrics.mappedJobsCount}
            remoteJobsCount={snapshot.metrics.remoteJobsCount}
            salaryJobsCount={snapshot.metrics.salaryJobsCount}
            visibleJobsCount={totalJobs}
          />
        </details>

        <SiteFooter updatedAt={snapshot.updatedAt} />
      </div>
    </main>
  );
}
