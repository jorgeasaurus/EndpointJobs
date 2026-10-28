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

import { cardSourceLabels, dedupeJobLead, isBoilerplateListingText } from "@/lib/listing-copy";
import {
  formatPostedDate,
  getCardPostedLabel,
  getJobDescriptionBlocks
} from "@/lib/jobs";
import { getJobWorkplace } from "@/lib/workplace";
import { boardListingHasMore, type BoardListing } from "@/lib/board-page";
import { listingLanguage, presentSalary } from "@/lib/job-trust";
import { getCurrencySymbol } from "@/lib/currency";

import { DescriptionContent } from "./description-content";
import { MatchRecommendation } from "./match-recommendation";
import { ToolChips } from "./tool-chips";
import { VisaSponsorship } from "./visa-sponsorship";

export function JobCard({
  compareDisabled,
  isCompared,
  isSaved = false,
  isViewed = false,
  job,
  onToggleComparison,
  onToggleSaved,
  query
}: {
  compareDisabled: boolean;
  isCompared: boolean;
  isSaved?: boolean;
  isViewed?: boolean;
  job: BoardCardJob;
  onToggleComparison: (job: BoardCardJob) => void;
  onToggleSaved?: (job: BoardCardJob) => void;
  query: string;
}) {
  const listingDescription = useListingDescription(job);
  const presentation = presentJobCard(job, listingDescription.description);
  const salary = presentSalary(job);

  return (
    <article className="job-card" id={`job-${job.id}`}>
      <div className="job-card-top">
        <span className="job-card-pills">
          {presentation.sourceLabels.badge ? <span className="source-pill">{presentation.sourceLabels.badge}</span> : null}
          {isViewed ? <span className="viewed-pill">Viewed</span> : null}
          {presentation.language ? <span className="language-pill">{presentation.language}</span> : null}
        </span>
        {presentation.postedKnown ? (
          <time className="posted-pill" dateTime={job.postedAt} title={formatPostedDate(job.postedAt)}>
            <Clock3 size={15} aria-hidden="true" />
            {presentation.postedLabel}
          </time>
        ) : (
          <span className="posted-pill">{presentation.postedLabel}</span>
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

      {presentation.displaySummary ? (
        <p className="summary">
          <HighlightedText query={query} text={presentation.displaySummary} />
        </p>
      ) : null}

      {presentation.hasMore ? (
        <JobCardDetails
          blocks={presentation.descriptionBlocks}
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
        <span>{job.roleFamily}</span>
        <span>{job.seniority}</span>
        <span>{job.employmentType}</span>
      </div>

      <JobCardActions
        compareDisabled={compareDisabled}
        detailLabel={presentation.sourceLabels.detail}
        isCompared={isCompared}
        isSaved={isSaved}
        job={job}
        onToggleComparison={onToggleComparison}
        onToggleSaved={onToggleSaved}
        previewOnly={presentation.previewOnly}
      />
    </article>
  );
}

function JobCardActions({
  compareDisabled,
  detailLabel,
  isCompared,
  isSaved,
  job,
  onToggleComparison,
  onToggleSaved,
  previewOnly
}: {
  compareDisabled: boolean;
  detailLabel?: string;
  isCompared: boolean;
  isSaved: boolean;
  job: BoardCardJob;
  onToggleComparison: (job: BoardCardJob) => void;
  onToggleSaved?: (job: BoardCardJob) => void;
  previewOnly: boolean;
}) {
  return (
    <div className="job-actions">
      {detailLabel ? (
        <span className="attribution-label" title={detailLabel}>
          {detailLabel}
        </span>
      ) : null}
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
      {onToggleSaved ? (
        <button
          aria-pressed={isSaved ? "true" : "false"}
          className={`compare-button save-button${isSaved ? " is-active" : ""}`}
          type="button"
          onClick={() => onToggleSaved(job)}
        >
          {isSaved ? "Saved" : "Save"}
        </button>
      ) : null}
      {previewOnly ? (
        <span className="description-on-source">Description on {job.source}</span>
      ) : null}
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
  );
}

type HighlightPart = {
  isMatch: boolean;
  text: string;
};

type BoardCardJob = BoardListing & { description?: string };

function presentJobCard(job: BoardCardJob, loadedDescription: string | undefined) {
  const summaryIsBoilerplate = isBoilerplateListingText(job.summary);
  const loadedIsBoilerplate = Boolean(loadedDescription && isBoilerplateListingText(loadedDescription));
  const descriptionBlocks = loadedIsBoilerplate
    ? []
    : getJobDescriptionBlocks({
      summary: summaryIsBoilerplate ? "" : job.summary,
      description: loadedDescription
    });
  const hasRealDescription = Boolean(
    (loadedDescription && !loadedIsBoilerplate)
    || (job.hasDescription && loadedDescription === undefined)
  );
  const previewOnly = summaryIsBoilerplate && !hasRealDescription;
  const postedLabel = getCardPostedLabel(job);

  return {
    descriptionBlocks,
    displaySummary: summaryIsBoilerplate
      ? ""
      : dedupeJobLead(job.summary, loadedDescription && !loadedIsBoilerplate ? loadedDescription : ""),
    hasMore: !previewOnly && (hasRealDescription || boardListingHasMore(job, descriptionBlocks.length)),
    language: loadedDescription && !loadedIsBoilerplate
      ? listingLanguage({ ...job, description: loadedDescription })
      : job.language,
    postedKnown: postedLabel !== "Date unknown",
    postedLabel,
    previewOnly,
    sourceLabels: cardSourceLabels(job.source, job.attributionLabel)
  };
}

type ListingDescription = ReturnType<typeof useListingDescription>;

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
    if (!job.hasDescription || job.description || fetchedDescription !== undefined || descriptionStatus === "loading") return;

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
