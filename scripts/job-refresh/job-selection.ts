import { normalizeJobSourceUrl } from "../../src/lib/job-exclusions";
import type { Job } from "../../src/types/job";
import { normalizeSearchText } from "./shared";

const directJobSources = new Set([
  "Activate",
  "Amazon Jobs",
  "Ashby",
  "Greenhouse",
  "Jibe",
  "Lever",
  "Recruitee",
  "SmartRecruiters",
  "USAJOBS",
  "Workable",
  "Workday"
]);

export function selectFeedJobs(
  jobs: Job[],
  reservedJobIds: ReadonlySet<string> = new Set()
) {
  const byCanonicalSourceUrl = new Map<string, Job>();

  for (const job of jobs) {
    const key = normalizeJobSourceUrl(job.sourceUrl) ?? job.sourceUrl;
    const existing = byCanonicalSourceUrl.get(key);

    byCanonicalSourceUrl.set(
      key,
      existing ? pickPreferredDuplicate(existing, job, reservedJobIds) : job
    );
  }

  const byEquivalentRole = new Map<string, Job>();

  for (const job of byCanonicalSourceUrl.values()) {
    const key = normalizeSearchText([job.title, job.company, job.location].join("|"));
    const existing = byEquivalentRole.get(key);

    byEquivalentRole.set(
      key,
      existing ? pickPreferredDuplicate(existing, job, reservedJobIds) : job
    );
  }

  return Array.from(byEquivalentRole.values()).sort(compareFeedSelectionPriority);
}

function pickPreferredDuplicate(
  first: Job,
  second: Job,
  reservedJobIds: ReadonlySet<string>
) {
  const reservationDifference = Number(reservedJobIds.has(second.id))
    - Number(reservedJobIds.has(first.id));

  if (reservationDifference !== 0) {
    return reservationDifference > 0 ? second : first;
  }

  const directSourceDifference = Number(isDirectJob(second)) - Number(isDirectJob(first));

  if (directSourceDifference !== 0) {
    return directSourceDifference > 0 ? second : first;
  }

  const dateConfidenceDifference = Number(hasKnownPublicationDate(second)) - Number(hasKnownPublicationDate(first));

  if (dateConfidenceDifference !== 0) {
    return dateConfidenceDifference > 0 ? second : first;
  }

  return new Date(second.postedAt).getTime() > new Date(first.postedAt).getTime() ? second : first;
}

export function compareFeedSelectionPriority(first: Job, second: Job) {
  const dateConfidenceDifference = Number(hasKnownPublicationDate(second)) - Number(hasKnownPublicationDate(first));

  if (dateConfidenceDifference !== 0) {
    return dateConfidenceDifference;
  }

  return new Date(second.postedAt).getTime() - new Date(first.postedAt).getTime();
}

function hasKnownPublicationDate(job: Job) {
  return new Date(job.postedAt).getTime() !== new Date(job.fetchedAt).getTime();
}

function isDirectJob(job: Job) {
  return directJobSources.has(job.source);
}
