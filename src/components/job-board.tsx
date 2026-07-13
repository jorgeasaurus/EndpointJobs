"use client";

import { useMemo, useRef, useState } from "react";

import { isActiveJob } from "@/lib/jobs";
import type { JobsFeed } from "@/types/job";

import { getActiveFilterItems } from "./job-board/active-filters";
import { updateComparisonSelection } from "./job-board/comparison-selection";
import { CommandPanel } from "./job-board/controls";
import { filterJobs } from "./job-board/filter-model";
import { JobMap } from "./job-board/job-map";
import { getJobMatch, initialMatchPreferences } from "./job-board/job-match";
import { JobComparison } from "./job-board/job-comparison";
import { MatchProfile } from "./job-board/match-profile";
import { ParallaxBackground } from "./job-board/parallax-background";
import { ResultsPanel } from "./job-board/results-panel";
import { SiteFooter, Topbar } from "./job-board/topbar";
import { useSearchFocusShortcut } from "./job-board/use-search-focus-shortcut";
import { useUrlSyncedFilters } from "./job-board/use-url-synced-filters";

const jobsPerPage = 20;

export function JobBoard({ feed }: { feed: JobsFeed }) {
  const [filters, dispatch] = useUrlSyncedFilters();
  const filterKey = JSON.stringify(filters);
  const [pagination, setPagination] = useState({
    filterKey: "",
    page: 1
  });
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [matchPreferences, setMatchPreferences] = useState(initialMatchPreferences);
  const resultsSectionRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useSearchFocusShortcut(searchInputRef);

  const activeJobs = useMemo(
    () => feed.jobs.filter((job) => isActiveJob(job)),
    [feed.jobs]
  );

  const visibleJobs = useMemo(
    () => filterJobs(activeJobs, filters),
    [activeJobs, filters]
  );
  const visibleJobMetrics = useMemo(() => {
    let mappedJobsCount = 0;
    let remoteJobsCount = 0;
    let salaryJobsCount = 0;

    for (const job of visibleJobs) {
      if (job.mapLocation) {
        mappedJobsCount += 1;
      }

      if (job.workplace === "Remote" || job.workplace === "Hybrid") {
        remoteJobsCount += 1;
      }

      if (job.salary) {
        salaryJobsCount += 1;
      }
    }

    return { mappedJobsCount, remoteJobsCount, salaryJobsCount };
  }, [visibleJobs]);
  const comparedJobs = useMemo(
    () => activeJobs.filter((job) => selectedJobIds.has(job.id)),
    [activeJobs, selectedJobIds]
  );

  const totalPages = Math.max(1, Math.ceil(visibleJobs.length / jobsPerPage));
  const currentPage = pagination.filterKey === filterKey ? pagination.page : 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * jobsPerPage;
  const pagedJobs = visibleJobs.slice(pageStartIndex, pageStartIndex + jobsPerPage);
  const pageStart = visibleJobs.length === 0 ? 0 : pageStartIndex + 1;
  const pageEnd = Math.min(pageStartIndex + jobsPerPage, visibleJobs.length);

  const activeFilterItems = getActiveFilterItems(filters);
  const activeFilterCount = activeFilterItems.length;
  const activeFilterLabel =
    activeFilterCount +
    " active " +
    (activeFilterCount === 1 ? "filter" : "filters");

  function clearFilters() {
    dispatch({ type: "clear" });
  }

  function changePage(page: number) {
    const nextPage = Math.min(Math.max(page, 1), totalPages);

    setPagination({ filterKey, page: nextPage });
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

  function toggleComparison(job: JobsFeed["jobs"][number]) {
    setSelectedJobIds((current) =>
      updateComparisonSelection(current, { type: "toggle", jobId: job.id })
    );
  }

  return (
    <main className="site-frame">
      <ParallaxBackground />

      <div className="site-content">
        <Topbar updatedAt={feed.updatedAt} />

        <section
          className="workbench"
          id="search"
          aria-label="Endpoint job search"
        >
          <CommandPanel
            activeFilterCount={activeFilterCount}
            activeFilterItems={activeFilterItems}
            activeFilterLabel={activeFilterLabel}
            activeJobsCount={activeJobs.length}
            clearFilters={clearFilters}
            dispatch={dispatch}
            filters={filters}
            searchInputRef={searchInputRef}
            visibleJobsCount={visibleJobs.length}
            {...visibleJobMetrics}
          />
        </section>

        <MatchProfile
          onChange={setMatchPreferences}
          preferences={matchPreferences}
        />

        <JobMap id="map" jobs={visibleJobs} />

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

        <section className="board-grid" id="open-roles" ref={resultsSectionRef}>
          <ResultsPanel
            clearFilters={clearFilters}
            currentPage={safeCurrentPage}
            onPageChange={changePage}
            pageEnd={pageEnd}
            pageStart={pageStart}
            totalJobs={visibleJobs.length}
            totalPages={totalPages}
            query={filters.query}
            getMatch={(job) => getJobMatch(job, matchPreferences)}
            selectedJobIds={selectedJobIds}
            toggleComparison={toggleComparison}
            visibleJobs={pagedJobs}
          />
        </section>

        <SiteFooter updatedAt={feed.updatedAt} />
      </div>
    </main>
  );
}
