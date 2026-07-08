import { createHash } from "node:crypto";

import type {
  EndpointTool,
  Job,
  Platform,
  RoleFamily,
  Seniority,
  TermsProfile,
  Workplace
} from "../../src/types/job";
import { endpointToolDefinitions } from "../../src/lib/endpoint-tools";
import { resolveJobMapLocation } from "./map-location";

const toolAliases = endpointToolDefinitions;

const platformAliases: Array<{ platform: Platform; aliases: string[] }> = [
  { platform: "macOS", aliases: ["macos", "mac os", "mac admin", "apple device"] },
  { platform: "Windows", aliases: ["windows", "windows 10", "windows 11"] },
  { platform: "iOS", aliases: ["ios", "iphone", "ipad"] },
  { platform: "Android", aliases: ["android"] },
  { platform: "Linux", aliases: ["linux", "ubuntu"] }
];

const endpointRoleTerms = [
  "endpoint",
  "endpoints",
  "end-point",
  "end-point protection",
  "desktop engineer",
  "desktop engineering",
  "desktop systems",
  "desktop administrator",
  "desktop infrastructure",
  "client platform",
  "client infrastructure",
  "client engineering",
  "client management",
  "client fleet",
  "macos client",
  "device management",
  "device engineer",
  "device fleet",
  "end user computer",
  "end user computing",
  "end user compute",
  "end user engineering",
  "end user technology",
  "end user services",
  "employee experience technology",
  "digital employee experience",
  "end-user computer",
  "end-user computing",
  "end-user compute",
  "end-user engineering",
  "enterprise engineering",
  "corporate engineering",
  "digital workplace",
  "it client services",
  "studio it",
  "workplace engineer",
  "workplace systems",
  "modern management",
  "endpoint security",
  "device trust",
  "zero-touch",
  "zero touch",
  "tech operations engineer",
  "technology operations engineer",
  "mac admin",
  "mac administrator",
  "macos engineer",
  "windows engineer",
  "windows administrator",
  "mdm",
  "m365",
  "microsoft 365",
  "uem",
  "software packaging",
  "application packaging",
  "patch management",
  "workstation"
];

const technicalRoleTitleTerms = [
  "systems administrator",
  "system administrator",
  "it administrator",
  "it systems administrator",
  "endpoint administrator",
  "systems engineer",
  "system engineer",
  "it systems engineer",
  "system development engineer",
  "systems development engineer",
  "systems development manager",
  "service engineer",
  "it engineer",
  "infrastructure engineer",
  "platform engineer",
  "client engineer",
  "client infrastructure engineer",
  "device engineer",
  "device trust engineer",
  "it security engineer",
  "endpoint security engineer",
  "enterprise support engineer",
  "mdm support engineer",
  "consulting engineer",
  "solutions engineer",
  "professional services engineer",
  "corporate engineering",
  "enterprise engineering",
  "tech operations engineer",
  "technology operations engineer"
];

const systemsAdministrationRoleTerms = [
  "systems administrator",
  "system administrator",
  "systems administration",
  "sysadmin",
  "it administrator",
  "it systems administrator",
  "windows administrator",
  "systems engineer",
  "system engineer",
  "it systems engineer",
  "infrastructure engineer",
  "infrastructure administrator"
];

const endpointSecurityRoleTerms = [
  "endpoint security",
  "endpoint protection",
  "endpoint detection",
  "endpoint response",
  "endpoint threat",
  "edr",
  "xdr"
];
const staleDays = Number(process.env.JOB_STALE_DAYS ?? 45);
const configuredDescriptionMaxLength = Number(process.env.JOB_DESCRIPTION_MAX_LENGTH ?? 12000);
const configuredDescriptionMinLength = Number(process.env.JOB_DESCRIPTION_MIN_LENGTH ?? 420);
const descriptionMaxLength =
  Number.isFinite(configuredDescriptionMaxLength) && configuredDescriptionMaxLength >= 1000
    ? configuredDescriptionMaxLength
    : 12000;
const descriptionMinLength =
  Number.isFinite(configuredDescriptionMinLength) && configuredDescriptionMinLength >= 261
    ? configuredDescriptionMinLength
    : 420;

