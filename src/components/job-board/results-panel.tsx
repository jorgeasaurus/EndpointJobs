import { Clock3, Layers3 } from "lucide-react";

import type { Job } from "@/types/job";

import { AnimatedNumber } from "./animated-number";
import { JobCard } from "./job-card";

export function ResultsPanel({
  clearFilters,
  query,
  visibleJobs
}: {
  clearFilters: () => void;
  query: string;
  visibleJobs: Job[];
}) {
  return (
    <section className="results-panel" aria-label="Job listings">
      <div className="results-heading">
        <div>
          <span className="section-kicker">Open roles</span>
          <h2>
            <span className="sr-only">{visibleJobs.length} </span>
            <AnimatedNumber
              className="slot-number slot-number--heading"
              value={visibleJobs.length}
            />{" "}
            endpoint opportunities
          </h2>
        </div>
        <span className="feed-note">
          <Clock3 size={16} aria-hidden="true" />
          Daily refresh
        </span>
      </div>

      {visibleJobs.length > 0 ? (
        <div className="job-list">
          {visibleJobs.map((job) => (
            <JobCard key={job.id} job={job} query={query} />
          ))}
        </div>
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
