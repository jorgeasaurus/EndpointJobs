import { Clock3, Layers3 } from "lucide-react";

import type { Job } from "@/types/job";

import { AnimatedNumber } from "./animated-number";
import { maximumComparedJobs } from "./comparison-selection";
import { JobCard } from "./job-card";
import type { JobMatch } from "./job-match";
import { PaginationControls, type PaginationState } from "./pagination-controls";

export function ResultsPanel({
  clearFilters,
  currentPage,
  getMatch,
  onPageChange,
  pageEnd,
  pageStart,
  totalJobs,
  totalPages,
  query,
  selectedJobIds,
  toggleComparison,
  visibleJobs
}: PaginationState & {
  clearFilters: () => void;
  getMatch: (job: Job) => JobMatch | null;
  onPageChange: (page: number) => void;
  query: string;
  selectedJobIds: Set<string>;
  toggleComparison: (job: Job) => void;
  visibleJobs: Job[];
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
        <span className="feed-note">
          <Clock3 size={16} aria-hidden="true" />
          Daily refresh
        </span>
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
                key={job.id}
                job={job}
                match={getMatch(job)}
                onToggleComparison={toggleComparison}
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
          <p>Try fewer tool filters or search for a broader platform term.</p>
          <button className="clear-button" type="button" onClick={clearFilters}>
            Reset filters
          </button>
        </div>
      )}
    </section>
  );
}
