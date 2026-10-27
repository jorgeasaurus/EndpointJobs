import type { FilterState } from "@/components/job-board/filter-model";
import { filterJobs } from "@/lib/job-filters";
import { listingLanguage, prepareBoardFeed, dedupeJobs, dedupeWorkplaceJobs, dedupedWorkplaceCounts } from "@/lib/job-trust";
import { seedPlatformChipFixture } from "@/lib/platform-chip-fixture";
import type { JobMapRecord } from "@/lib/job-map";
import { getJobWorkplace, withResolvedWorkplace } from "@/lib/workplace";
import type { Job, JobsFeed } from "@/types/job";

export const boardPageSize = 20;

export const landingPreviewLimit = 4;

const placeholderSalaryLabel = /^(?:n\/?a|tbd|tba|todo|xxx|competitive|negotiable|doe|depends on experience|not disclosed|not listed|not shown|not available|unavailable|salary not listed|salary not shown|salary not disclosed|placeholder|to be determined|[-–—_.]+)$/i;

export function hasShownSalary(job: Pick<Job, "salary">) {
  const label = job.salary?.label.trim() ?? "";
  if (!label || placeholderSalaryLabel.test(label)) return false;
  return /[1-9]/.test(label);
}

export const boardCacheControl = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

export const boardListingOmittedFields = [
  "description",
  "expiresAt",
  "mapLocation",
  "sourceUrl",
  "staleAfter",
  "termsProfile"
] as const;

export type BoardListing = Pick<
  Job,
  | "applyUrl"
  | "attributionLabel"
  | "company"
  | "employmentType"
  | "fetchedAt"
  | "id"
  | "location"
  | "matchReasons"
  | "platforms"
  | "postedAt"
  | "postedAtEvidence"
  | "roleFamily"
  | "salary"
  | "seniority"
  | "source"
  | "summary"
  | "tags"
  | "title"
  | "tools"
  | "visaSponsorship"
  | "workplace"
> & {
  hasDescription: boolean;
  language?: string;
};

export type BoardMetrics = {
  mappedJobsCount: number;
  remoteJobsCount: number;
  salaryJobsCount: number;
};

export type BoardPage = {
  jobs: BoardListing[];
  metrics: BoardMetrics;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  trackedJobsCount: number;
  updatedAt: string;
  workplaceCounts: ReturnType<typeof dedupedWorkplaceCounts>;
};

export type BoardMapJob = JobMapRecord;

export function getActiveBoardFeed(feed: JobsFeed, now = new Date()): JobsFeed {
  const preparedFeed = prepareBoardFeed(feed, now);

  return {
    ...preparedFeed,
    jobs: seedPlatformChipFixture(preparedFeed.jobs, now)
  };
}

export function queryBoardPage(
  feed: JobsFeed,
  filters: FilterState,
  page: number,
  pageSize = boardPageSize
): BoardPage {
  const activeJobs = feed.jobs;
  const { matchedJobs, visibleJobs } = selectVisibleJobs(activeJobs, filters);
  const size = pageSize > 0 ? pageSize : boardPageSize;
  const total = visibleJobs.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const requested = Number.isFinite(page) ? Math.floor(page) : 1;
  const safePage = total === 0 ? 1 : Math.min(Math.max(requested, 1), totalPages);
  const start = (safePage - 1) * size;

  return {
    updatedAt: feed.updatedAt,
    trackedJobsCount: dedupeJobs(activeJobs).length,
    workplaceCounts: dedupedWorkplaceCounts(matchedJobs),
    total,
    page: safePage,
    pageSize: size,
    totalPages,
    metrics: measureVisibleJobs(visibleJobs),
    jobs: visibleJobs.slice(start, start + size).map(toBoardListing)
  };
}

export function queryBoardMap(feed: JobsFeed, filters: FilterState): BoardMapJob[] {
  const { visibleJobs } = selectVisibleJobs(feed.jobs, filters);
  const jobs: BoardMapJob[] = [];

  for (const job of visibleJobs) {
    if (!job.mapLocation) continue;

    jobs.push({
      id: job.id,
      title: job.title,
      company: job.company,
      attributionLabel: job.attributionLabel,
      mapLocation: job.mapLocation,
      ...(job.applyUrl ? { applyUrl: job.applyUrl } : {}),
      ...(job.salary ? { salary: job.salary } : {})
    });
  }

  return jobs;
}

export function findBoardJob(feed: JobsFeed, id: string) {
  return feed.jobs.find((job) => job.id === id);
}

export function selectVisibleJobs(jobs: readonly Job[], filters: FilterState) {
  const matchedJobs = filterJobs([...jobs], { ...filters, workplace: "Any" });

  return {
    matchedJobs,
    visibleJobs: dedupeWorkplaceJobs(matchedJobs, filters.workplace)
  };
}

export function selectLandingPreview(
  jobs: readonly Job[],
  filters: FilterState,
  limit = landingPreviewLimit
) {
  const count = limit > 0 ? Math.floor(limit) : landingPreviewLimit;
  const { visibleJobs } = selectVisibleJobs(jobs, filters);
  const preview: Job[] = [];

  for (const job of visibleJobs) {
    if (!hasShownSalary(job)) continue;
    preview.push(job);
    if (preview.length === count) break;
  }

  return preview;
}

export function toBoardListing(job: Job): BoardListing {
  const resolved = withResolvedWorkplace(job);
  const language = listingLanguage(resolved);
  const listing: BoardListing = {
    id: resolved.id,
    title: resolved.title,
    company: resolved.company,
    location: resolved.location,
    workplace: resolved.workplace,
    postedAt: resolved.postedAt,
    fetchedAt: resolved.fetchedAt,
    source: resolved.source,
    attributionLabel: resolved.attributionLabel,
    summary: resolved.summary,
    tags: resolved.tags,
    matchReasons: resolved.matchReasons,
    tools: resolved.tools,
    platforms: resolved.platforms,
    roleFamily: resolved.roleFamily,
    seniority: resolved.seniority,
    employmentType: resolved.employmentType,
    hasDescription: Boolean(resolved.description?.trim())
  };

  if (resolved.visaSponsorship) listing.visaSponsorship = resolved.visaSponsorship;
  if (resolved.postedAtEvidence) listing.postedAtEvidence = resolved.postedAtEvidence;
  if (resolved.applyUrl) listing.applyUrl = resolved.applyUrl;
  if (resolved.salary) listing.salary = resolved.salary;
  if (language) listing.language = language;

  return listing;
}

export function boardListingHasMore(
  job: Pick<BoardListing, "hasDescription" | "matchReasons" | "platforms" | "tools">,
  descriptionBlockCount: number
) {
  return job.hasDescription
    || descriptionBlockCount > 0
    || job.matchReasons.length > 0
    || job.platforms.length > 0
    || job.tools.length > 0;
}

function measureVisibleJobs(jobs: readonly Job[]): BoardMetrics {
  let mappedJobsCount = 0;
  let remoteJobsCount = 0;
  let salaryJobsCount = 0;

  for (const job of jobs) {
    const workplace = getJobWorkplace(job);

    if (job.mapLocation) mappedJobsCount += 1;
    if (workplace === "Remote" || workplace === "Hybrid") remoteJobsCount += 1;
    if (hasShownSalary(job)) salaryJobsCount += 1;
  }

  return { mappedJobsCount, remoteJobsCount, salaryJobsCount };
}
