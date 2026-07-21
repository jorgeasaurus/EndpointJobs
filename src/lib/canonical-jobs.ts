import type { Job } from "@/types/job";
import { normalizeText } from "@/lib/text";

const directJobSources = new Set([
  "Amazon Jobs",
  "Ashby",
  "Greenhouse",
  "Lever",
  "Recruitee",
  "SmartRecruiters",
  "USAJOBS",
  "Workday"
]);

// Descriptions shorter than this are too short to form a reliable cluster key,
// so non-direct jobs below the floor stay canonical (no direct twin to defer to).
const clusterDescriptionFloor = 1000;

type CanonicalIndex = {
  directIds: Set<string>;
  representatives: Map<string, Job>;
};

function buildCanonicalIndex(jobs: readonly Job[]): CanonicalIndex {
  const directIds = new Set<string>();
  const representatives = new Map<string, Job>();

  for (const job of jobs) {
    if (!directJobSources.has(job.source) || !job.description) {
      continue;
    }

    directIds.add(job.id);

    const key = clusterKey(job.company, job.description);
    if (!key) {
      continue;
    }

    // Deterministic representative: keep the lexicographically smallest id so
    // canonical resolution does not depend on feed ordering.
    const current = representatives.get(key);
    if (!current || job.id < current.id) {
      representatives.set(key, job);
    }
  }

  return { directIds, representatives };
}

function clusterKey(company: string, description: string | undefined) {
  // Case-folding is explicit here: normalizeText is whitespace-only, and
  // clustering must stay case-insensitive so cross-source twins match.
  const normalizedDescription = normalizeText(description ?? "").toLowerCase();

  if (normalizedDescription.length < clusterDescriptionFloor) {
    return undefined;
  }

  return `${normalizeText(company).toLowerCase()} ${normalizedDescription}`;
}

/**
 * Maps every job id in `jobs` to the id of its canonical, crawlable
 * representative. A job is canonical when it comes from a direct ATS source;
 * otherwise it defers to a direct-source twin sharing its company and
 * description. The representative per cluster is deterministic (smallest id),
 * so resolution is order-independent and stable across feed reordering.
 */
export function getCanonicalSeoIndex(jobs: readonly Job[]): Map<string, string> {
  const index = buildCanonicalIndex(jobs);
  const canonicalIds = new Map<string, string>();

  for (const job of jobs) {
    const key = clusterKey(job.company, job.description);
    const representative = key ? index.representatives.get(key) : undefined;
    const canonicalId =
      index.directIds.has(job.id) || !representative || representative.id === job.id
        ? job.id
        : representative.id;
    canonicalIds.set(job.id, canonicalId);
  }

  return canonicalIds;
}

export function getCanonicalSeoJobs(jobs: readonly Job[]) {
  const index = getCanonicalSeoIndex(jobs);
  return jobs.filter((job) => index.get(job.id) === job.id);
}
