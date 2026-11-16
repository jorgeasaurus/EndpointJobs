import { isSourceFreshnessExpired } from "../../src/lib/job-exclusions";
import { serpApiJobSourceName } from "../../src/lib/job-sources";
import type { Job, JobsFeed } from "../../src/types/job";
import { validateFeed } from "./feed-safety";

export function getValidatedPreviousSerpApiJobs(feed: JobsFeed) {
  return getValidatedPreviousSourceJobs(feed, serpApiJobSourceName);
}

export function getValidatedPreviousSourceJobs(feed: JobsFeed, source: string) {
  const jobs = feed.jobs.filter((job) => job?.source === source);
  validateFeed({ ...feed, jobs });
  return jobs;
}

export function mergeRetainedSerpApiJobs(
  currentJobs: Job[],
  previousJobs: Job[],
  now: Date
) {
  const currentJobIds = new Set(currentJobs.map((job) => job.id));
  const retainedJobs = previousJobs.filter((job) => (
    job.source === serpApiJobSourceName &&
    !currentJobIds.has(job.id) &&
    !isSourceFreshnessExpired(job, now)
  ));

  return [...currentJobs, ...retainedJobs];
}
