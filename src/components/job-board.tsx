"use client";

import { useMemo, useRef } from "react";

import { isStale } from "@/lib/jobs";
import type { JobsFeed } from "@/types/job";

import { getActiveFilterItems } from "./job-board/active-filters";
import { CommandPanel } from "./job-board/controls";
import { filterJobs, getLocationOptions } from "./job-board/filter-model";
import { ParallaxBackground } from "./job-board/parallax-background";
import { ResultsPanel } from "./job-board/results-panel";
import { SiteFooter, Topbar } from "./job-board/topbar";
import { useSearchFocusShortcut } from "./job-board/use-search-focus-shortcut";
import { useUrlSyncedFilters } from "./job-board/use-url-synced-filters";

export function JobBoard({ feed }: { feed: JobsFeed }) {
  const [filters, dispatch] = useUrlSyncedFilters();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useSearchFocusShortcut(searchInputRef);

  const activeJobs = useMemo(
    () => feed.jobs.filter((job) => !isStale(job)),
    [feed.jobs]
  );

  const visibleJobs = useMemo(
    () => filterJobs(activeJobs, filters),
    [activeJobs, filters]
  );

  const locationOptions = useMemo(
    () => getLocationOptions(activeJobs),
    [activeJobs]
  );

  const activeFilterItems = getActiveFilterItems(filters);
  const activeFilterCount = activeFilterItems.length;
  const activeFilterLabel =
    activeFilterCount +
    " active " +
    (activeFilterCount === 1 ? "filter" : "filters");

  function clearFilters() {
    dispatch({ type: "clear" });
  }

  return (
    <main className="site-frame">
      <ParallaxBackground />

      <div className="site-content">
        <Topbar updatedAt={feed.updatedAt} />

        <section className="workbench" aria-label="Endpoint job search">
          <CommandPanel
            activeFilterCount={activeFilterCount}
            activeFilterItems={activeFilterItems}
            activeFilterLabel={activeFilterLabel}
            activeJobsCount={activeJobs.length}
            clearFilters={clearFilters}
            dispatch={dispatch}
            filters={filters}
            locationOptions={locationOptions}
            searchInputRef={searchInputRef}
          />
        </section>

        <section className="board-grid">
          <ResultsPanel
            clearFilters={clearFilters}
            query={filters.query}
            visibleJobs={visibleJobs}
          />
        </section>

        <SiteFooter updatedAt={feed.updatedAt} />
      </div>
    </main>
  );
}
