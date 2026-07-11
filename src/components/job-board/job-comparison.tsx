import type { CSSProperties } from "react";

import { ExternalLink, Scale, X } from "lucide-react";

import { formatPostedDate, getFreshnessLabel } from "@/lib/jobs";
import type { Job } from "@/types/job";

const minimumComparedJobs = 2;

export function JobComparison({
  jobs,
  onClear,
  onRemove
}: {
  jobs: Job[];
  onClear: () => void;
  onRemove: (jobId: string) => void;
}) {
  if (jobs.length === 0) return null;

  if (jobs.length < minimumComparedJobs) {
    return (
      <aside className="comparison-prompt" aria-live="polite">
        <Scale size={20} aria-hidden="true" />
        <div>
          <strong>1 role selected</strong>
          <span>Select one more role to compare.</span>
        </div>
        <button type="button" onClick={onClear}>Clear</button>
      </aside>
    );
  }

  return (
    <section className="comparison-panel" id="job-comparison" aria-labelledby="comparison-title">
      <div className="comparison-heading">
        <div>
          <span className="section-kicker">Shortlist analysis</span>
          <h2 id="comparison-title">Compare {jobs.length} roles</h2>
        </div>
        <button className="comparison-clear" type="button" onClick={onClear}>
          Clear comparison
        </button>
      </div>

      <div className="comparison-scroll" tabIndex={0}>
        <table
          aria-label="Job comparison"
          className="comparison-grid"
          style={{ "--comparison-columns": jobs.length } as CSSProperties}
        >
          <thead>
            <tr>
              <th className="comparison-label comparison-label--header" scope="col">
                <Scale size={20} aria-hidden="true" />
                Roles
              </th>
              {jobs.map((job) => (
                <th className="comparison-job-heading" key={job.id} scope="col">
                  <button
                    aria-label={`Remove ${job.title} at ${job.company} from comparison`}
                    className="comparison-remove"
                    type="button"
                    onClick={() => onRemove(job.id)}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                  <strong>{job.title}</strong>
                  <span>{job.company}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ComparisonRow jobs={jobs} label="Employer" render={(job) => job.company} />
            <ComparisonRow jobs={jobs} label="Salary" render={(job) => job.salary?.label ?? "Not shown"} />
            <ComparisonRow jobs={jobs} label="Location" render={(job) => job.location} />
            <ComparisonRow jobs={jobs} label="Workplace" render={(job) => job.workplace} />
            <ComparisonRow jobs={jobs} label="Seniority" render={(job) => job.seniority} />
            <ComparisonRow
              jobs={jobs}
              label="Tools"
              render={(job) => [...job.platforms, ...job.tools].join(", ") || "Not specified"}
            />
            <ComparisonRow
              jobs={jobs}
              label="Freshness"
              render={(job) => `${getFreshnessLabel(job.postedAt)} · ${formatPostedDate(job.postedAt)}`}
            />
            <tr>
              <th className="comparison-label" scope="row">Apply</th>
              {jobs.map((job) => (
                <td className="comparison-value" key={`${job.id}-apply`}>
                  {job.applyUrl ? (
                    <a href={job.applyUrl} rel="noopener noreferrer" target="_blank">
                      Open role
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  ) : (
                    "Unavailable"
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ComparisonRow({
  jobs,
  label,
  render
}: {
  jobs: Job[];
  label: string;
  render: (job: Job) => string;
}) {
  return (
    <tr>
      <th className="comparison-label" scope="row">{label}</th>
      {jobs.map((job) => (
        <td className="comparison-value" key={`${job.id}-${label}`}>
          {render(job)}
        </td>
      ))}
    </tr>
  );
}
