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
 *
 * This is the single primitive for canonical resolution. Both the per-job and
 * per-set helpers below are derived from it, so the index is built once.
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

// Google requires ~1000+ characters of complete description text before a
// JobPosting rich result is eligible. Distinct from clusterDescriptionFloor:
// that gates cluster-key reliability, this gates search-rich-result markup.
const richResultDescriptionFloor = 1000;

/**
 * A job qualifies for `JobPosting` rich results only when its description is
 * complete, unattributed to a partner, and tied to a single physical location.
 * This is the single source of truth shared by the sitemap and JSON-LD layers.
 */
export function isRichResultEligible(job: Job) {
  const description = normalizeText(job.description ?? "");
  const hasCompleteDescription = Boolean(
    description &&
      description.length >= richResultDescriptionFloor &&
      !/(?:\.\.\.|…)$/.test(description) &&
      job.termsProfile === "public-api"
  );
  const hasSinglePhysicalLocation =
    job.workplace !== "Remote" && !job.location.includes(";");

  return hasCompleteDescription && hasSinglePhysicalLocation;
}

const usStatePattern =
  /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;

const countryMatchers: Array<[RegExp, string]> = [
  [/\b(?:united states|usa|us)\b/i, "US"],
  [/\b(?:united kingdom|uk)\b/i, "GB"],
  [/\baustralia\b/i, "AU"],
  [/\bcanada\b/i, "CA"],
  [/\b(?:germany|deutschland)\b/i, "DE"],
  [/\bswitzerland\b/i, "CH"],
  [/\bfrance\b/i, "FR"],
  [/\bspain\b/i, "ES"],
  [/\bindia\b/i, "IN"],
  [/\bitaly\b/i, "IT"],
  [/\bphilippines\b/i, "PH"],
  [/\bsouth korea\b/i, "KR"]
];

export function inferAddressCountry(job: Job) {
  const location = `${job.location} ${job.mapLocation?.label ?? ""}`;

  for (const [pattern, countryCode] of countryMatchers) {
    if (pattern.test(location)) {
      return countryCode;
    }
  }

  if (usStatePattern.test(location)) {
    return "US";
  }

  return undefined;
}

export function normalizeEmploymentType(value: string) {
  const normalized = value.toLowerCase().replace(/[_\s-]+/g, "");

  if (normalized === "fulltime" || normalized === "permanent") {
    return "FULL_TIME";
  }

  if (normalized === "parttime") {
    return "PART_TIME";
  }

  if (normalized === "contract" || normalized === "freelance") {
    return "CONTRACTOR";
  }

  if (normalized === "internship") {
    return "INTERN";
  }

  return "OTHER";
}
