import type { Job } from "@/types/job";
import { foldTokens, normalizeText } from "@/lib/text";
import {
  getUsStateSuffix,
  isAmbiguousPanamaCity,
  isExplicitUsStateName,
  isJamaicaUsNeighborhood,
  isNewMexicoUsLocation
} from "@/lib/location-context";
import { hasGermanLocationEvidence } from "@/lib/map-location";
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
  /\b(?:AL|AK|AZ|AR|CA|CO|CT|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;

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
  "EC", "UY", "PY", "BO", "DO", "JM", "PR", "ES"
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
  const usStateSuffix = getUsStateSuffix(foldedJobLocation);
  // DE also denotes Germany; preserve explicit country evidence in this case.
  const usStateSuffixed = usStateSuffix !== undefined && usStateSuffix !== "de";

  for (const [pattern, countryCode] of countryMatchers) {
    if (!pattern.test(foldedLocation)) {
      continue;
    }

    if (usStateSuffixed && collidingCountryCodes.has(countryCode)) {
      return "US";
    }

    if (countryCode === "PA" && isAmbiguousPanamaCity(foldTokens(location))) {
      continue;
    }

    return countryCode;
  }

  if (usStatePattern.test(location)) {
    return "US";
  }

  // DE is Germany's ISO code as well as Delaware. Keep the generic Delaware
  // suffix as US unless shared map/country evidence identifies Germany.
  // Match an uppercase DE token or a trailing DE suffix so mid-string words
  // like "de" in "Rue de la Paix" are not treated as a country or US state.
  const foldedCombinedLocation = foldTokens(location);
  if (
    usStateSuffix === "de" ||
    getUsStateSuffix(foldedCombinedLocation) === "de" ||
    /\bDE\b/.test(location)
  ) {
    return hasGermanLocationEvidence(job.location, job.mapLocation) ? "DE" : "US";
  }

  return undefined;
}

