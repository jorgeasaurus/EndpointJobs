import {
  isExcludedJobSourceUrl,
  isSourceFreshnessExpired
} from "../../src/lib/job-exclusions";
import { isActiveJob } from "../../src/lib/jobs";

import {
  assertEqual,
  assertIncludes,
  assertNotIncludes,
  assertTruthy,
  assertValidJobShape,
  deadAdzunaUrl,
  fixedAuditNow,
  makeAdzunaJob,
  type AuditContext
} from "./shared";

export async function auditFeedIntegrity({ feed, run, sources }: AuditContext) {
  await run("FEAT-036", "Static JSON feed builds without runtime fetching", () => {
    assertTruthy(feed.updatedAt, "feed missing updatedAt");
    feed.jobs.slice(0, 10).forEach(assertValidJobShape);
    assertIncludes(sources.page, "feedData as JobsFeed");
    assertNotIncludes(sources.page, "fetch(");
  });

  await run("FEAT-059", "Confirmed-dead Adzuna listing is excluded from data and runtime active jobs", () => {
    const matchingJobs = feed.jobs.filter(
      (job) => job.sourceUrl === deadAdzunaUrl || job.id.includes("5763079616")
    );
    assertEqual(matchingJobs.length, 0, "dead Adzuna listing still exists in feed");
    assertTruthy(isExcludedJobSourceUrl(deadAdzunaUrl), "exact dead URL is not excluded");
    assertTruthy(
      isExcludedJobSourceUrl(`${deadAdzunaUrl}/#source`),
      "normalized dead URL is not excluded"
    );
    assertIncludes(sources.refresh, "JOB_EXCLUDED_SOURCE_URLS", "refresh env configuration");
    assertIncludes(sources.refresh, "isExcludedJobSourceUrl", "refresh exclusion filter");
    assertIncludes(sources.workflow, "JOB_EXCLUDED_SOURCE_URLS", "workflow exclusion env passthrough");
    assertEqual(isActiveJob(makeAdzunaJob({ sourceUrl: deadAdzunaUrl }), fixedAuditNow), false);
  });

  await run("FEAT-060", "Adzuna aggregator listings expire on source-specific freshness rules", () => {
    const oldFetchedJob = makeAdzunaJob({
      id: "audit-old-fetched-adzuna",
      fetchedAt: "2026-06-20T02:04:09.167Z",
      postedAt: "2026-06-27T02:04:09.167Z",
      sourceUrl: "https://www.adzuna.com/details/audit-old-fetched"
    });
    const oldPostedJob = makeAdzunaJob({
      id: "audit-old-posted-adzuna",
      fetchedAt: "2026-06-28T02:04:09.167Z",
      postedAt: "2026-05-20T02:04:09.167Z",
      sourceUrl: "https://www.adzuna.com/details/audit-old-posted"
    });
    const freshJob = makeAdzunaJob({
      id: "audit-fresh-adzuna",
      fetchedAt: "2026-06-28T02:04:09.167Z",
      postedAt: "2026-06-27T02:04:09.167Z",
      sourceUrl: "https://www.adzuna.com/details/audit-fresh"
    });

    assertTruthy(isSourceFreshnessExpired(oldFetchedJob, fixedAuditNow));
    assertTruthy(isSourceFreshnessExpired(oldPostedJob, fixedAuditNow));
    assertEqual(isSourceFreshnessExpired(freshJob, fixedAuditNow), false);
    assertEqual(isActiveJob(oldFetchedJob, fixedAuditNow), false);
    assertEqual(isActiveJob(oldPostedJob, fixedAuditNow), false);
    assertEqual(isActiveJob(freshJob, fixedAuditNow), true);
    assertIncludes(sources.jobExclusions, "maxPostedAgeDays: 30", "Adzuna posted-age cap");
    assertIncludes(sources.page, "jobs: feed.jobs.filter((job) => isActiveJob(job))", "page active feed filter");
    assertIncludes(sources.page, "export const revalidate = 300", "active feed refresh interval");
    assertIncludes(sources.companyAts, "completedQueries", "Workday skips isolated query failures");
    assertIncludes(sources.page, "activeFeed", "home page active feed projection");
    assertIncludes(sources.page, "getHomeJsonLd(activeFeed)", "JSON-LD uses filtered active feed");
    assertIncludes(sources.packageJson, '"audit:data"', "package script for data audit");

    const activeExpiredAdzuna = feed.jobs.filter(
      (job) =>
        job.source === "Adzuna" &&
        isSourceFreshnessExpired(job, fixedAuditNow) &&
        isActiveJob(job, fixedAuditNow)
    );
    assertEqual(activeExpiredAdzuna.length, 0, "expired Adzuna jobs still active");
  });
}
