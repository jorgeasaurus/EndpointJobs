"use client";

import { useMemo, useReducer } from "react";

import { isStale } from "@/lib/jobs";
import type { JobsFeed } from "@/types/job";

import { CommandPanel } from "./job-board/controls";
import {
  filterJobs,
  filterReducer,
  getActiveFilterCount,
  initialFilterState
} from "./job-board/filter-model";
import { ParallaxBackground } from "./job-board/parallax-background";
import { ResultsPanel } from "./job-board/results-panel";
import { SiteFooter, Topbar } from "./job-board/topbar";

export function JobBoard({ feed }: { feed: JobsFeed }) {
  const [filters, dispatch] = useReducer(filterReducer, initialFilterState);

  const activeJobs = useMemo(
    () => feed.jobs.filter((job) => !isStale(job)),
    [feed.jobs]
  );

  const visibleJobs = useMemo(
    () => filterJobs(activeJobs, filters),
    [activeJobs, filters]
  );

  const activeFilterCount = getActiveFilterCount(filters);
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
            activeFilterLabel={activeFilterLabel}
            activeJobsCount={activeJobs.length}
            clearFilters={clearFilters}
            dispatch={dispatch}
            filters={filters}
          />
        </section>

        <section className="board-grid">
          <ResultsPanel clearFilters={clearFilters} visibleJobs={visibleJobs} />
        </section>

        <SiteFooter updatedAt={feed.updatedAt} />
      </div>
    </main>
  );
}