function foldDiacritics(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

const countryNames = [
  "united states of america",
  "republica dominicana",
  "dominican republic",
  "united kingdom",
  "united states",
  "south korea",
  "costa rica",
  "el salvador",
  "puerto rico",
  "switzerland",
  "svizzera",
  "schweiz",
  "suisse",
  "philippines",
  "deutschland",
  "argentina",
  "australia",
  "guatemala",
  "honduras",
  "nicaragua",
  "colombia",
  "ecuador",
  "paraguay",
  "uruguay",
  "brasil",
  "brazil",
  "canada",
  "france",
  "germany",
  "jamaica",
  "mexico",
  "panama",
  "belize",
  "bolivia",
  "espana",
  "india",
  "italy",
  "spain",
  "chile",
  "peru",
  "usa",
  "uk",
  "us",
  "pr"
].sort((left, right) => right.length - left.length);

const countryNamesByCode: Record<string, ReadonlySet<string>> = {
  US: new Set(["united states of america", "united states", "usa", "us"]),
  GB: new Set(["united kingdom", "uk"]),
  AU: new Set(["australia"]),
  CA: new Set(["canada"]),
  DE: new Set(["germany", "deutschland"]),
  CH: new Set(["switzerland", "schweiz", "suisse", "svizzera"]),
  FR: new Set(["france"]),
  ES: new Set(["spain", "espana"]),
  IN: new Set(["india"]),
  IT: new Set(["italy"]),
  PH: new Set(["philippines"]),
  KR: new Set(["south korea"]),
  BR: new Set(["brazil", "brasil"]),
  AR: new Set(["argentina"]),
  CL: new Set(["chile"]),
  CO: new Set(["colombia"]),
  PE: new Set(["peru"]),
  MX: new Set(["mexico"]),
  GT: new Set(["guatemala"]),
  BZ: new Set(["belize"]),
  SV: new Set(["el salvador"]),
  HN: new Set(["honduras"]),
  NI: new Set(["nicaragua"]),
  CR: new Set(["costa rica"]),
  PA: new Set(["panama"]),
  EC: new Set(["ecuador"]),
  UY: new Set(["uruguay"]),
  PY: new Set(["paraguay"]),
  BO: new Set(["bolivia"]),
  DO: new Set(["dominican republic", "republica dominicana"]),
  JM: new Set(["jamaica"]),
  PR: new Set(["puerto rico", "pr"])
};

// Bare Basel and Appenzell name two cantons, so they are not explicit.
const swissCantons = new Set([
  "zurich",
  "bern",
  "berne",
  "luzern",
  "lucerne",
  "uri",
  "schwyz",
  "obwalden",
  "nidwalden",
  "glarus",
  "zug",
  "fribourg",
  "freiburg",
  "solothurn",
  "basel stadt",
  "basel landschaft",
  "baselland",
  "schaffhausen",
  "appenzell ausserrhoden",
  "appenzell innerrhoden",
  "st gallen",
  "sankt gallen",
  "graubunden",
  "grisons",
  "grigioni",
  "aargau",
  "thurgau",
  "ticino",
  "tessin",
  "vaud",
  "valais",
  "wallis",
  "neuchatel",
  "geneve",
  "geneva",
  "genf",
  "jura"
]);

type PostalAddress = {
  "@type": "PostalAddress";
  addressCountry: string;
  addressLocality?: string;
  addressRegion?: string;
};

// A token that is both a city and a state or canton. Alone, it stays a locality.
const ambiguousCityRegions = new Set([
  "new york",
  "washington",
  "zurich",
  "bern",
  "berne",
  "luzern",
  "lucerne",
  "zug",
  "fribourg",
  "freiburg",
  "solothurn",
  "schaffhausen",
  "st gallen",
  "sankt gallen",
  "geneve",
  "geneva",
  "neuchatel",
  "schwyz",
  "glarus",
  "genf"
]);

export function jobPostingAddress(location: string, addressCountry: string): PostalAddress {
  const trimmed = location.trim().replace(/\s+/g, " ");
  const commaParts = trimmed.split(",").map((part) => part.trim());
  if (commaParts.some((part) => part.length === 0)) {
    return {
      "@type": "PostalAddress",
      addressLocality: trimmed,
      addressCountry
    };
  }
  const rawParts = commaParts;
  const parts = rawParts.flatMap((part, index) => (
    index === rawParts.length - 1 ? splitTrailingCountry(part, addressCountry) : [part]
  ));
  const places: string[] = [];
  const regions: string[] = [];

  parts.forEach((part, index) => {
    const folded = foldTokens(part);
    const isLast = index === parts.length - 1;
    if (isLast && isAddressCountryName(part, addressCountry)) return;
    if (isDistrictOfColumbia(part) && addressCountry === "US") {
      regions.push(part);
      return;
    }
    if (isExplicitRegion(part, addressCountry)) {
      regions.push(part);
      return;
    }
    places.push(part);
  });

  const district = regions.find((part) => isDistrictOfColumbia(part));
  const washington = regions.find((part) => foldTokens(part) === "washington");
  if (places.length === 0 && district && washington && regions.length === 2) {
    return {
      "@type": "PostalAddress",
      addressLocality: washington,
      addressRegion: district,
      addressCountry
    };
  }

  if (places.length === 1 && regions.length === 1 && ambiguousCityRegions.has(foldTokens(regions[0]))) {
    const regionIndex = parts.indexOf(regions[0]);
    const placeIndex = parts.indexOf(places[0]);
    if (regionIndex >= 0 && placeIndex >= 0 && regionIndex < placeIndex) {
      return {
        "@type": "PostalAddress",
        addressLocality: trimmed,
        addressCountry
      };
    }
  }

  if (places.length > 1 || regions.length > 1) {
    return {
      "@type": "PostalAddress",
      addressLocality: trimmed,
      addressCountry
    };
  }

  if (places.length === 0 && regions.length === 1 && ambiguousCityRegions.has(foldTokens(regions[0]))) {
    return {
      "@type": "PostalAddress",
      addressLocality: regions[0],
      addressCountry
    };
  }

  return {
    "@type": "PostalAddress",
    addressCountry,
    ...(places.length === 1 ? { addressLocality: places[0] } : {}),
    ...(regions.length === 1 ? { addressRegion: regions[0] } : {})
  };
}

function splitTrailingCountry(part: string, addressCountry: string) {
  if (!isPlainPlaceToken(part)) return [part];
  const folded = foldTokens(part);
  for (const name of countryNames) {
    if (folded === name || !folded.endsWith(` ${name}`)) continue;
    const nameWordCount = name.split(" ").length;
    const words = part.trim().split(/\s+/);
    if (words.length <= nameWordCount) continue;
    const prefix = words.slice(0, -nameWordCount).join(" ");
    if (!isExplicitRegion(prefix, addressCountry)) return [part];
    return [prefix, words.slice(-nameWordCount).join(" ")];
  }
  return [part];
}

function isPlainPlaceToken(part: string) {
  return /^[\p{L}\p{M}\s.'’-]+$/u.test(part.trim());
}

function isAddressCountryName(part: string, addressCountry: string) {
  if (!isPlainPlaceToken(part)) return false;
  if (addressCountry === "US" && isUnitedStatesToken(part)) return true;
  const folded = foldTokens(part);
  return countryNamesByCode[addressCountry]?.has(folded) === true || folded === addressCountry.toLowerCase();
}

function isUnitedStatesToken(part: string) {
  const compact = part.replace(/[\s.]+/g, "").toLowerCase();
  return compact === "us" || compact === "usa";
}

function isDistrictOfColumbia(part: string) {
  return /^d\.?c\.?$/i.test(part.replace(/\s+/g, ""));
}

function isExplicitRegion(part: string, addressCountry: string) {
  if (!isPlainPlaceToken(part)) return false;
  const folded = foldTokens(part);
  if (!folded) return false;
  if (addressCountry === "US") {
    return getUsStateSuffix(folded) === folded || isExplicitUsStateName(folded);
  }
  return addressCountry === "CH" && swissCantons.has(folded);
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
  const paragraphs: string[] = [];
  for (const paragraph of value.split(/\n+/)) {
    const trimmed = paragraph.trim();
    if (trimmed) paragraphs.push(`<p>${escapeHtml(trimmed)}</p>`);
  }
  return paragraphs.join("");
}
