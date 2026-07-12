import { isExcludedJobSourceUrl } from "../../src/lib/job-exclusions";
import type { Job, JobsFeed } from "../../src/types/job";

export function shouldWriteFeed(jobCount: number, allowEmpty: boolean) {
  return jobCount > 0 || allowEmpty;
}

export function validateFeed(
  feed: JobsFeed,
  additionalExcludedSourceUrls: Iterable<string> = []
) {
  const seenIds = new Set<string>();

  for (const job of feed.jobs) {
    if (seenIds.has(job.id)) {
      throw new Error(`Duplicate job id in feed: ${job.id}`);
    }

    seenIds.add(job.id);
    assertPresent(job.source, job.id, "source");
    assertPresent(job.sourceUrl, job.id, "sourceUrl");
    assertPresent(job.applyUrl, job.id, "applyUrl");
    assertPresent(job.fetchedAt, job.id, "fetchedAt");
    assertPresent(job.postedAt, job.id, "postedAt");
    assertPresent(job.staleAfter, job.id, "staleAfter");
    assertPresent(job.attributionLabel, job.id, "attributionLabel");
    assertPresent(job.termsProfile, job.id, "termsProfile");
    assertNonEmptyList(job.matchReasons, job.id, "matchReasons");
    assertValidMapLocation(job);

    if (job.source === "Adzuna") {
      assertNotExcludedJob(job, additionalExcludedSourceUrls);
      assertNoAdzunaSnippetFields(job);
    }
  }
}

function assertNotExcludedJob(job: Job, additionalExcludedSourceUrls: Iterable<string>) {
  if (isExcludedJobSourceUrl(job.sourceUrl, additionalExcludedSourceUrls)) {
    throw new Error(`Excluded job ${job.id} is still present in feed`);
  }
}

function assertNoAdzunaSnippetFields(job: Job) {
  if (job.description) {
    throw new Error(`Adzuna job ${job.id} stores a snippet as description`);
  }

  if (job.summary.trim().endsWith("...")) {
    throw new Error(`Adzuna job ${job.id} summary appears to be a clipped API snippet`);
  }
}

function assertPresent(value: unknown, id: string, field: string) {
  if (!value) {
    throw new Error(`Job ${id} is missing ${field}`);
  }
}

function assertNonEmptyList(value: unknown, id: string, field: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Job ${id} is missing ${field}`);
  }
}

function assertValidMapLocation(job: Job) {
  if (!job.mapLocation) {
    return;
  }

  const { latitude, longitude } = job.mapLocation;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(`Job ${job.id} has invalid mapLocation coordinates`);
  }
}
