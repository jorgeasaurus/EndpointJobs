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

type GreenhouseJob = {
  id?: string | number;
  title?: string;
  updated_at?: string;
  location?: {
    name?: string;
  };
  absolute_url?: string;
  content?: string;
  departments?: Array<{ name?: string }>;
  offices?: Array<{ name?: string; location?: string }>;
};

type LeverJob = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  categories?: {
    team?: string;
    department?: string;
    location?: string;
    commitment?: string;
  };
  description?: string;
  descriptionPlain?: string;
  lists?: Array<{ text?: string; content?: string }>;
  additional?: string;
  additionalPlain?: string;
  workplaceType?: string;
};

type MuseJob = {
  id?: string | number;
  name?: string;
  publication_date?: string;
  contents?: string;
  refs?: {
    landing_page?: string;
  };
  company?: {
    name?: string;
  };
  locations?: Array<{ name?: string }>;
  categories?: Array<{ name?: string }>;
  levels?: Array<{ name?: string }>;
  type?: string;
};

type AdzunaJob = {
  id?: string | number;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: {
    display_name?: string;
  };
  location?: {
    display_name?: string;
    area?: string[];
  };
  category?: {
    label?: string;
    tag?: string;
  };
  contract_type?: string;
  contract_time?: string;
  salary_min?: number;
  salary_max?: number;
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

const technicalRoleTitleTerms = [
  "systems administrator",
  "system administrator",
  "it administrator",
  "it systems administrator",
  "endpoint administrator",
  "systems engineer",
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

const defaultGreenhouseBoards = ["jamf", "automox", "tanium", "okta"];
const defaultLeverCompanies = ["jumpcloud"];
const defaultAdzunaQueries = [
  "endpoint engineer",
  "desktop engineer",
  "macos engineer",
  "windows engineer",
  "workplace engineer",
  "device management",
  "intune",
  "jamf",
  "sccm",
  "mdm"
];

async function main() {
  const configuredProviders = getConfiguredProviders();
  const fetchedAt = new Date();
  const result = await fetchConfiguredProviderJobs(configuredProviders, fetchedAt);
  const normalizedJobs = dedupeJobs(
    result.jobs
      .filter((job): job is Job => Boolean(job))
      .filter((job) => new Date(job.staleAfter).getTime() >= fetchedAt.getTime())
  )
    .sort((first, second) => new Date(second.postedAt).getTime() - new Date(first.postedAt).getTime())
    .slice(0, maxJobs);

  const feed: JobsFeed = {
    updatedAt: fetchedAt.toISOString(),
    source: getFeedSourceMetadata(result.providers),
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
    `Wrote ${normalizedJobs.length} endpoint jobs from ${result.providers.length} provider(s) to ${outputPath}`
  );
}

const supportedProviders = [
  "remoteok",
  "remotive",
  "arbeitnow",
  "jobicy",
  "greenhouse",
  "lever",
  "muse",
  "adzuna"
] as const;
type SupportedProvider = (typeof supportedProviders)[number];

const defaultProviders: SupportedProvider[] = [
  "remotive",
  "arbeitnow",
  "jobicy",
  "remoteok",
  "greenhouse",
  "lever",
  "muse"
];

function isSupportedProvider(value: string): value is SupportedProvider {
  return supportedProviders.includes(value as SupportedProvider);
}

function getConfiguredProviders() {
  const configured = process.env.JOB_PROVIDERS ?? process.env.JOB_PROVIDER;
  const providerNames = configured
    ? configured.split(",")
    : defaultProviders;
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
): Promise<{ jobs: Array<Job | null>; providers: SupportedProvider[] }> {
  const jobs: Array<Job | null> = [];
  const successfulProviders: SupportedProvider[] = [];

  for (const provider of providers) {
    const sourceUrl = getConfiguredSourceUrl(provider, providers.length === 1);

    try {
      const providerJobs = await fetchProviderJobs(provider, sourceUrl, fetchedAt);
      successfulProviders.push(provider);
      jobs.push(...providerJobs);
      console.log(`Fetched ${providerJobs.length} raw jobs from ${getSourceMetadata(provider, sourceUrl).name}`);
    } catch (error) {
      console.warn(`Skipping ${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (successfulProviders.length === 0) {
    throw new Error("All configured job providers failed");
  }

  return { jobs, providers: successfulProviders };
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

  if (jobProvider === "greenhouse") {
    return fetchGreenhouseJobs(url, fetchedAt);
  }

  if (jobProvider === "lever") {
    return fetchLeverJobs(url, fetchedAt);
  }

  if (jobProvider === "muse") {
    return fetchMuseJobs(url, fetchedAt);
  }

  if (jobProvider === "adzuna") {
    return fetchAdzunaJobs(url, fetchedAt);
  }

  const payload = await fetchRemotive(url);
  return payload.map((job) => normalizeRemotiveJob(job, fetchedAt));
}

async function fetchGreenhouseJobs(url: string, fetchedAt: Date) {
  const boards = getCsvConfig("JOB_GREENHOUSE_BOARDS", defaultGreenhouseBoards);
  const jobs: Array<Job | null> = [];
  let successfulBoards = 0;

  for (const board of boards) {
    const boardUrl = buildGreenhouseBoardUrl(url, board);

    try {
      const payload = await fetchGreenhouseBoard(boardUrl, board);
      successfulBoards += 1;
      jobs.push(...payload.map((job) => normalizeGreenhouseJob(job, board, fetchedAt)));
      console.log(`Fetched ${payload.length} raw jobs from Greenhouse/${board}`);
    } catch (error) {
      console.warn(
        `Skipping Greenhouse/${board}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (successfulBoards === 0) {
    throw new Error("No Greenhouse boards returned jobs");
  }

  return jobs;
}

async function fetchLeverJobs(url: string, fetchedAt: Date) {
  const companies = getCsvConfig("JOB_LEVER_COMPANIES", defaultLeverCompanies);
  const jobs: Array<Job | null> = [];
  let successfulCompanies = 0;

  for (const company of companies) {
    const companyUrl = buildLeverCompanyUrl(url, company);

    try {
      const payload = await fetchLeverCompany(companyUrl, company);
      successfulCompanies += 1;
      jobs.push(...payload.map((job) => normalizeLeverJob(job, company, fetchedAt)));
      console.log(`Fetched ${payload.length} raw jobs from Lever/${company}`);
    } catch (error) {
      console.warn(
        `Skipping Lever/${company}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (successfulCompanies === 0) {
    throw new Error("No Lever companies returned jobs");
  }

  return jobs;
}

async function fetchMuseJobs(url: string, fetchedAt: Date) {
  const pages = Math.max(1, Number(process.env.JOB_MUSE_PAGES ?? 5));
  const jobs: Array<Job | null> = [];
  let successfulPages = 0;

  for (let page = 1; page <= pages; page += 1) {
    const pageUrl = buildMusePageUrl(url, page);
    const payload = await fetchMusePage(pageUrl);
    successfulPages += 1;
    jobs.push(...payload.map((job) => normalizeMuseJob(job, fetchedAt)));
    console.log(`Fetched ${payload.length} raw jobs from The Muse page ${page}`);
  }

  if (successfulPages === 0) {
    throw new Error("No Muse pages returned jobs");
  }

  return jobs;
}

async function fetchAdzunaJobs(url: string, fetchedAt: Date) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    throw new Error("ADZUNA_APP_ID and ADZUNA_APP_KEY are required");
  }

  const queries = getCsvConfig("JOB_ADZUNA_QUERIES", defaultAdzunaQueries);
  const jobs: Array<Job | null> = [];

  for (const query of queries) {
    const queryUrl = buildAdzunaSearchUrl(url, query, appId, appKey);
    const payload = await fetchAdzunaSearch(queryUrl);
    jobs.push(...payload.map((job) => normalizeAdzunaJob(job, fetchedAt)));
    console.log(`Fetched ${payload.length} raw jobs from Adzuna query ${query}`);
  }

  return jobs;
}

async function fetchGreenhouseBoard(url: string, board: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Greenhouse ${board} request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { jobs?: unknown }).jobs)) {
    throw new Error(`Greenhouse ${board} response did not include a jobs array`);
  }

  return (json as { jobs: unknown[] }).jobs.filter(isGreenhouseJob);
}

async function fetchLeverCompany(url: string, company: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Lever ${company} request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!Array.isArray(json)) {
    throw new Error(`Lever ${company} response was not an array`);
  }

  return json.filter(isLeverJob);
}

async function fetchMusePage(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`The Muse request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { results?: unknown }).results)) {
    throw new Error("The Muse response did not include a results array");
  }

  return (json as { results: unknown[] }).results.filter(isMuseJob);
}

async function fetchAdzunaSearch(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Adzuna request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { results?: unknown }).results)) {
    throw new Error("Adzuna response did not include a results array");
  }

  return (json as { results: unknown[] }).results.filter(isAdzunaJob);
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

function isGreenhouseJob(value: unknown): value is GreenhouseJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as GreenhouseJob;
  return Boolean(candidate.id && candidate.title && candidate.absolute_url);
}

function isLeverJob(value: unknown): value is LeverJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as LeverJob;
  return Boolean(candidate.id && candidate.text && candidate.hostedUrl);
}

function isMuseJob(value: unknown): value is MuseJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as MuseJob;
  return Boolean(candidate.id && candidate.name && candidate.company?.name && candidate.refs?.landing_page);
}

