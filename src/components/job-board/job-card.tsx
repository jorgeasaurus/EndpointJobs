import Link from "next/link";
import { Fragment } from "react";

import { getJobPath } from "@/app/site-metadata";
import {
  BriefcaseBusiness,
  ChevronDown,
  Clock3,
  ExternalLink,
  GitCompareArrows,
  MapPin
} from "lucide-react";

import {
  getJobDescriptionBlocks,
  getJobFreshnessLabel,
  getJobPostedDateLabel,
  isPostedDateKnown
} from "@/lib/jobs";
import { getJobWorkplace } from "@/lib/workplace";
import { listingLanguage, presentSalary } from "@/lib/job-trust";
import { getCurrencySymbol } from "@/lib/currency";
import type { Job } from "@/types/job";

import { DescriptionContent } from "./description-content";
import { MatchRecommendation } from "./match-recommendation";
import { ToolChips } from "./tool-chips";
import { VisaSponsorship } from "./visa-sponsorship";

export function JobCard({
  compareDisabled,
  isCompared,
  job,
  onToggleComparison,
  query
}: {
  compareDisabled: boolean;
  isCompared: boolean;
  job: Job;
  onToggleComparison: (job: Job) => void;
  query: string;
}) {
  const descriptionBlocks = getJobDescriptionBlocks(job);
  const salary = presentSalary(job);
  const language = listingLanguage(job);
  const postedLabel = getJobPostedDateLabel(job);
  const hasMore = descriptionBlocks.length > 0 || job.matchReasons.length > 0 || job.platforms.length > 0 || job.tools.length > 0;

  return (
    <article className="job-card" id={`job-${job.id}`}>
      <div className="job-card-top">
        <span className="job-card-pills">
          <span className="source-pill">{job.source}</span>
          {language ? <span className="language-pill">{language}</span> : null}
        </span>
        {isPostedDateKnown(job) ? (
          <time className="posted-pill" dateTime={job.postedAt}>
            <Clock3 size={15} aria-hidden="true" />
            {postedLabel}
          </time>
        ) : (
          <span className="posted-pill">{postedLabel}</span>
        )}
      </div>

      <div className="job-main">
        <div>
          <h3>
            <Link className="job-title-link" href={getJobPath(job.id)}>
              <HighlightedText query={query} text={job.title} />
            </Link>
          </h3>
          <p className="company-line">
            <BriefcaseBusiness size={16} aria-hidden="true" />
            <HighlightedText query={query} text={job.company} />
          </p>
        </div>
        <span className="workplace">{getJobWorkplace(job)}</span>
      </div>

      {salary ? (
        <div className="salary-row">
          <span
            aria-label={`Salary ${salary.label}`}
            className="salary-pill"
          >
            <span className="salary-currency" aria-hidden="true">{getCurrencySymbol(salary.currency)}</span>
            {salary.label}
          </span>
        </div>
      ) : null}

      <p className="summary">
        <HighlightedText query={query} text={job.summary} />
      </p>

      {hasMore ? (
        <details className="description-details">
          <summary>
            <span>More description</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="description-body">
            <DescriptionContent blocks={descriptionBlocks} />
            {job.matchReasons.length > 0 ? <MatchRecommendation reasons={job.matchReasons} /> : null}
            <ToolChips platforms={job.platforms} tools={job.tools} />
          </div>
        </details>
      ) : null}

      <VisaSponsorship sponsorship={job.visaSponsorship} />

      <div className="metadata-row">
        <span>
          <MapPin size={15} aria-hidden="true" />
          {job.location}
        </span>
        <span>{getJobFreshnessLabel(job)}</span>
        <span>{job.roleFamily}</span>
        <span>{job.seniority}</span>
        <span>{job.employmentType}</span>
      </div>

      <div className="job-actions">
        <span className="attribution-label" title={job.attributionLabel}>
          {job.attributionLabel}
        </span>
        <button
          aria-pressed={isCompared ? "true" : "false"}
          className={`compare-button${isCompared ? " is-active" : ""}`}
          disabled={compareDisabled}
          type="button"
          onClick={() => onToggleComparison(job)}
        >
          <GitCompareArrows size={16} aria-hidden="true" />
          {isCompared ? "Selected" : "Compare"}
        </button>
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
            <BriefcaseBusiness size={16} aria-hidden="true" />
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
