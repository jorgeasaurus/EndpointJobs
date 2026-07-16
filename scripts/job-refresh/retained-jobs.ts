import { isSourceFreshnessExpired } from "../../src/lib/job-exclusions";
import { serpApiJobSourceName } from "../../src/lib/job-sources";
import type { Job } from "../../src/types/job";

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
