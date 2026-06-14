import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  MapPin
} from "lucide-react";

import { formatPostedDate, getFreshnessLabel } from "@/lib/jobs";
import type { Job } from "@/types/job";

export function JobCard({ job }: { job: Job }) {
  const additionalDescription = getAdditionalDescription(job);

  return (
    <article className="job-card">
      <div className="job-card-top">
        <span className="source-pill">{job.source}</span>
        <span className="posted-pill">
          <Clock3 size={15} aria-hidden="true" />
          {formatPostedDate(job.postedAt)}
        </span>
      </div>

      <div className="job-main">
        <div>
          <h3>{job.title}</h3>
          <p className="company-line">
            <BriefcaseBusiness size={16} aria-hidden="true" />
            {job.company}
          </p>
        </div>
        <span className="workplace">{job.workplace}</span>
      </div>

      <p className="summary">{job.summary}</p>

      {additionalDescription ? (
        <details className="description-details">
          <summary>
            <span>More description</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="description-body">
            <p>{additionalDescription}</p>
          </div>
        </details>
      ) : null}

      <div className="match-row" aria-label="Endpoint match reasons">
        {job.matchReasons.slice(0, 3).map((reason) => (
          <span key={reason}>
            <CheckCircle2 size={14} aria-hidden="true" />
            {reason}
          </span>
        ))}
      </div>

      <div className="metadata-row">
        <span>
          <MapPin size={15} aria-hidden="true" />
          {job.location}
        </span>
        <span>{getFreshnessLabel(job.postedAt)}</span>
        <span>{job.roleFamily}</span>
        <span>{job.seniority}</span>
        <span>{job.employmentType}</span>
        {job.salary ? <span>{job.salary.label}</span> : null}
      </div>

      <div className="tag-row" aria-label="Matched tools and platforms">
        {[...job.platforms, ...job.tools].slice(0, 8).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <div className="job-actions">
        <span className="attribution-label" title={job.attributionLabel}>
          {job.attributionLabel}
        </span>
        {job.applyUrl ? (
          <a className="apply-link" href={job.applyUrl} rel="noopener noreferrer" target="_blank">
            Apply
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        ) : (
          <span className="apply-link is-disabled">
            Seed listing
            <CheckCircle2 size={16} aria-hidden="true" />
          </span>
        )}
      </div>
    </article>
  );
}

function getAdditionalDescription(job: Job) {
  const description = job.description?.trim();

  if (!description) {
    return undefined;
  }

  const summaryPrefix = job.summary.trim().replace(/\.\.\.$/, "").trimEnd();

  if (summaryPrefix && description.startsWith(summaryPrefix)) {
    const remainder = description
      .slice(summaryPrefix.length)
      .replace(/^[\s.,;:\u2013\u2014-]+/, "")
      .trim();

    return remainder.length >= 160 ? remainder : undefined;
  }

  return description.length >= job.summary.length + 160 ? description : undefined;
}
