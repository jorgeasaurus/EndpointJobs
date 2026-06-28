import { ExternalLink } from "lucide-react";

import type { ActivePopup } from "./job-map-features";

export function JobMapPopupContent({ popup }: { popup: ActivePopup }) {
  return (
    <div className="job-map-tooltip">
      <div className="job-map-tooltip-header">
        <span>{popup.label}</span>
        {popup.type === "cluster" ? <strong>{popup.count}</strong> : null}
      </div>

      <div className="job-map-tooltip-list">
        {popup.jobs.map((job) => (
          <article className="job-map-tooltip-job" key={job.id}>
            <h3>{job.title}</h3>
            <p>{job.company}</p>
            <div className="job-map-tooltip-actions">
              <span>{job.salary}</span>
              {job.applyUrl ? (
                <a href={job.applyUrl} rel="noopener noreferrer" target="_blank">
                  Apply
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {popup.type === "cluster" && popup.count > popup.jobs.length ? (
        <p className="job-map-tooltip-more">
          Showing {popup.jobs.length} of {popup.count}
        </p>
      ) : null}
    </div>
  );
}
