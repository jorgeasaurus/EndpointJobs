import type { Job, Workplace } from "../types/job";

const explicitOnsiteWorkplacePattern =
  /\b(?:not a remote or hybrid|not a hybrid or remote|not a remote(?: or hybrid)? (?:position|role|job)|this (?:position|role|job) is not (?:a )?(?:remote|hybrid)(?: or (?:hybrid|remote))?(?: (?:position|role|job))?|work location:\s*in[ -]?person)\b(?!-(?:only|first))/i;

export function hasExplicitOnsiteWorkplace(text: string): boolean {
  return explicitOnsiteWorkplacePattern.test(text.replace(/\s+/g, " ").trim());
}

export function getJobWorkplaceText(
  job: Pick<Job, "location" | "summary" | "description">
) {
  return `${job.location} ${job.summary} ${job.description ?? ""}`;
}

export function getJobWorkplace(
  job: Pick<Job, "workplace" | "location" | "summary" | "description">
): Workplace {
  return hasExplicitOnsiteWorkplace(getJobWorkplaceText(job))
    ? "On-site"
    : job.workplace;
}

export function withResolvedWorkplace<T extends Job>(job: T): T {
  const workplace = getJobWorkplace(job);
  return workplace === job.workplace ? job : { ...job, workplace };
}