function isAdzunaJob(value: unknown): value is AdzunaJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as AdzunaJob;
  return Boolean(candidate.id && candidate.title && candidate.company?.display_name && candidate.redirect_url);
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

function normalizeGreenhouseJob(raw: GreenhouseJob, board: string, fetchedAt: Date): Job | null {
  const title = cleanText(raw.title);
  const company = formatSourceAccountName(board);
  const sourceJobUrl = cleanUrl(raw.absolute_url);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const description = stripHtml(raw.content ?? "");
  const location = cleanText(raw.location?.name);
  const departments = Array.isArray(raw.departments)
    ? raw.departments.map((department) => cleanText(department.name)).filter(Boolean)
    : [];
  const offices = Array.isArray(raw.offices)
    ? raw.offices
        .flatMap((office) => [cleanText(office.name), cleanText(office.location)])
        .filter(Boolean)
    : [];
  const sourceTags = [...departments, ...offices];
  const haystack = normalizeSearchText([title, company, location, sourceTags.join(" "), description].join(" "));
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt =
    raw.updated_at && !Number.isNaN(new Date(raw.updated_at).getTime())
      ? new Date(raw.updated_at).toISOString()
      : new Date().toISOString();
  const staleAfter = addDays(new Date(postedAt), staleDays).toISOString();

  return {
    id: `greenhouse-${board}-${raw.id}`,
    title,
    company,
    location: location || "Unknown",
    workplace: inferWorkplace(location, haystack),
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Greenhouse",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: `Greenhouse / ${company}`,
    termsProfile: "public-api",
    summary: summarize(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: inferEmploymentType(haystack)
  };
}

function normalizeLeverJob(raw: LeverJob, companySlug: string, fetchedAt: Date): Job | null {
  const title = cleanText(raw.text);
  const company = formatSourceAccountName(companySlug);
  const sourceJobUrl = cleanUrl(raw.hostedUrl);
  const applyUrl = cleanUrl(raw.applyUrl) ?? sourceJobUrl;

  if (!title || !company || !sourceJobUrl || !applyUrl) {
    return null;
  }

  const listText = Array.isArray(raw.lists)
    ? raw.lists.map((list) => `${list.text ?? ""} ${list.content ?? ""}`).join(" ")
    : "";
  const description = stripHtml(
    [raw.descriptionPlain, raw.description, listText, raw.additionalPlain, raw.additional]
      .map((value) => value ?? "")
      .join(" ")
  );
  const location = cleanText(raw.categories?.location);
  const sourceTags = [
    raw.categories?.team,
    raw.categories?.department,
    raw.categories?.commitment,
    raw.workplaceType
  ]
    .map(cleanText)
    .filter(Boolean);
  const haystack = normalizeSearchText([title, company, location, sourceTags.join(" "), description].join(" "));
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt =
    raw.createdAt && !Number.isNaN(new Date(raw.createdAt).getTime())
      ? new Date(raw.createdAt).toISOString()
      : new Date().toISOString();
  const staleAfter = addDays(new Date(postedAt), staleDays).toISOString();

  return {
    id: `lever-${companySlug}-${raw.id}`,
    title,
    company,
    location: location || "Unknown",
    workplace: inferWorkplace(location, haystack),
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Lever",
    sourceUrl: sourceJobUrl,
    applyUrl,
    attributionLabel: `Lever / ${company}`,
    termsProfile: "public-api",
    summary: summarize(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: cleanText(raw.categories?.commitment) || inferEmploymentType(haystack)
  };
}

function normalizeMuseJob(raw: MuseJob, fetchedAt: Date): Job | null {
  const title = cleanText(raw.name);
  const company = cleanText(raw.company?.name);
  const sourceJobUrl = cleanUrl(raw.refs?.landing_page);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const description = stripHtml(raw.contents ?? "");
  const locations = Array.isArray(raw.locations)
    ? raw.locations.map((location) => cleanText(location.name)).filter(Boolean)
    : [];
  const categories = Array.isArray(raw.categories)
    ? raw.categories.map((category) => cleanText(category.name)).filter(Boolean)
    : [];
  const levels = Array.isArray(raw.levels)
    ? raw.levels.map((level) => cleanText(level.name)).filter(Boolean)
    : [];
  const sourceTags = [...categories, ...levels, cleanText(raw.type)].filter(Boolean);
  const location = locations.join("; ");
  const haystack = normalizeSearchText([title, company, location, sourceTags.join(" "), description].join(" "));
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
    id: `muse-${raw.id}`,
    title,
    company,
    location: location || "Unknown",
    workplace: inferWorkplace(location, haystack),
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "The Muse",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: "The Muse",
    termsProfile: "public-api",
    summary: summarize(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: cleanText(raw.type) || inferEmploymentType(haystack)
  };
}

function normalizeAdzunaJob(raw: AdzunaJob, fetchedAt: Date): Job | null {
  const title = cleanText(raw.title);
  const company = cleanText(raw.company?.display_name);
  const sourceJobUrl = cleanUrl(raw.redirect_url);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const description = stripHtml(raw.description ?? "");
  const location = cleanText(raw.location?.display_name ?? raw.location?.area?.join(", "));
  const sourceTags = [raw.category?.label, raw.category?.tag, raw.contract_type, raw.contract_time]
    .map(cleanText)
    .filter(Boolean);
  const haystack = normalizeSearchText([title, company, location, sourceTags.join(" "), description].join(" "));
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt =
    raw.created && !Number.isNaN(new Date(raw.created).getTime())
      ? new Date(raw.created).toISOString()
      : new Date().toISOString();
  const staleAfter = addDays(new Date(postedAt), staleDays).toISOString();
  const salary = normalizeSalary(raw.salary_min, raw.salary_max);

  return {
    id: `adzuna-${raw.id}`,
    title,
    company,
    location: location || "Unknown",
    workplace: inferWorkplace(location, haystack),
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Adzuna",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: "Adzuna",
    termsProfile: "attribution-required",
    summary: summarize(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: cleanText(raw.contract_type ?? raw.contract_time) || inferEmploymentType(haystack),
    ...(salary ? { salary } : {})
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
  const hasTechnicalTitle = technicalRoleTitleTerms.some((term) =>
    containsAlias(normalizedTitle, term)
  );
  const looksLikeFrontlineSupport =
    containsAlias(haystack, "service desk") ||
    containsAlias(haystack, "help desk") ||
    containsAlias(haystack, "customer support") ||
    containsAlias(haystack, "technical support") ||
    containsAlias(haystack, "support analyst");
  const looksLikeEntrySupport =
    containsAlias(normalizedTitle, "customer support") ||
    containsAlias(normalizedTitle, "tier 1") ||
    containsAlias(normalizedTitle, "tier 2") ||
    containsAlias(normalizedTitle, "help desk") ||
    containsAlias(normalizedTitle, "service desk");
  const looksLikeApplicationSecurity =
    containsAlias(normalizedTitle, "application security") ||
    containsAlias(normalizedTitle, "appsec");

  if (
    looksLikeEntrySupport ||
    (looksLikeFrontlineSupport && !hasEndpointTitle) ||
    (looksLikeApplicationSecurity && !hasEndpointTitle)
  ) {
    return false;
  }

  return hasEndpointTitle || (hasStrongTool && hasEndpointRole && hasTechnicalTitle);
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

  if (jobProvider === "greenhouse") {
    return "https://boards-api.greenhouse.io/v1/boards";
  }

  if (jobProvider === "lever") {
    return "https://api.lever.co/v0/postings";
  }

  if (jobProvider === "muse") {
    return "https://www.themuse.com/api/public/jobs?category=Computer%20and%20IT&page={page}";
  }

  if (jobProvider === "adzuna") {
    return "https://api.adzuna.com/v1/api/jobs/{country}/search/{page}";
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

  if (jobProvider === "greenhouse") {
    return {
      name: "Greenhouse",
      url
    };
  }

  if (jobProvider === "lever") {
    return {
      name: "Lever",
      url
    };
  }

  if (jobProvider === "muse") {
    return {
      name: "The Muse",
      url
    };
  }

  if (jobProvider === "adzuna") {
    return {
      name: "Adzuna",
      url
    };
  }

  return {
    name: "Remotive",
    url
  };
}

function getCsvConfig(envKey: string, fallback: string[]) {
  const configured = process.env[envKey];
  const values = configured ? configured.split(",") : fallback;

  return values.map((value) => value.trim()).filter(Boolean);
}

function buildGreenhouseBoardUrl(baseUrl: string, board: string) {
  const template = baseUrl.includes("{board}")
    ? baseUrl.replace("{board}", encodeURIComponent(board))
    : `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(board)}/jobs`;
  const url = new URL(template);

  if (!url.searchParams.has("content")) {
    url.searchParams.set("content", "true");
  }

  return url.toString();
}

function buildLeverCompanyUrl(baseUrl: string, company: string) {
  const template = baseUrl.includes("{company}")
    ? baseUrl.replace("{company}", encodeURIComponent(company))
    : `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(company)}`;
  const url = new URL(template);

  if (!url.searchParams.has("mode")) {
    url.searchParams.set("mode", "json");
  }

  return url.toString();
}

function buildMusePageUrl(baseUrl: string, page: number) {
  const template = baseUrl.includes("{page}")
    ? baseUrl.replace("{page}", page.toString())
    : baseUrl;
  const url = new URL(template);

  if (!url.searchParams.has("page")) {
    url.searchParams.set("page", page.toString());
  }

  return url.toString();
}

function buildAdzunaSearchUrl(baseUrl: string, query: string, appId: string, appKey: string) {
  const country = process.env.JOB_ADZUNA_COUNTRY ?? "us";
  const page = process.env.JOB_ADZUNA_PAGE ?? "1";
  const resultsPerPage = process.env.JOB_ADZUNA_RESULTS_PER_PAGE ?? "25";
  const template = baseUrl
    .replace("{country}", encodeURIComponent(country))
    .replace("{page}", encodeURIComponent(page));
  const url = new URL(template);

  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", resultsPerPage);
  url.searchParams.set("what", query);
  url.searchParams.set("content-type", "application/json");

  return url.toString();
}

function formatSourceAccountName(slug: string) {
  const knownNames: Record<string, string> = {
    automox: "Automox",
    jamf: "Jamf",
    jumpcloud: "JumpCloud",
    okta: "Okta",
    tanium: "Tanium"
  };
  const normalized = slug.trim().toLowerCase();

  if (knownNames[normalized]) {
    return knownNames[normalized];
  }

  return slug
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
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
