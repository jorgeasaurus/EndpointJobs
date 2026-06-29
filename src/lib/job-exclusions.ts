import type { Job } from "../types/job";

const defaultExcludedJobSourceUrls = [
  "https://www.adzuna.com/details/5763079616"
];

const sourceFreshnessRules: Partial<
  Record<Job["source"], { maxFetchedAgeDays?: number; maxPostedAgeDays?: number }>
> = {
  Adzuna: {
    maxFetchedAgeDays: 7,
    maxPostedAgeDays: 14
  }
};

export function getDefaultExcludedJobSourceUrls() {
  return defaultExcludedJobSourceUrls;
}

export function isSourceFreshnessExpired(job: Job, now = new Date()) {
  const rule = sourceFreshnessRules[job.source];

  if (!rule) {
    return false;
  }

  return (
    isOlderThanDays(job.fetchedAt, rule.maxFetchedAgeDays, now) ||
    isOlderThanDays(job.postedAt, rule.maxPostedAgeDays, now)
  );
}

export function isExcludedJobSourceUrl(
  sourceUrl: string | undefined,
  additionalSourceUrls: Iterable<string> = []
) {
  const normalizedSourceUrl = normalizeJobSourceUrl(sourceUrl);

  if (!normalizedSourceUrl) {
    return false;
  }

  return getExcludedJobSourceUrlSet(additionalSourceUrls).has(normalizedSourceUrl);
}

export function normalizeJobSourceUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value.trim());
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function getExcludedJobSourceUrlSet(additionalSourceUrls: Iterable<string>) {
  return new Set(
    [...defaultExcludedJobSourceUrls, ...additionalSourceUrls]
      .map(normalizeJobSourceUrl)
      .filter((value): value is string => Boolean(value))
  );
}

function isOlderThanDays(value: string, days: number | undefined, now: Date) {
  if (days === undefined) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return now.getTime() - date.getTime() > days * 24 * 60 * 60 * 1000;
}
