import { Fragment } from "react";

import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  MapPin
} from "lucide-react";

import {
  formatPostedDate,
  getExpandedDescriptionParagraphs,
  getFreshnessLabel
} from "@/lib/jobs";
import type { Job } from "@/types/job";

export function JobCard({ job, query }: { job: Job; query: string }) {
  const descriptionParagraphs = getExpandedDescriptionParagraphs(job);

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
          <h3>
            <HighlightedText query={query} text={job.title} />
          </h3>
          <p className="company-line">
            <BriefcaseBusiness size={16} aria-hidden="true" />
            <HighlightedText query={query} text={job.company} />
          </p>
        </div>
        <span className="workplace">{job.workplace}</span>
      </div>

      <p className="summary">
        <HighlightedText query={query} text={job.summary} />
      </p>

      {descriptionParagraphs.length > 0 ? (
        <details className="description-details">
          <summary>
            <span>More description</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="description-body">
            {descriptionParagraphs.map((paragraph, index) => (
              <p key={paragraph.slice(0, 48) + index}>{paragraph}</p>
            ))}
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
          <a
            className="apply-link"
            href={job.applyUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
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

type HighlightPart = {
  isMatch: boolean;
  text: string;
};

function HighlightedText({ query, text }: { query: string; text: string }) {
  return getHighlightParts(text, query).map((part, index) =>
    part.isMatch ? (
      <mark className="search-hit" key={part.text + index}>
        {part.text}
      </mark>
    ) : (
      <Fragment key={part.text + index}>{part.text}</Fragment>
    )
  );
}

function getHighlightParts(text: string, query: string): HighlightPart[] {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return [{ isMatch: false, text }];
  }

  const pattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "ig");
  const parts = text.split(pattern);

  const highlightedParts: HighlightPart[] = [];

  for (const part of parts) {
    if (!part) continue;

    highlightedParts.push({
      isMatch: part.toLowerCase() === normalizedQuery.toLowerCase(),
      text: part
    });
  }

  return highlightedParts;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
