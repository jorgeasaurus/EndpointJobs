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

type ToolAlias = {
  tool: EndpointTool;
  aliases: string[];
  strong: boolean;
};

const toolAliases: ToolAlias[] = [
  { tool: "Jamf", aliases: ["jamf", "jamf pro", "jamf school"], strong: true },
  {
    tool: "Intune",
    aliases: ["intune", "endpoint manager", "microsoft endpoint manager"],
    strong: true
  },
  {
    tool: "SCCM",
    aliases: ["sccm", "mecm", "configuration manager", "configmgr"],
    strong: true
  },
  {
    tool: "Fleet MDM",
    aliases: ["fleet mdm", "fleetdm", "fleet device management"],
    strong: true
  },
  { tool: "Kandji", aliases: ["kandji", "kanji"], strong: true },
  { tool: "NinjaOne", aliases: ["ninjaone", "ninja one"], strong: true },
  {
    tool: "Workspace ONE",
    aliases: ["workspace one", "workspaceone", "airwatch"],
    strong: true
  },
  { tool: "Tanium", aliases: ["tanium"], strong: true },
  { tool: "Okta", aliases: ["okta"], strong: false },
  { tool: "Entra ID", aliases: ["entra id", "entra", "azure ad"], strong: false },
  { tool: "Autopilot", aliases: ["autopilot", "windows autopilot"], strong: true },
  { tool: "Defender", aliases: ["defender", "microsoft defender", "mde"], strong: false }
];

const platformAliases: Array<{ platform: Platform; aliases: string[] }> = [
  { platform: "macOS", aliases: ["macos", "mac os", "mac admin", "apple device"] },
  { platform: "Windows", aliases: ["windows", "windows 10", "windows 11"] },
  { platform: "iOS", aliases: ["ios", "iphone", "ipad"] },
  { platform: "Android", aliases: ["android"] },
  { platform: "Linux", aliases: ["linux", "ubuntu"] }
];

const endpointRoleTerms = [
  "endpoint",
  "end-point",
  "end-point protection",
  "desktop engineer",
  "desktop engineering",
  "desktop systems",
  "desktop administrator",
  "desktop infrastructure",
  "client platform",
  "client engineering",
  "client management",
  "client fleet",
  "macos client",
  "device management",
  "device engineer",
  "device fleet",
  "end user computer",
  "end user computing",
  "end user technology",
  "end user services",
  "end-user computer",
  "end-user computing",
  "enterprise engineering",
  "digital workplace",
  "it client services",
  "studio it",
  "workplace engineer",
  "workplace systems",
  "modern management",
  "endpoint security",
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
  "system development engineer",
  "systems development engineer",
  "systems development manager",
  "service engineer",
  "it engineer",
  "infrastructure engineer",
  "platform engineer",
  "client engineer",
  "device engineer",
  "it security engineer",
  "endpoint security engineer",
  "enterprise support engineer",
  "mdm support engineer",
  "consulting engineer",
  "solutions engineer",
  "professional services engineer"
];
const staleDays = Number(process.env.JOB_STALE_DAYS ?? 45);

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
    "device fleet",
    "m365",
    "microsoft 365",
    "intune",
    "jamf",
    "macos client"
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

export function deriveMatchReasons(
  haystack: string,
  tools: EndpointTool[],
  platforms: Platform[]
) {
  const reasons = new Set<string>();

  if (tools.includes("Jamf") && platforms.includes("macOS")) reasons.add("Jamf + macOS");
  if (tools.includes("Kandji")) reasons.add("Kandji MDM");
  if (tools.includes("Intune") && tools.includes("Autopilot")) reasons.add("Intune + Autopilot");
  if (tools.includes("SCCM")) reasons.add("SCCM/MECM");
  if (tools.includes("Fleet MDM")) reasons.add("Fleet MDM");
  if (tools.includes("NinjaOne")) reasons.add("NinjaOne remediation");
  if (tools.includes("Tanium")) reasons.add("Tanium endpoint security");
  if (containsAlias(haystack, "endpoint")) reasons.add("Endpoint engineering");
  if (containsAlias(haystack, "mdm")) reasons.add("MDM");
  if (containsAlias(haystack, "uem")) reasons.add("UEM");
  if (containsAlias(haystack, "device management")) reasons.add("Device management");
  if (containsAlias(haystack, "client platform")) reasons.add("Client platform");
  if (containsAlias(haystack, "powershell")) reasons.add("PowerShell automation");
  if (containsAlias(haystack, "packaging")) reasons.add("App packaging");
  if (containsAlias(haystack, "endpoint security") || containsAlias(haystack, "edr")) {
    reasons.add("Endpoint security");
  }
  if (containsAlias(haystack, "compliance") || containsAlias(haystack, "audit")) {
    reasons.add("Compliance evidence");
  }
  if (reasons.size === 0 && tools.length > 0) {
    reasons.add(tools.slice(0, 2).join(" + "));
  }

  return Array.from(reasons).slice(0, 5);
}

export function inferRoleFamily(
  haystack: string,
  tools: EndpointTool[],
  platforms: Platform[]
): RoleFamily {
  if (
    containsAlias(haystack, "security") ||
    containsAlias(haystack, "edr") ||
    tools.includes("Tanium") ||
    tools.includes("Defender")
  ) {
    return "Endpoint Security";
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

  return `${compact.slice(0, 257).trim()}...`;
}

export function stripHtml(value: string) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
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

export function normalizeSearchText(value: string) {
  return cleanText(value).toLowerCase();
}

export function containsAlias(haystack: string, alias: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
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
    .replace(/&nbsp;/g, " ");
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
