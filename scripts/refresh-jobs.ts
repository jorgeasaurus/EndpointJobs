import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type {
  EndpointTool,
  Job,
  JobsFeed,
  Platform,
  RoleFamily,
  Seniority,
  Workplace
} from "../src/types/job";

type RemoteOkJob = {
  id?: string | number;
  position?: string;
  company?: string;
  location?: string;
  date?: string;
  epoch?: number;
  tags?: string[];
  description?: string;
  apply_url?: string;
  url?: string;
  salary_min?: number;
  salary_max?: number;
};

type RemotiveJob = {
  id?: string | number;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

type ArbeitnowJob = {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
};

type JobicyJob = {
  id?: string | number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
};

type ToolAlias = {
  tool: EndpointTool;
  aliases: string[];
  strong: boolean;
};

const outputPath = resolve(process.env.JOB_OUTPUT_PATH ?? "src/data/jobs.json");
const maxJobs = Number(process.env.JOB_MAX_RESULTS ?? 80);
const staleDays = Number(process.env.JOB_STALE_DAYS ?? 45);

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
  "desktop engineer",
  "desktop administrator",
  "client platform",
  "device management",
  "device engineer",
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
  "uem",
  "software packaging",
  "application packaging",
  "patch management"
];

async function main() {
  const providers = getConfiguredProviders();
  const fetchedAt = new Date();
  const jobs = await fetchConfiguredProviderJobs(providers, fetchedAt);
  const normalizedJobs = dedupeJobs(
    jobs
      .filter((job): job is Job => Boolean(job))
      .filter((job) => new Date(job.staleAfter).getTime() >= fetchedAt.getTime())
  )
    .sort((first, second) => new Date(second.postedAt).getTime() - new Date(first.postedAt).getTime())
    .slice(0, maxJobs);

  const feed: JobsFeed = {
    updatedAt: fetchedAt.toISOString(),
    source: getFeedSourceMetadata(providers),
    jobs: normalizedJobs
  };

  validateFeed(feed);

  if (normalizedJobs.length === 0 && process.env.JOB_ALLOW_EMPTY !== "true") {
    console.log(
      "No endpoint jobs matched the configured provider feeds; leaving src/data/jobs.json unchanged."
    );
    return;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, "utf8");

  console.log(
    `Wrote ${normalizedJobs.length} endpoint jobs from ${providers.length} provider(s) to ${outputPath}`
  );
}

const supportedProviders = ["remoteok", "remotive", "arbeitnow", "jobicy"] as const;
type SupportedProvider = (typeof supportedProviders)[number];

function isSupportedProvider(value: string): value is SupportedProvider {
  return supportedProviders.includes(value as SupportedProvider);
}

function getConfiguredProviders() {
  const configured = process.env.JOB_PROVIDERS ?? process.env.JOB_PROVIDER;
  const providerNames = configured
    ? configured.split(",")
    : [...supportedProviders];
  const providers = providerNames.map(normalizeProviderName);

  if (providers.length === 0) {
    throw new Error("No job providers configured");
  }

  return Array.from(new Set(providers));
}

function normalizeProviderName(value: string): SupportedProvider {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]/g, "");
  const provider = normalized === "remoteok" ? "remoteok" : normalized;

  if (!isSupportedProvider(provider)) {
    throw new Error(`Unsupported JOB_PROVIDERS entry: ${value}`);
  }

  return provider;
}

