"use client";

import Link from "next/link";
import { Fragment, useState } from "react";

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
import type { BoardListing } from "@/lib/board-page";
import { listingLanguage, presentSalary } from "@/lib/job-trust";
import { getCurrencySymbol } from "@/lib/currency";

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
  job: BoardCardJob;
  onToggleComparison: (job: BoardCardJob) => void;
  query: string;
}) {
  const listingDescription = useListingDescription(job);
  const descriptionBlocks = getJobDescriptionBlocks({
    summary: job.summary,
    description: listingDescription.description
  });
  const salary = presentSalary(job);
  const language = listingDescription.description
    ? listingLanguage({ ...job, description: listingDescription.description })
    : job.language;
  const postedLabel = getJobPostedDateLabel(job);
  const hasMore = cardHasExpandableDetails(job, listingDescription.hasFetchedDescription, descriptionBlocks.length);

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
        <JobCardDetails
          blocks={descriptionBlocks}
          job={job}
          listingDescription={listingDescription}
        />
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

type BoardCardJob = BoardListing & { description?: string };

type ListingDescription = ReturnType<typeof useListingDescription>;

function cardHasExpandableDetails(
  job: BoardCardJob,
  hasFetchedDescription: boolean,
  descriptionBlockCount: number
) {
  return !hasFetchedDescription
    || descriptionBlockCount > 0
    || job.matchReasons.length > 0
    || job.platforms.length > 0
    || job.tools.length > 0;
}

function JobCardDetails({
  blocks,
  job,
  listingDescription
}: {
  blocks: ReturnType<typeof getJobDescriptionBlocks>;
  job: BoardCardJob;
  listingDescription: ListingDescription;
}) {
  const { descriptionStatus, loadDescription } = listingDescription;

  return (
    <details
      className="description-details"
      onToggle={(event) => {
        if (event.currentTarget.open) loadDescription();
      }}
    >
      <summary>
        <span>More description</span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="description-body">
        {descriptionStatus === "loading" ? <p>Loading description…</p> : null}
        {descriptionStatus === "error" ? (
          <p>
            Description did not load.{" "}
            <button type="button" onClick={loadDescription}>
              Try again
            </button>
          </p>
        ) : null}
        <DescriptionContent blocks={blocks} />
        {job.matchReasons.length > 0 ? <MatchRecommendation reasons={job.matchReasons} /> : null}
        <ToolChips platforms={job.platforms} tools={job.tools} />
      </div>
    </details>
  );
}

function useListingDescription(job: BoardCardJob) {
  const [fetchedDescription, setFetchedDescription] = useState<string | null | undefined>(undefined);
  const [descriptionStatus, setDescriptionStatus] = useState<"idle" | "loading" | "error">("idle");
  const description = fetchedDescription === undefined ? job.description : fetchedDescription ?? undefined;

  function loadDescription() {
    if (job.description || fetchedDescription !== undefined || descriptionStatus === "loading") return;

    setDescriptionStatus("loading");
    fetch(`/api/board/listings/${encodeURIComponent(job.id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Description request failed (${response.status})`);
        return response.json() as Promise<{ description?: string | null }>;
      })
      .then((body) => {
        setFetchedDescription(body.description ?? null);
        setDescriptionStatus("idle");
      })
      .catch(() => {
        setDescriptionStatus("error");
      });
  }

  return {
    description,
    descriptionStatus,
    hasFetchedDescription: fetchedDescription !== undefined || Boolean(job.description),
    loadDescription
  };
}

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
