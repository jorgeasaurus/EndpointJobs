import { CheckCircle2, Database, ExternalLink } from "lucide-react";

import { formatUpdatedAt } from "@/lib/jobs";
import type { Job } from "@/types/job";

import { ToolChips } from "./tool-chips";

// Adapted from Beautiful UI's Context Cards primitive.
// https://www.beautifului.dev/#context-cards
export function JobContextCards({ job }: { job: Job }) {
  return (
    <section className="job-context" aria-labelledby="job-context-heading">
      <div className="job-context-heading">
        <span className="section-kicker">Listing evidence</span>
        <h2 id="job-context-heading">Why this role is here</h2>
      </div>

      <article className="job-context-card">
        <header>
          <h3>
            <CheckCircle2 size={15} aria-hidden="true" />
            Detected signals
          </h3>
          <strong>{job.matchReasons.length}</strong>
        </header>
        <ul>
          {job.matchReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </article>

      <article className="job-context-card">
        <header>
          <h3>
            <Database size={15} aria-hidden="true" />
            Source record
          </h3>
          <strong>{job.source}</strong>
        </header>
        <dl>
          <div>
            <dt>Attribution</dt>
            <dd>{job.attributionLabel}</dd>
          </div>
          <div>
            <dt>Retrieved</dt>
            <dd>
              <time dateTime={job.fetchedAt}>{formatUpdatedAt(job.fetchedAt)}</time>
            </dd>
          </div>
        </dl>
        <a href={job.sourceUrl} rel="noopener noreferrer" target="_blank">
          View source listing
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </article>

      <article className="job-context-card job-context-card--stack">
        <header>
          <h3>Detected stack</h3>
          <strong>{job.platforms.length + job.tools.length}</strong>
        </header>
        <ToolChips platforms={job.platforms} tools={job.tools} variant="grouped" />
      </article>
    </section>
  );
}