async function fetchConfiguredProviderJobs(
  providers: SupportedProvider[],
  fetchedAt: Date
): Promise<Array<Job | null>> {
  const jobs: Array<Job | null> = [];
  let successfulProviders = 0;

  for (const provider of providers) {
    const sourceUrl = getConfiguredSourceUrl(provider, providers.length === 1);

    try {
      const providerJobs = await fetchProviderJobs(provider, sourceUrl, fetchedAt);
      successfulProviders += 1;
      jobs.push(...providerJobs);
      console.log(`Fetched ${providerJobs.length} raw jobs from ${getSourceMetadata(provider, sourceUrl).name}`);
    } catch (error) {
      console.warn(`Skipping ${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (successfulProviders === 0) {
    throw new Error("All configured job providers failed");
  }

  return jobs;
}

async function fetchProviderJobs(
  jobProvider: SupportedProvider,
  url: string,
  fetchedAt: Date
): Promise<Array<Job | null>> {
  if (jobProvider === "remoteok") {
    const payload = await fetchRemoteOk(url);
    return payload.map((job) => normalizeRemoteOkJob(job, fetchedAt));
  }

  if (jobProvider === "arbeitnow") {
    const payload = await fetchArbeitnow(url);
    return payload.map((job) => normalizeArbeitnowJob(job, fetchedAt));
  }

  if (jobProvider === "jobicy") {
    const payload = await fetchJobicy(url);
    return payload.map((job) => normalizeJobicyJob(job, fetchedAt));
  }

  const payload = await fetchRemotive(url);
  return payload.map((job) => normalizeRemotiveJob(job, fetchedAt));
}

async function fetchRemoteOk(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Remote OK request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!Array.isArray(json)) {
    throw new Error("Remote OK response was not an array");
  }

  return json.filter(isRemoteOkJob);
}

async function fetchRemotive(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Remotive request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { jobs?: unknown }).jobs)) {
    throw new Error("Remotive response did not include a jobs array");
  }

  return (json as { jobs: unknown[] }).jobs.filter(isRemotiveJob);
}

async function fetchArbeitnow(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Arbeitnow request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { data?: unknown }).data)) {
    throw new Error("Arbeitnow response did not include a data array");
  }

  return (json as { data: unknown[] }).data.filter(isArbeitnowJob);
}

async function fetchJobicy(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Jobicy request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { jobs?: unknown }).jobs)) {
    throw new Error("Jobicy response did not include a jobs array");
  }

  return (json as { jobs: unknown[] }).jobs.filter(isJobicyJob);
}

function isRemoteOkJob(value: unknown): value is RemoteOkJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as RemoteOkJob;
  return Boolean(candidate.id && candidate.position && candidate.company);
}

function isRemotiveJob(value: unknown): value is RemotiveJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as RemotiveJob;
  return Boolean(candidate.id && candidate.title && candidate.company_name && candidate.url);
}

function isArbeitnowJob(value: unknown): value is ArbeitnowJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as ArbeitnowJob;
  return Boolean(candidate.slug && candidate.title && candidate.company_name && candidate.url);
}

function isJobicyJob(value: unknown): value is JobicyJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as JobicyJob;
  return Boolean(candidate.id && candidate.jobTitle && candidate.companyName && candidate.url);
}

function normalizeRemoteOkJob(raw: RemoteOkJob, fetchedAt: Date): Job | null {
  const title = cleanText(raw.position);
  const company = cleanText(raw.company);
  const sourceJobUrl = cleanUrl(raw.url);
  const applyUrl = cleanUrl(raw.apply_url) ?? sourceJobUrl;

  if (!title || !company || !sourceJobUrl || !applyUrl) {
    return null;
  }

  const description = stripHtml(raw.description ?? "");
  const tags = Array.isArray(raw.tags) ? raw.tags.map(cleanText).filter(Boolean) : [];
  const haystack = normalizeSearchText(
    [title, company, raw.location, tags.join(" "), description].join(" ")
  );
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt = getPostedAt(raw);
  const staleAfter = addDays(new Date(postedAt), staleDays).toISOString();
  const salary = normalizeSalary(raw.salary_min, raw.salary_max);
  const workplace = inferWorkplace(raw.location, haystack);

  return {
    id: `remoteok-${raw.id}`,
    title,
    company,
    location: cleanText(raw.location) || "Remote",
    workplace,
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Remote OK",
    sourceUrl: sourceJobUrl,
    applyUrl,
    attributionLabel: "Remote OK",
    termsProfile: "attribution-required",
    summary: summarize(description),
    tags: normalizeTags(tags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: inferEmploymentType(haystack),
    ...(salary ? { salary } : {})
  };
}

function normalizeRemotiveJob(raw: RemotiveJob, fetchedAt: Date): Job | null {
  const title = cleanText(raw.title);
  const company = cleanText(raw.company_name);
  const sourceJobUrl = cleanUrl(raw.url);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const description = stripHtml(raw.description ?? "");
  const sourceTags = [raw.category, raw.job_type].map(cleanText).filter(Boolean);
  const haystack = normalizeSearchText(
    [
      title,
      company,
      raw.candidate_required_location,
      raw.category,
      raw.job_type,
      raw.salary,
      description
    ].join(" ")
  );
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt =
    raw.publication_date && !Number.isNaN(new Date(raw.publication_date).getTime())
      ? new Date(raw.publication_date).toISOString()
      : new Date().toISOString();
  const staleAfter = addDays(new Date(postedAt), staleDays).toISOString();

  return {
    id: `remotive-${raw.id}`,
    title,
    company,
    location: cleanText(raw.candidate_required_location) || "Remote",
    workplace: "Remote",
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Remotive",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: "Remotive",
    termsProfile: "attribution-required",
    summary: summarize(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: normalizeRemotiveJobType(raw.job_type),
    ...(raw.salary ? { salary: { currency: "USD", label: cleanText(raw.salary) } } : {})
  };
}

function normalizeArbeitnowJob(raw: ArbeitnowJob, fetchedAt: Date): Job | null {
  const title = cleanText(raw.title);
  const company = cleanText(raw.company_name);
  const sourceJobUrl = cleanUrl(raw.url);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const description = stripHtml(raw.description ?? "");
  const tags = Array.isArray(raw.tags) ? raw.tags.map(cleanText).filter(Boolean) : [];
  const jobTypes = Array.isArray(raw.job_types) ? raw.job_types.map(cleanText).filter(Boolean) : [];
  const haystack = normalizeSearchText(
    [title, company, raw.location, tags.join(" "), jobTypes.join(" "), description].join(" ")
  );
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt =
    raw.created_at && raw.created_at > 0
      ? new Date(raw.created_at * 1000).toISOString()
      : new Date().toISOString();
  const staleAfter = addDays(new Date(postedAt), staleDays).toISOString();
  const workplace = raw.remote ? "Remote" : inferWorkplace(raw.location, haystack);

  return {
    id: `arbeitnow-${raw.slug}`,
    title,
    company,
    location: cleanText(raw.location) || (raw.remote ? "Remote" : "Unknown"),
    workplace,
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Arbeitnow",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: "Arbeitnow",
    termsProfile: "attribution-required",
    summary: summarize(description),
    tags: normalizeTags([...tags, ...jobTypes], tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: inferEmploymentType(haystack)
  };
}

function normalizeJobicyJob(raw: JobicyJob, fetchedAt: Date): Job | null {
  const title = cleanText(raw.jobTitle);
  const company = cleanText(raw.companyName);
  const sourceJobUrl = cleanUrl(raw.url);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const description = stripHtml(raw.jobDescription ?? raw.jobExcerpt ?? "");
  const industry = Array.isArray(raw.jobIndustry) ? raw.jobIndustry.map(cleanText).filter(Boolean) : [];
  const jobType = Array.isArray(raw.jobType) ? raw.jobType.map(cleanText).filter(Boolean) : [];
  const haystack = normalizeSearchText(
    [title, company, raw.jobGeo, raw.jobLevel, industry.join(" "), jobType.join(" "), description].join(" ")
  );
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt =
    raw.pubDate && !Number.isNaN(new Date(raw.pubDate).getTime())
      ? new Date(raw.pubDate).toISOString()
      : new Date().toISOString();
  const staleAfter = addDays(new Date(postedAt), staleDays).toISOString();

  return {
    id: `jobicy-${raw.id}`,
    title,
    company,
    location: cleanText(raw.jobGeo) || "Remote",
    workplace: "Remote",
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Jobicy",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: "Jobicy",
    termsProfile: "attribution-required",
    summary: summarize(description),
    tags: normalizeTags([...industry, ...jobType], tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: jobType[0] || inferEmploymentType(haystack)
  };
}

function isEndpointRelevant(
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
  const looksLikeFrontlineSupport =
    containsAlias(haystack, "service desk") ||
    containsAlias(haystack, "help desk") ||
    containsAlias(haystack, "customer support") ||
    containsAlias(haystack, "technical support") ||
    containsAlias(haystack, "support analyst");

  if (looksLikeFrontlineSupport && !hasStrongTool) {
    return false;
  }

  return hasStrongTool || (hasEndpointRole && hasEndpointTitle);
}

function deriveTools(haystack: string) {
  return toolAliases
    .filter(({ aliases }) => aliases.some((alias) => containsAlias(haystack, alias)))
    .map(({ tool }) => tool);
}

function derivePlatforms(haystack: string) {
  const platforms = platformAliases
    .filter(({ aliases }) => aliases.some((alias) => containsAlias(haystack, alias)))
    .map(({ platform }) => platform);

  return platforms.length > 0 ? platforms : (["Windows", "macOS"] satisfies Platform[]);
}

function deriveMatchReasons(
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

function inferRoleFamily(
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

function inferSeniority(haystack: string): Seniority {
  if (containsAlias(haystack, "manager")) return "Manager";
  if (containsAlias(haystack, "lead")) return "Lead";
  if (containsAlias(haystack, "staff") || containsAlias(haystack, "principal")) return "Staff";
  if (containsAlias(haystack, "senior") || containsAlias(haystack, "sr")) return "Senior";
  if (containsAlias(haystack, "associate") || containsAlias(haystack, "junior")) return "Associate";
  return "Mid";
}

function inferEmploymentType(haystack: string) {
  if (containsAlias(haystack, "contract")) return "Contract";
  if (containsAlias(haystack, "part time") || containsAlias(haystack, "part-time")) return "Part-time";
  return "Full-time";
}

function normalizeRemotiveJobType(value: string | undefined) {
  const jobType = normalizeSearchText(value ?? "");

  if (jobType.includes("contract")) return "Contract";
  if (jobType.includes("part")) return "Part-time";
  if (jobType.includes("freelance")) return "Freelance";
  if (jobType.includes("intern")) return "Internship";
  return "Full-time";
}

function inferWorkplace(location: string | undefined, haystack: string): Workplace {
  const text = normalizeSearchText(`${location ?? ""} ${haystack}`);

  if (containsAlias(text, "remote")) return "Remote";
  if (containsAlias(text, "hybrid")) return "Hybrid";
  if (location) return "On-site";
  return "Unknown";
}

function normalizeTags(
  sourceTags: string[],
  tools: EndpointTool[],
  platforms: Platform[]
) {
  return Array.from(new Set([...platforms, ...tools, ...sourceTags]))
    .filter(Boolean)
    .slice(0, 12);
}

function getPostedAt(raw: RemoteOkJob) {
  if (raw.date && !Number.isNaN(new Date(raw.date).getTime())) {
    return new Date(raw.date).toISOString();
  }

  if (raw.epoch) {
    return new Date(raw.epoch * 1000).toISOString();
  }

  return new Date().toISOString();
}

function normalizeSalary(min?: number, max?: number) {
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

function summarize(value: string) {
  const withoutSpamPrompt = value.split("Please mention the word")[0] ?? value;
  const compact = cleanText(withoutSpamPrompt);

  if (compact.length <= 260) {
    return compact;
  }

  return `${compact.slice(0, 257).trim()}...`;
}

function stripHtml(value: string) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function cleanText(value: string | undefined) {
  return decodeEntities(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(value: string) {
  return cleanText(value).toLowerCase();
}

function containsAlias(haystack: string, alias: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

function cleanUrl(value: string | undefined) {
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

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function getConfiguredSourceUrl(provider: SupportedProvider, allowLegacyUrl: boolean) {
  const overrideKey = `JOB_${provider.toUpperCase()}_API_URL`;
  const providerOverride = process.env[overrideKey];

  if (providerOverride) {
    return providerOverride;
  }

  if (allowLegacyUrl && process.env.JOB_API_URL) {
    return process.env.JOB_API_URL;
  }

  return getDefaultSourceUrl(provider);
}

function getDefaultSourceUrl(jobProvider: SupportedProvider) {
  if (jobProvider === "remoteok") {
    return "https://remoteok.com/api";
  }

  if (jobProvider === "arbeitnow") {
    return "https://www.arbeitnow.com/api/job-board-api";
  }

  if (jobProvider === "jobicy") {
    return "https://jobicy.com/api/v2/remote-jobs?count=50&industry=engineering";
  }

  return "https://remotive.com/api/remote-jobs";
}

function getFeedSourceMetadata(providers: SupportedProvider[]) {
  if (providers.length === 1) {
    const provider = providers[0];
    return getSourceMetadata(provider, getConfiguredSourceUrl(provider, true));
  }

  return {
    name: providers
      .map((provider) => getSourceMetadata(provider, getDefaultSourceUrl(provider)).name)
      .join(" + "),
    url: process.env.JOB_FEED_SOURCE_URL ?? "https://github.com/jorgeasaurus/EndpointJobs"
  };
}

function getSourceMetadata(jobProvider: SupportedProvider, url: string) {
  if (jobProvider === "remoteok") {
    return {
      name: "Remote OK",
      url
    };
  }

  if (jobProvider === "arbeitnow") {
    return {
      name: "Arbeitnow",
      url
    };
  }

  if (jobProvider === "jobicy") {
    return {
      name: "Jobicy",
      url
    };
  }

  return {
    name: "Remotive",
    url
  };
}

function dedupeJobs(jobs: Job[]) {
  const byKey = new Map<string, Job>();

  for (const job of jobs) {
    const sourceKey = normalizeSearchText(job.sourceUrl);
    const roleKey = normalizeSearchText([job.title, job.company, job.location].join("|"));
    const key = roleKey || sourceKey;
    const existing = byKey.get(key);

    if (!existing || new Date(job.postedAt).getTime() > new Date(existing.postedAt).getTime()) {
      byKey.set(key, job);
    }
  }

  return Array.from(byKey.values());
}

function validateFeed(feed: JobsFeed) {
  for (const job of feed.jobs) {
    assertPresent(job.source, job.id, "source");
    assertPresent(job.sourceUrl, job.id, "sourceUrl");
    assertPresent(job.applyUrl, job.id, "applyUrl");
    assertPresent(job.fetchedAt, job.id, "fetchedAt");
    assertPresent(job.postedAt, job.id, "postedAt");
    assertPresent(job.staleAfter, job.id, "staleAfter");
    assertPresent(job.attributionLabel, job.id, "attributionLabel");
    assertPresent(job.termsProfile, job.id, "termsProfile");
  }
}

function assertPresent(value: unknown, id: string, field: string) {
  if (!value) {
    throw new Error(`Job ${id} is missing ${field}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