export type JobCandidate = {
  id: string;
  title: string;
  company: string;
  location?: string;
  workplace?: Workplace;
  postedAt: string;
  fetchedAt: Date;
  staleAfter?: string;
  source: string;
  sourceUrl: string;
  applyUrl?: string;
  attributionLabel: string;
  termsProfile: TermsProfile;
  description?: string;
  sourceTags?: string[];
  haystackParts?: unknown[];
  salary?: Job["salary"];
  roleFamily?: RoleFamily;
  seniority?: Seniority;
  employmentType?: string;
};

export function toEndpointJob(candidate: JobCandidate): Job | null {
  const title = cleanText(candidate.title);
  const company = cleanText(candidate.company);
  const sourceUrl = cleanUrl(candidate.sourceUrl);
  const applyUrl = cleanUrl(candidate.applyUrl) ?? sourceUrl;

  if (!title || !company || !sourceUrl || !applyUrl) {
    return null;
  }

  const rawLocation = cleanText(candidate.location);
  const location = rawLocation || "Unknown";
  const mapLocation = resolveJobMapLocation(location);
  const sourceTags = (candidate.sourceTags ?? []).map(cleanText).filter(Boolean);
  const description = stripHtml(candidate.description ?? "");
  const haystack = normalizeSearchText(
    [
      title,
      company,
      rawLocation,
      ...(candidate.haystackParts ?? []),
      sourceTags.join(" "),
      description
    ].join(" ")
  );
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt = parseDateLike(candidate.postedAt) ?? candidate.fetchedAt.toISOString();
  const staleAfter = candidate.staleAfter ?? addDays(new Date(postedAt), staleDays).toISOString();

  return {
    id: candidate.id,
    title,
    company,
    location,
    ...(mapLocation ? { mapLocation } : {}),
    workplace: candidate.workplace ?? inferWorkplace(rawLocation, haystack),
    postedAt,
    fetchedAt: candidate.fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: candidate.source,
    sourceUrl,
    applyUrl,
    attributionLabel: candidate.attributionLabel,
    termsProfile: candidate.termsProfile,
    summary: summarize(description),
    description: normalizeDescription(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: candidate.roleFamily ?? inferRoleFamily(haystack, tools, platforms),
    seniority: candidate.seniority ?? inferSeniority(haystack),
    employmentType: cleanText(candidate.employmentType) || inferEmploymentType(haystack),
    ...(candidate.salary ? { salary: candidate.salary } : {})
  };
}

export function isEndpointRelevant(
  haystack: string,
  title: string,
  tools: EndpointTool[]
) {
  const normalizedTitle = normalizeSearchText(title);
  const hasStrongTool = toolAliases.some(
    ({ tool, strong }) => strong && tools.includes(tool)
  );
  const hasEndpointRole = endpointRoleTerms.some((term) =>
    containsAlias(haystack, term)
  );
  const hasEndpointTitle = endpointRoleTerms.some((term) =>
    containsAlias(normalizedTitle, term)
  );
  const hasTechnicalTitle = technicalRoleTitleTerms.some((term) =>
    containsAlias(normalizedTitle, term)
  );
  const titleLooksTechnical =
    hasTechnicalTitle ||
    containsAlias(normalizedTitle, "engineer") ||
    containsAlias(normalizedTitle, "administrator") ||
    containsAlias(normalizedTitle, "admin");
  const titleHasStrongTool = toolAliases.some(
    ({ aliases, strong }) => strong && aliases.some((alias) => containsAlias(normalizedTitle, alias))
  );
  const hasEndUserOpsSignal = [
    "desktop",
    "workstation",
    "end user",
    "end-user",
    "studio it",
    "client fleet",
    "client infrastructure",
    "device fleet",
    "device trust",
    "zero-touch",
    "zero touch",
    "m365",
    "microsoft 365",
    "intune",
    "jamf",
    "macos client",
    "digital employee experience",
    "corporate engineering",
    "enterprise engineering",
    "tech operations"
  ].some((term) => containsAlias(haystack, term));
  const looksLikeFrontlineSupport =
    containsAlias(normalizedTitle, "service desk") ||
    containsAlias(normalizedTitle, "help desk") ||
    containsAlias(normalizedTitle, "customer support") ||
    containsAlias(normalizedTitle, "technical support") ||
    containsAlias(normalizedTitle, "support analyst");
  const looksLikeEntrySupport =
    containsAlias(normalizedTitle, "customer support") ||
    containsAlias(normalizedTitle, "tier 1") ||
    containsAlias(normalizedTitle, "tier 2") ||
    containsAlias(normalizedTitle, "help desk") ||
    containsAlias(normalizedTitle, "service desk");
  const looksLikeApplicationSecurity =
    containsAlias(normalizedTitle, "application security") ||
    containsAlias(normalizedTitle, "appsec");
  const looksLikeSoftwareProductRole =
    containsAlias(normalizedTitle, "software engineer") ||
    containsAlias(normalizedTitle, "software development engineer") ||
    containsAlias(normalizedTitle, "developer");
  const hasClientEngineeringTitle = [
    "client engineering",
    "macos client",
    "end user computer",
    "end-user computer",
    "systems engineer macos",
    "system development engineer macos"
  ].some((term) => containsAlias(normalizedTitle, term));

  if (
    looksLikeEntrySupport ||
    (looksLikeFrontlineSupport && !hasEndpointTitle) ||
    (looksLikeApplicationSecurity && !hasEndpointTitle) ||
    (looksLikeSoftwareProductRole && !hasClientEngineeringTitle)
  ) {
    return false;
  }

  return (
    hasEndpointTitle ||
    (titleHasStrongTool && titleLooksTechnical) ||
    (hasStrongTool && hasTechnicalTitle) ||
    (hasTechnicalTitle && hasEndpointRole && hasEndUserOpsSignal)
  );
}

export function deriveTools(haystack: string) {
  return toolAliases
    .filter(({ aliases }) => aliases.some((alias) => containsAlias(haystack, alias)))
    .map(({ tool }) => tool);
}

export function derivePlatforms(haystack: string) {
  const platforms = platformAliases
    .filter(({ aliases }) => aliases.some((alias) => containsAlias(haystack, alias)))
    .map(({ platform }) => platform);

  return platforms.length > 0 ? platforms : (["Windows", "macOS"] satisfies Platform[]);
}

type MatchReasonContext = {
  haystack: string;
  tools: EndpointTool[];
  platforms: Platform[];
};

const matchReasonRules: Array<{
  label: string;
  matches: (context: MatchReasonContext) => boolean;
}> = [
  {
    label: "Jamf + macOS",
    matches: ({ platforms, tools }) => tools.includes("Jamf") && platforms.includes("macOS")
  },
  { label: "Kandji MDM", matches: ({ tools }) => tools.includes("Kandji") },
  {
    label: "Intune + Autopilot",
    matches: ({ tools }) => tools.includes("Intune") && tools.includes("Autopilot")
  },
  { label: "SCCM/MECM", matches: ({ tools }) => tools.includes("SCCM") },
  { label: "Fleet MDM", matches: ({ tools }) => tools.includes("Fleet MDM") },
  { label: "NinjaOne remediation", matches: ({ tools }) => tools.includes("NinjaOne") },
  { label: "Tanium endpoint security", matches: ({ tools }) => tools.includes("Tanium") },
  {
    label: "Endpoint engineering",
    matches: ({ haystack }) => hasAnyAlias(haystack, ["endpoint", "endpoints"])
  },
  { label: "MDM", matches: ({ haystack }) => containsAlias(haystack, "mdm") },
  { label: "UEM", matches: ({ haystack }) => containsAlias(haystack, "uem") },
  {
    label: "Device management",
    matches: ({ haystack }) => containsAlias(haystack, "device management")
  },
  { label: "Client platform", matches: ({ haystack }) => containsAlias(haystack, "client platform") },
  { label: "PowerShell automation", matches: ({ tools }) => tools.includes("PowerShell") },
  { label: "App packaging", matches: ({ haystack }) => containsAlias(haystack, "packaging") },
  {
    label: "Endpoint security",
    matches: ({ haystack }) => hasAnyAlias(haystack, ["endpoint security", "edr"])
  },
  {
    label: "Compliance evidence",
    matches: ({ haystack }) => hasAnyAlias(haystack, ["compliance", "audit"])
  },
  { label: "Desktop engineering", matches: ({ haystack }) => containsAlias(haystack, "desktop") },
  {
    label: "IT client services",
    matches: ({ haystack }) => containsAlias(haystack, "it client services")
  },
  {
    label: "End-user computing",
    matches: ({ haystack }) =>
      hasAnyAlias(haystack, [
        "end user computing",
        "end-user computing",
        "end user computer",
        "end-user computer"
      ])
  },
  { label: "Digital workplace", matches: ({ haystack }) => containsAlias(haystack, "digital workplace") },
  {
    label: "Employee experience",
    matches: ({ haystack }) => containsAlias(haystack, "employee experience")
  },
  { label: "Windows platform", matches: ({ platforms }) => platforms.includes("Windows") },
  { label: "macOS platform", matches: ({ platforms }) => platforms.includes("macOS") }
];

export function deriveMatchReasons(
  haystack: string,
  tools: EndpointTool[],
  platforms: Platform[]
) {
  const context = { haystack, platforms, tools };
  const reasons = matchReasonRules
    .filter((rule) => rule.matches(context))
    .map((rule) => rule.label);

  if (reasons.length > 0) {
    return reasons.slice(0, 5);
  }

  if (tools.length > 0) {
    return [tools.slice(0, 2).join(" + ")];
  }

  if (platforms.length > 0) {
    return [platforms.slice(0, 2).join(" + ") + " platform"];
  }

  return ["Endpoint role"];
}

export function inferRoleFamily(
  haystack: string,
  tools: EndpointTool[],
  platforms: Platform[]
): RoleFamily {
  if (hasEndpointSecuritySignal(haystack, tools)) {
    return "Endpoint Security";
  }

  if (tools.includes("PowerShell") && hasSystemsAdministrationRole(haystack)) {
    return "Systems Administration";
  }

  if (containsAlias(haystack, "compliance") || containsAlias(haystack, "audit")) {
    return "Device Compliance";
  }

  if (
    containsAlias(haystack, "automation") ||
    containsAlias(haystack, "powershell") ||
    containsAlias(haystack, "packaging") ||
    containsAlias(haystack, "remediation")
  ) {
    return "Automation";
  }

  if (tools.includes("SCCM") || platforms.includes("Windows")) {
    return "Windows Platform";
  }

  if (tools.includes("Jamf") || tools.includes("Kandji") || platforms.includes("macOS")) {
    return "macOS Platform";
  }

  if (containsAlias(haystack, "workplace")) {
    return "Workplace Systems";
  }

  return "Endpoint Engineering";
}

function hasEndpointSecuritySignal(haystack: string, tools: EndpointTool[]) {
  return (
    hasAnyAlias(haystack, endpointSecurityRoleTerms) ||
    tools.includes("Tanium") ||
    tools.includes("Defender")
  );
}

function hasSystemsAdministrationRole(haystack: string) {
  return hasAnyAlias(haystack, systemsAdministrationRoleTerms);
}

export function inferSeniority(haystack: string): Seniority {
  if (containsAlias(haystack, "manager")) return "Manager";
  if (containsAlias(haystack, "lead")) return "Lead";
  if (containsAlias(haystack, "staff") || containsAlias(haystack, "principal")) return "Staff";
  if (containsAlias(haystack, "senior") || containsAlias(haystack, "sr")) return "Senior";
  if (containsAlias(haystack, "associate") || containsAlias(haystack, "junior")) return "Associate";
  return "Mid";
}

export function inferEmploymentType(haystack: string) {
  if (containsAlias(haystack, "contract")) return "Contract";
  if (containsAlias(haystack, "part time") || containsAlias(haystack, "part-time")) return "Part-time";
  return "Full-time";
}

export function inferWorkplace(location: string | undefined, haystack: string): Workplace {
  const text = normalizeSearchText(`${location ?? ""} ${haystack}`);

  if (containsAlias(text, "remote")) return "Remote";
  if (containsAlias(text, "hybrid")) return "Hybrid";
  if (location) return "On-site";
  return "Unknown";
}

export function normalizeTags(
  sourceTags: string[],
  tools: EndpointTool[],
  platforms: Platform[]
) {
  return Array.from(new Set([...platforms, ...tools, ...sourceTags]))
    .filter(Boolean)
    .slice(0, 12);
}

const salaryAmountPattern = String.raw`\$?\s*([0-9]{2,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]{5,6}(?:\.[0-9]{1,2})?|[0-9]{2,3}(?:\.[0-9]{1,2})?)(\s*[kK])?`;
const salaryRangeSeparatorPattern = String.raw`\s*(?:-|\u2013|\u2014|\bto\b|\band\b)\s*`;
const salaryContextPattern = String.raw`(?:annual(?:ly)?|salary|compensation|base pay|pay range|pay transparency|hiring range|estimated annual pay range|targeted base salary range)`;
const annualSalaryPatterns = [
  new RegExp(
    String.raw`${salaryContextPattern}[^\n]{0,420}?${salaryAmountPattern}${salaryRangeSeparatorPattern}${salaryAmountPattern}(?:\s*(?:usd|us dollars))?(?:\s*(?:annually|annual|per year|/year|a year|yearly))?`,
    "gi"
  ),
  new RegExp(
    String.raw`${salaryAmountPattern}${salaryRangeSeparatorPattern}${salaryAmountPattern}\s*(?:usd|us dollars)?\s*(?:annually|annual|per year|/year|a year|yearly)`,
    "gi"
  )
];

export function normalizeSalary(min?: number, max?: number) {
  const salaryMin = min && min > 0 ? min : undefined;
  const salaryMax = max && max > 0 ? max : undefined;

  if (!salaryMin && !salaryMax) {
    return undefined;
  }

  const label =
    salaryMin && salaryMax
      ? `$${formatSalaryAmount(salaryMin)}-$${formatSalaryAmount(salaryMax)}`
      : `$${formatSalaryAmount(salaryMin ?? salaryMax ?? 0)}`;

  return {
    ...(salaryMin ? { min: salaryMin } : {}),
    ...(salaryMax ? { max: salaryMax } : {}),
    currency: "USD",
    label
  };
}

export function extractSalaryFromText(value: string | undefined): Job["salary"] | undefined {
  const text = cleanText(stripHtml(value ?? ""));

  if (!text) {
    return undefined;
  }

  for (const pattern of annualSalaryPatterns) {
    pattern.lastIndex = 0;

    let match = pattern.exec(text);
    while (match) {
      const salary = salaryFromRangeMatch(text, match);

      if (salary) {
        return salary;
      }

      match = pattern.exec(text);
    }
  }

  return undefined;
}

function salaryFromRangeMatch(text: string, match: RegExpExecArray) {
  const context = text.slice(Math.max(0, match.index - 80), match.index + match[0].length + 80);

  if (hasNonUsdCurrency(context)) {
    return undefined;
  }

  const usesThousands = Boolean(match[2] || match[4]);
  let min = parseSalaryAmount(match[1], match[2], usesThousands);
  let max = parseSalaryAmount(match[3], match[4], usesThousands);

  if (!min || !max) {
    return undefined;
  }

  if (min > max) {
    [min, max] = [max, min];
  }

  if (!isValidAnnualSalaryRange(min, max)) {
    return undefined;
  }

  return normalizeSalary(min, max);
}

function parseSalaryAmount(value: string | undefined, suffix: string | undefined, usesThousands: boolean) {
  if (!value) {
    return undefined;
  }

  const amount = Number(value.replace(/,/g, ""));

  if (!Number.isFinite(amount)) {
    return undefined;
  }

  const normalized = suffix || (usesThousands && amount < 1000) ? amount * 1000 : amount;
  return Math.round(normalized);
}

function isValidAnnualSalaryRange(min: number, max: number) {
  return min >= 20_000 && max <= 1_000_000 && max / min <= 6;
}

function hasNonUsdCurrency(value: string) {
  return /\b(?:cad|aud|gbp|eur|inr|sgd|nzd)\b|[\u00a3\u20ac]/i.test(value) && !/\busd\b/i.test(value);
}

function formatSalaryAmount(value: number) {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return value.toString();
}

export function summarize(value: string) {
  const withoutSpamPrompt = value.split("Please mention the word")[0] ?? value;
  const compact = cleanText(withoutSpamPrompt);

  if (compact.length <= 260) {
    return compact;
  }

  return `${trimToWordBoundary(compact, 257)}...`;
}

export function normalizeDescription(value: string | undefined) {
  const formatted = cleanMultilineText(stripHtml(value ?? ""));
  const compact = cleanText(formatted);

  if (!formatted || compact.length < descriptionMinLength) {
    return undefined;
  }

  if (formatted.length <= descriptionMaxLength) {
    return formatted;
  }

  return `${trimToWordBoundary(formatted, descriptionMaxLength - 3)}...`;
}

export function stripHtml(value: string) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(?:li|p|div|section|article|header|footer|h[1-6]|ul|ol|tr|table|blockquote)>/gi, "\n")
    .replace(/<(?:p|div|section|article|header|footer|h[1-6]|ul|ol|tr|table|blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function trimToWordBoundary(value: string, maxLength: number) {
  const trimmed = value.slice(0, maxLength).trimEnd();
  const lastWhitespace = trimmed.match(/\s+\S*$/)?.index ?? -1;

  if (lastWhitespace >= Math.floor(maxLength * 0.72)) {
    return trimmed.slice(0, lastWhitespace).trimEnd();
  }

  return trimmed;
}

export function getString(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return undefined;
}

export function cleanText(value: unknown) {
  return decodeEntities(value == null ? "" : String(value))
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMultilineText(value: unknown) {
  return decodeEntities(value == null ? "" : String(value))
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeSearchText(value: string) {
  return cleanText(value).toLowerCase();
}

export function normalizeEmploymentTypeLabel(value: unknown) {
  const label = cleanText(value);

  if (!label) {
    return undefined;
  }

  const normalized = normalizeSearchText(label);

  if (normalized.includes("contract")) return "Contract";
  if (normalized.includes("part")) return "Part-time";
  if (normalized.includes("temp")) return "Temporary";
  if (normalized.includes("intern")) return "Internship";
  if (normalized.includes("full")) return "Full-time";
  return formatSlugLabel(label);
}

export function normalizeFirstEmploymentType(values: unknown[]) {
  for (const value of values) {
    const employmentType = normalizeEmploymentTypeLabel(value);

    if (employmentType) {
      return employmentType;
    }
  }

  return undefined;
}

export function containsAlias(haystack: string, alias: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

function hasAnyAlias(haystack: string, aliases: string[]) {
  return aliases.some((alias) => containsAlias(haystack, alias));
}

export function cleanUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;|&#8212;|&#x2014;/gi, "-")
    .replace(/&ndash;|&#8211;|&#x2013;/gi, "-");
}

export function parseDateLike(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function normalizeIdPart(value: string) {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function buildStableJobId(source: string, account: string, title: string, sourceUrl: string) {
  const readable = [source, account, title]
    .map(normalizeIdPart)
    .filter(Boolean)
    .join("-");

  return `${readable}-${shortHash(sourceUrl)}`;
}

function shortHash(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

export function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

export function parseRelativeAgeDate(value: string | undefined, fetchedAt: Date) {
  const text = normalizeSearchText(value ?? "");

  if (!text) {
    return undefined;
  }

  if (containsAlias(text, "today") || containsAlias(text, "just posted")) {
    return fetchedAt.toISOString();
  }

  if (containsAlias(text, "yesterday")) {
    return addDays(fetchedAt, -1).toISOString();
  }

  const match = text.match(/(\d+)\+?\s+(minute|hour|day|week|month)s?\s+ago/);

  if (!match) {
    return parseDateLike(value);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const days = unit === "month" ? amount * 30 : unit === "week" ? amount * 7 : unit === "day" ? amount : 0;

  return addDays(fetchedAt, -days).toISOString();
}

export function formatSlugLabel(value: unknown) {
  return cleanText(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getCsvConfig(envKey: string, fallback: string[]) {
  const configured = process.env[envKey];
  const values = configured ? configured.split(",") : fallback;

  return values.map((value) => value.trim()).filter(Boolean);
}

export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
