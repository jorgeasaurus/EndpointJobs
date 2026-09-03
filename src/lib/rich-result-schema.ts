import type { Job } from "@/types/job";
import { foldTokens, isJamaicaUsNeighborhood, isNewMexicoUsLocation, normalizeText } from "@/lib/text";
import { getJobWorkplace } from "@/lib/workplace";

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
    getJobWorkplace(job) !== "Remote" && !job.location.includes(";");

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
  [/\b(?:spain|espana)\b/i, "ES"],
  [/\bindia\b/i, "IN"],
  [/\bitaly\b/i, "IT"],
  [/\bphilippines\b/i, "PH"],
  [/\bsouth korea\b/i, "KR"],
  [/\b(?:brazil|brasil)\b/i, "BR"],
  [/\bargentina\b/i, "AR"],
  [/\bchile\b/i, "CL"],
  [/\bcolombia\b/i, "CO"],
  [/\bperu\b/i, "PE"],
  [/\bnew mexico\b/i, "US"],
  [/\bmexico\b/i, "MX"],
  [/\bguatemala\b/i, "GT"],
  [/\bbelize\b/i, "BZ"],
  [/\bel salvador\b/i, "SV"],
  [/\bhonduras\b/i, "HN"],
  [/\bnicaragua\b/i, "NI"],
  [/\bcosta rica\b/i, "CR"],
  [/\bpanama\b/i, "PA"],
  [/\becuador\b/i, "EC"],
  [/\buruguay\b/i, "UY"],
  [/\bparaguay\b/i, "PY"],
  [/\bbolivia\b/i, "BO"],
  [/\b(?:dominican republic|republica dominicana)\b/i, "DO"],
  [/\bjamaica\b/i, "JM"],
  [/\b(?:puerto rico|pr)\b/i, "PR"]
];

const collidingCountryCodes = new Set([
  "BR", "PE", "CL", "CO", "MX", "PA", "GT", "BZ", "SV", "HN", "NI", "CR",
  "EC", "UY", "PY", "BO", "DO", "JM", "PR"
]);

export function inferAddressCountry(job: Job) {
  const foldedJobLocation = foldTokens(job.location);

  if (isNewMexicoUsLocation(foldedJobLocation)) {
    return "US";
  }

  if (isJamaicaUsNeighborhood(foldedJobLocation)) {
    return "US";
  }

  const location = `${job.location} ${job.mapLocation?.label ?? ""}`;
  const foldedLocation = foldDiacritics(location);
  const usStateSuffixed = hasExplicitUsStateSuffix(job.location);

  for (const [pattern, countryCode] of countryMatchers) {
    if (!pattern.test(foldedLocation)) {
      continue;
    }

    if (usStateSuffixed && collidingCountryCodes.has(countryCode)) {
      return "US";
    }

    if (countryCode === "PA" && isAmbiguousPanamaCity(foldedLocation)) {
      continue;
    }

    return countryCode;
  }

  if (usStatePattern.test(location)) {
    return "US";
  }

  return undefined;
}

function foldDiacritics(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function hasExplicitUsStateSuffix(location: string) {
  const normalized = foldDiacritics(location)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/ (?:us|usa|united states(?: of america)?)$/, "")
    .replace(/ \d{5}(?: \d{4})?$/, "");

  return /(?:^| )(?:al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)$/.test(
    normalized
  );
}

function isAmbiguousPanamaCity(foldedLocation: string) {
  const normalized = foldedLocation
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!/\bpanama city\b/.test(normalized)) {
    return false;
  }

  return !/\b(?:panama city panama|ciudad de panama|republic of panama)\b/.test(normalized);
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
