import type { Job } from "../types/job";
import { serpApiJobSourceName } from "./job-sources";

const defaultExcludedJobSourceUrls = [
  "https://www.adzuna.com/details/5763079616",
  // Confirmed HTTP 404/410 or ATS removal in docs/link-audit-60.json (2026-09-23).
  "https://aidevboard.com/job/6ed45b53-3ebe-41a1-9dcf-a596a72d3249",
  "https://bebee.com/us/jobs/mdm-data-engineer-enexus-global-dallas-tx-united-states--oneredce-6874_1c53d6123a147dc9d89b8d28447b8875?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://bebee.com/us/jobs/senior-endpoint-engineer-dual-platform-zero-touch-deploy-swiftcruit-chicago--pureheal-28528_23106_404a0f78131ffafa994b586d0b3598d4?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://br.jobsora.com/oferta-53473781806",
  "https://careers.teksystems.com/us/en/job/JP-006261912/Intune-Engineer?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://careers.usbank.com/global/en/job/UBNAGLOBAL20260025708EXTERNALENGLOBAL/Senior-Windows-Endpoint-Engineer?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://careers.zacharypiper.com/details/1000/windows_endpoint_engineer?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://careers.zacharypiper.com/details/930/senior_windows_endpoint_engineer_174380?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://haystackapp.io/jobs/328cf0d4-eea1-450f-a052-a15e2ee6b6a6?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://jobs.appcast.io/leidos/intune-engineer/58695016311?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://us.trabajo.org/job-28652-ee0eaf877f14d3b382c37ccd324f6dd3?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.careers.ford.com/job/dearborn/platform-engineer-infrastructure/48560/95946661344?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.clearancejobs.com/jobs/9163098/desktop-and-windows-engineer?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.clearancejobs.com/jobs/9163099/desktop-and-windows-engineer?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.clearancejobs.com/jobs/9173270/cyber-security-services-endpoint-security-administration?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.dice.com/job-detail/1872801e-1f2e-45ca-b93c-03c4b4baefe0?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.dice.com/job-detail/52d61535-b827-448f-a24e-ce44081bdfa5?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.dice.com/job-detail/c8619ae9-bcc6-4b94-8024-119929a34d66?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.dice.com/job-detail/dfc36df2-f44a-46cf-87a6-63988bb0a431?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.learn4good.com/jobs/albany/georgia/info_technology/5475202860/e/?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.learn4good.com/jobs/cleveland/tennessee/info_technology/5481054008/e/?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.learn4good.com/jobs/cookeville/tennessee/info_technology/5481057739/e/?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.learn4good.com/jobs/covington/kentucky/info_technology/5473094139/e/?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.learn4good.com/jobs/hayden/idaho/management_and_managerial/5474818869/e/?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.learn4good.com/jobs/seattle/washington/info_technology/5452191450/e/?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",
  "https://www.learn4good.com/jobs/winchester/kentucky/info_technology/5464418001/e/?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic"
];

const sourceFreshnessRules: Partial<
  Record<Job["source"], { maxFetchedAgeDays?: number; maxPostedAgeDays?: number }>
> = {
  Adzuna: {
    maxFetchedAgeDays: 7,
    maxPostedAgeDays: 30
  },
  [serpApiJobSourceName]: {
    maxFetchedAgeDays: 7
  }
};

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
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
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
