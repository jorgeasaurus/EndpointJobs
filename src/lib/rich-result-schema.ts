import type { Job } from "@/types/job";
import { normalizeText } from "@/lib/text";

// Google requires ~1000+ characters of complete description text before a
// JobPosting rich result is eligible.
const richResultDescriptionFloor = 1000;

/**
 * A job qualifies for `JobPosting` rich results only when its description is
 * complete, unattributed to a partner, and tied to a single physical location.
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDescriptionAsHtml(value: string) {
  const paragraphs = value
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}
