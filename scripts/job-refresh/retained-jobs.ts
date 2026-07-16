import { isSourceFreshnessExpired } from "../../src/lib/job-exclusions";
import type { Job } from "../../src/types/job";

const serpApiSource = "SerpAPI Google Jobs";

export function mergeRetainedSerpApiJobs(
  currentJobs: Job[],
  previousJobs: Job[],
  now: Date
) {
  const currentJobIds = new Set(currentJobs.map((job) => job.id));
  const retainedJobs = previousJobs.filter((job) => (
    job.source === serpApiSource &&
    !currentJobIds.has(job.id) &&
    !isSourceFreshnessExpired(job, now)
  ));

  return [...currentJobs, ...retainedJobs];
}
