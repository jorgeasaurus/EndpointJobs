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

type AshbyJob = {
  id?: string;
  title?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  publishedAt?: string;
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
};

type AmazonJob = {
  id?: string | number;
  title?: string;
  company_name?: string;
  location?: string;
  normalized_location?: string;
  posted_date?: string;
  updated_time?: string;
  job_path?: string;
  url_next_step?: string;
  description?: string;
  description_short?: string;
  basic_qualifications?: string;
  preferred_qualifications?: string;
  job_category?: string;
  job_family?: string;
  job_schedule_type?: string;
  team?: string | { label?: string };
};

type ActivateJob = {
  id?: string;
  title?: string;
  location?: string;
  sourceJobUrl?: string;
  summary?: string;
};

type ActivateSite = {
  name: string;
  url: string;
  queries: string[];
};

type JibeJob = {
  data?: {
    slug?: string;
    req_id?: string;
    title?: string;
    description?: string;
    location_name?: string;
    full_location?: string;
    short_location?: string;
    location_type?: string;
    categories?: Array<{ name?: string }>;
    tags1?: string[];
    tags2?: string[];
    tags3?: string[];
    tags4?: string[];
    tags5?: string[];
    tags6?: string[];
    tags7?: string[];
    employment_type?: string;
    hiring_organization?: string;
    source?: string;
    posted_date?: string;
    apply_url?: string;
    update_date?: string;
    create_date?: string;
  };
};

type JibeSite = {
  name: string;
  url: string;
  queries: string[];
};

type WorkdayJob = {
  title?: string;
  externalPath?: string;
  postedOn?: string;
  bulletFields?: string[];
  locationsText?: string;
};

type WorkdaySite = {
  name: string;
  url: string;
  queries: string[];
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

const defaultGreenhouseBoards = [
  "jamf",
  "automox",
  "tanium",
  "okta",
  "sonyinteractiveentertainmentglobal",
  "verkada",
  "anthropic",
  "doordashusa",
  "commvault",
  "kaseya",
  "kymeratherapeutics"
];
const defaultLeverCompanies = ["jumpcloud", "brightonjones", "hermeus", "omnidian"];
const defaultAdzunaQueries = [
  "endpoint engineer",
  "desktop engineer",
  "macos engineer",
  "windows engineer",
  "workplace engineer",
  "client engineering",
  "end user computer",
  "device management",
  "intune",
  "jamf",
  "sccm",
  "mdm"
];
const defaultAshbyBoards = ["docker"];
const defaultAmazonQueries = [
  "macOS Client Engineering",
  "systems engineer macOS",
  "client engineering",
  "endpoint engineer",
  "intune engineer",
  "end user computer"
];
const defaultWorkdaySites: WorkdaySite[] = [
  {
    name: "Accenture",
    url: "https://accenture.wd103.myworkdayjobs.com/wday/cxs/accenture/AccentureCareers/jobs",
    queries: [
      "Intune Engineer",
      "Endpoint Engineer",
      "Client Engineering",
      "End User Computer",
      "Workplace Engineer"
    ]
  },
  {
    name: "Goodwin",
    url: "https://goodwinprocter.wd5.myworkdayjobs.com/wday/cxs/goodwinprocter/External_Careers/jobs",
    queries: ["Manager Desktop Engineering", "Desktop Engineering", "Endpoint Engineer"]
  },
  {
    name: "GDIT",
    url: "https://gdit.wd5.myworkdayjobs.com/wday/cxs/gdit/External_Career_Site/jobs",
    queries: ["Endpoint Engineer", "Endpoint", "Intune", "Desktop Engineer"]
  },
  {
    name: "UT Austin",
    url: "https://utaustin.wd1.myworkdayjobs.com/wday/cxs/utaustin/UTstaff/jobs",
    queries: ["Senior Endpoint Engineer", "Endpoint Engineer", "Intune"]
  },
  {
    name: "Blue Origin",
    url: "https://blueorigin.wd5.myworkdayjobs.com/wday/cxs/blueorigin/BlueOrigin/jobs",
    queries: ["Endpoint Experience Administrator", "Endpoint Experience", "Intune"]
  },
  {
    name: "Dexcom",
    url: "https://dexcom.wd1.myworkdayjobs.com/wday/cxs/dexcom/Dexcom/jobs",
    queries: ["Sr Staff Desktop Systems Engineer", "Desktop Systems Engineer", "Endpoint Engineer"]
  },
  {
    name: "Leidos",
    url: "https://leidos.wd5.myworkdayjobs.com/wday/cxs/leidos/External/jobs",
    queries: ["End-Point Protection Engineer", "Endpoint Protection Engineer", "Endpoint Engineer", "Unified Endpoint Management"]
  }
];
const defaultActivateSites: ActivateSite[] = [
  {
    name: "Cardinal Health",
    url: "https://jobs.cardinalhealth.com/search/searchresultslist",
    queries: ["Senior Engineer, IT Client Services", "IT Client Services", "Endpoint"]
  }
];
const defaultJibeSites: JibeSite[] = [
  {
    name: "McGraw Hill",
    url: "https://careers.mheducation.com/api/jobs",
    queries: ["Endpoint Engineering Lead", "Endpoint Engineer", "Jamf", "Intune"]
  }
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
  "ashby",
  "amazon",
  "workday",
  "jibe",
  "activate",
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
  "muse",
  "ashby",
  "amazon",
  "workday",
  "jibe",
  "activate"
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

  if (jobProvider === "ashby") {
    return fetchAshbyJobs(url, fetchedAt);
  }

  if (jobProvider === "amazon") {
    return fetchAmazonJobs(url, fetchedAt);
  }

  if (jobProvider === "workday") {
    return fetchWorkdayJobs(url, fetchedAt);
  }

  if (jobProvider === "jibe") {
    return fetchJibeJobs(url, fetchedAt);
  }

  if (jobProvider === "activate") {
    return fetchActivateJobs(url, fetchedAt);
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

async function fetchAshbyJobs(url: string, fetchedAt: Date) {
  const boards = getCsvConfig("JOB_ASHBY_BOARDS", defaultAshbyBoards);
  const jobs: Array<Job | null> = [];
  let successfulBoards = 0;

  for (const board of boards) {
    const boardUrl = buildAshbyBoardUrl(url, board);

    try {
      const payload = await fetchAshbyBoard(boardUrl, board);
      successfulBoards += 1;
      jobs.push(...payload.map((job) => normalizeAshbyJob(job, board, fetchedAt)));
      console.log(`Fetched ${payload.length} raw jobs from Ashby/${board}`);
    } catch (error) {
      console.warn(`Skipping Ashby/${board}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (successfulBoards === 0) {
    throw new Error("No Ashby boards returned jobs");
  }

  return jobs;
}

async function fetchAmazonJobs(url: string, fetchedAt: Date) {
  const queries = getCsvConfig("JOB_AMAZON_QUERIES", defaultAmazonQueries);
  const jobs: Array<Job | null> = [];

  for (const query of queries) {
    const queryUrl = buildAmazonSearchUrl(url, query);
    const payload = await fetchAmazonSearch(queryUrl);
    jobs.push(...payload.map((job) => normalizeAmazonJob(job, fetchedAt)));
    console.log(`Fetched ${payload.length} raw jobs from Amazon Jobs query ${query}`);
  }

  return jobs;
}

async function fetchWorkdayJobs(url: string, fetchedAt: Date) {
  const sites = getWorkdaySites(url);
  const jobs: Array<Job | null> = [];

  for (const site of sites) {
    for (const query of site.queries) {
      const payload = await fetchWorkdaySearch(site.url, query);
      jobs.push(...payload.map((job) => normalizeWorkdayJob(job, site, query, fetchedAt)));
      console.log(`Fetched ${payload.length} raw jobs from Workday/${site.name} query ${query}`);
    }
  }

  return jobs;
}

async function fetchActivateJobs(url: string, fetchedAt: Date) {
  const sites = getActivateSites(url);
  const jobs: Array<Job | null> = [];

  for (const site of sites) {
    for (const query of site.queries) {
      const payload = await fetchActivateSearch(site.url, query, site.name);
      jobs.push(...payload.map((job) => normalizeActivateJob(job, site, query, fetchedAt)));
      console.log(`Fetched ${payload.length} raw jobs from Activate/${site.name} query ${query}`);
    }
  }

  return jobs;
}

async function fetchJibeJobs(url: string, fetchedAt: Date) {
  const sites = getJibeSites(url);
  const jobs: Array<Job | null> = [];

  for (const site of sites) {
    for (const query of site.queries) {
      const payload = await fetchJibeSearch(site.url, query, site.name);
      jobs.push(...payload.map((job) => normalizeJibeJob(job, site, query, fetchedAt)));
      console.log(`Fetched ${payload.length} raw jobs from Jibe/${site.name} query ${query}`);
    }
  }

  return jobs;
}

async function fetchAshbyBoard(url: string, board: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Ashby ${board} request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { jobs?: unknown }).jobs)) {
    throw new Error(`Ashby ${board} response did not include a jobs array`);
  }

  return (json as { jobs: unknown[] }).jobs.filter(isAshbyJob);
}

async function fetchAmazonSearch(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Amazon Jobs request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { jobs?: unknown }).jobs)) {
    throw new Error("Amazon Jobs response did not include a jobs array");
  }

  return (json as { jobs: unknown[] }).jobs.filter(isAmazonJob);
}

async function fetchWorkdaySearch(url: string, query: string) {
  const configuredLimit = Number(process.env.JOB_WORKDAY_RESULTS_PER_QUERY ?? 10);
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 10;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: new URL(url).origin,
      referer: new URL(url).origin,
      "user-agent": "Mozilla/5.0"
    },
    body: JSON.stringify({
      appliedFacets: {},
      limit,
      offset: 0,
      searchText: query
    })
  });

  if (!response.ok) {
    throw new Error(`Workday request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { jobPostings?: unknown }).jobPostings)) {
    throw new Error("Workday response did not include a jobPostings array");
  }

  return (json as { jobPostings: unknown[] }).jobPostings.filter(isWorkdayJob);
}

async function fetchActivateSearch(url: string, query: string, siteName: string) {
  const queryUrl = buildActivateSearchUrl(url, query);
  const response = await fetch(queryUrl, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      referer: new URL(url).origin,
      "user-agent": "Mozilla/5.0",
      "x-requested-with": "XMLHttpRequest"
    }
  });

  if (!response.ok) {
    throw new Error(`Activate ${siteName} request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || typeof (json as { jobsHtml?: unknown }).jobsHtml !== "string") {
    throw new Error(`Activate ${siteName} response did not include jobsHtml`);
  }

  return parseActivateJobs((json as { jobsHtml: string }).jobsHtml, url);
}

async function fetchJibeSearch(url: string, query: string, siteName: string) {
  const queryUrl = buildJibeSearchUrl(url, query);
  const response = await fetch(queryUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Jibe ${siteName} request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { jobs?: unknown }).jobs)) {
    throw new Error(`Jibe ${siteName} response did not include a jobs array`);
  }

  return (json as { jobs: unknown[] }).jobs.filter(isJibeJob);
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

function isAshbyJob(value: unknown): value is AshbyJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as AshbyJob;
  return Boolean(candidate.id && candidate.title && candidate.jobUrl);
}

function isAmazonJob(value: unknown): value is AmazonJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as AmazonJob;
  return Boolean(candidate.id && candidate.title && candidate.job_path);
}

function isActivateJob(value: unknown): value is ActivateJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as ActivateJob;
  return Boolean(candidate.id && candidate.title && candidate.sourceJobUrl);
}

function isJibeJob(value: unknown): value is JibeJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as JibeJob;
  return Boolean(candidate.data?.slug && candidate.data?.title);
}

function isWorkdayJob(value: unknown): value is WorkdayJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as WorkdayJob;
  return Boolean(candidate.title && candidate.externalPath);
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
  const staleAfter = addDays(fetchedAt, staleDays).toISOString();

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
  const staleAfter = addDays(fetchedAt, staleDays).toISOString();

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

function normalizeAshbyJob(raw: AshbyJob, board: string, fetchedAt: Date): Job | null {
  const title = cleanText(raw.title);
  const company = formatSourceAccountName(board);
  const sourceJobUrl = cleanUrl(raw.jobUrl);
  const applyUrl = cleanUrl(raw.applyUrl) ?? sourceJobUrl;

  if (!title || !company || !sourceJobUrl || !applyUrl) {
    return null;
  }

  const description = stripHtml(raw.descriptionPlain ?? raw.descriptionHtml ?? "");
  const sourceTags = [raw.department, raw.team, raw.employmentType, raw.workplaceType]
    .map(cleanText)
    .filter(Boolean);
  const haystack = normalizeSearchText(
    [title, company, raw.location, sourceTags.join(" "), description].join(" ")
  );
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt =
    raw.publishedAt && !Number.isNaN(new Date(raw.publishedAt).getTime())
      ? new Date(raw.publishedAt).toISOString()
      : new Date().toISOString();
  const staleAfter = addDays(fetchedAt, staleDays).toISOString();
  const workplace = raw.isRemote ? "Remote" : inferWorkplace(raw.location, `${haystack} ${raw.workplaceType ?? ""}`);

  return {
    id: `ashby-${board}-${raw.id}`,
    title,
    company,
    location: cleanText(raw.location) || "Unknown",
    workplace,
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Ashby",
    sourceUrl: sourceJobUrl,
    applyUrl,
    attributionLabel: `Ashby / ${company}`,
    termsProfile: "public-api",
    summary: summarize(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: cleanText(raw.employmentType) || inferEmploymentType(haystack)
  };
}

function normalizeAmazonJob(raw: AmazonJob, fetchedAt: Date): Job | null {
  const title = cleanText(raw.title);
  const company = cleanText(raw.company_name) || "Amazon";
  const sourceJobUrl = buildAmazonJobUrl(raw.job_path);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const description = stripHtml(
    [raw.description, raw.description_short, raw.basic_qualifications, raw.preferred_qualifications]
      .map((value) => value ?? "")
      .join(" ")
  );
  const sourceTags = [raw.job_category, raw.job_family, raw.job_schedule_type, getAmazonTeamLabel(raw.team)]
    .map(cleanText)
    .filter(Boolean);
  const location = cleanText(raw.normalized_location ?? raw.location);
  const haystack = normalizeSearchText([title, company, location, sourceTags.join(" "), description].join(" "));
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt = parseDateLike(raw.posted_date) ?? parseDateLike(raw.updated_time) ?? new Date().toISOString();
  const staleAfter = addDays(fetchedAt, staleDays).toISOString();

  return {
    id: `amazon-${raw.id}`,
    title,
    company,
    location: location || "Unknown",
    workplace: inferWorkplace(location, haystack),
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Amazon Jobs",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: "Amazon Jobs",
    termsProfile: "public-api",
    summary: summarize(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: cleanText(raw.job_schedule_type) || inferEmploymentType(haystack)
  };
}

function normalizeActivateJob(raw: ActivateJob, site: ActivateSite, query: string, fetchedAt: Date): Job | null {
  if (!isActivateJob(raw)) {
    return null;
  }

  const title = cleanText(raw.title);
  const company = site.name;
  const sourceJobUrl = cleanUrl(raw.sourceJobUrl);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const location = cleanText(raw.location);
  const description = cleanText([query, raw.summary].filter(Boolean).join(" "));
  const haystack = normalizeSearchText([title, company, location, description].join(" "));
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt = fetchedAt.toISOString();
  const staleAfter = addDays(fetchedAt, staleDays).toISOString();

  return {
    id: `activate-${normalizeIdPart(site.name)}-${normalizeIdPart(raw.id ?? sourceJobUrl)}`,
    title,
    company,
    location: location || "Unknown",
    workplace: inferWorkplace(location, haystack),
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Activate",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: `Activate / ${site.name}`,
    termsProfile: "public-api",
    summary: summarize(description),
    tags: normalizeTags([query], tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: inferEmploymentType(haystack)
  };
}

function normalizeJibeJob(raw: JibeJob, site: JibeSite, query: string, fetchedAt: Date): Job | null {
  const data = raw.data ?? {};
  const title = cleanText(data.title);
  const company = cleanText(data.hiring_organization ?? data.source) || site.name;
  const sourceJobUrl = buildJibeJobUrl(site.url, data.slug);
  const applyUrl = cleanUrl(data.apply_url) ?? sourceJobUrl;

  if (!title || !company || !sourceJobUrl || !applyUrl) {
    return null;
  }

  const description = stripHtml(data.description ?? "");
  const location = cleanText(data.location_name ?? data.full_location ?? data.short_location);
  const categories = Array.isArray(data.categories)
    ? data.categories.map((category) => cleanText(category.name)).filter(Boolean)
    : [];
  const tagFields = [data.tags2, data.tags4]
    .flatMap((tags) => (Array.isArray(tags) ? tags : []))
    .map(cleanText)
    .filter(Boolean);
  const sourceTags = [...categories, ...tagFields, cleanText(data.location_type), cleanText(data.employment_type)].filter(Boolean);
  const haystack = normalizeSearchText([title, company, location, sourceTags.join(" "), description].join(" "));
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt = parseDateLike(data.posted_date) ?? parseDateLike(data.update_date) ?? parseDateLike(data.create_date) ?? fetchedAt.toISOString();
  const staleAfter = addDays(new Date(postedAt), staleDays).toISOString();

  return {
    id: `jibe-${normalizeIdPart(site.name)}-${normalizeIdPart(data.req_id ?? data.slug ?? sourceJobUrl)}`,
    title,
    company,
    location: location || "Unknown",
    workplace: inferWorkplace(location, haystack),
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Jibe",
    sourceUrl: sourceJobUrl,
    applyUrl,
    attributionLabel: `Jibe / ${site.name}`,
    termsProfile: "public-api",
    summary: summarize(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: cleanText(data.employment_type) || inferEmploymentType(haystack)
  };
}

function normalizeWorkdayJob(raw: WorkdayJob, site: WorkdaySite, query: string, fetchedAt: Date): Job | null {
  const title = cleanText(raw.title);
  const company = site.name;
  const sourceJobUrl = buildWorkdayJobUrl(site.url, raw.externalPath);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const bulletFields = Array.isArray(raw.bulletFields) ? raw.bulletFields.map(cleanText).filter(Boolean) : [];
  const location = cleanText(raw.locationsText) || bulletFields.find((field) => !/^[A-Z0-9-]+$/.test(field));
  const description = cleanText([title, query, bulletFields.join(" ")].join(" "));
  const haystack = normalizeSearchText([title, company, location, bulletFields.join(" ")].join(" "));
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt = parseWorkdayPostedOn(raw.postedOn, fetchedAt) ?? fetchedAt.toISOString();
  const staleAfter = addDays(fetchedAt, staleDays).toISOString();

  return {
    id: `workday-${normalizeIdPart(site.name)}-${normalizeIdPart(sourceJobUrl)}`,
    title,
    company,
    location: location || "Unknown",
    workplace: inferWorkplace(location, haystack),
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Workday",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: `Workday / ${company}`,
    termsProfile: "public-api",
    summary: summarize(description),
    tags: normalizeTags([query, ...bulletFields], tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: inferEmploymentType(haystack)
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

function cleanText(value: unknown) {
  return decodeEntities(value == null ? "" : String(value))
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

function parseDateLike(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function parseWorkdayPostedOn(value: string | undefined, fetchedAt: Date) {
  const text = normalizeSearchText(value ?? "");

  if (!text) {
    return undefined;
  }

  if (containsAlias(text, "today") || containsAlias(text, "yesterday") || containsAlias(text, "just posted")) {
    return containsAlias(text, "yesterday")
      ? addDays(fetchedAt, -1).toISOString()
      : fetchedAt.toISOString();
  }

  const match = text.match(/posted\s+(\d+)\+?\s+(day|week|month)s?\s+ago/);

  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const days = unit === "month" ? amount * 30 : unit === "week" ? amount * 7 : amount;

  return addDays(fetchedAt, -days).toISOString();
}

function normalizeIdPart(value: string) {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
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

  if (allowLegacyUrl && provider !== "workday" && process.env.JOB_API_URL) {
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

  if (jobProvider === "ashby") {
    return "https://api.ashbyhq.com/posting-api/job-board";
  }

  if (jobProvider === "amazon") {
    return "https://www.amazon.jobs/en/search.json";
  }

  if (jobProvider === "workday") {
    return "https://accenture.wd103.myworkdayjobs.com/wday/cxs/accenture/AccentureCareers/jobs";
  }

  if (jobProvider === "jibe") {
    return "https://careers.mheducation.com/api/jobs";
  }

  if (jobProvider === "activate") {
    return "https://jobs.cardinalhealth.com/search/searchresultslist";
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

  if (jobProvider === "ashby") {
    return {
      name: "Ashby",
      url
    };
  }

  if (jobProvider === "amazon") {
    return {
      name: "Amazon Jobs",
      url
    };
  }

  if (jobProvider === "workday") {
    return {
      name: "Workday",
      url
    };
  }

  if (jobProvider === "jibe") {
    return {
      name: "Jibe",
      url
    };
  }

  if (jobProvider === "activate") {
    return {
      name: "Activate",
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

function buildAshbyBoardUrl(baseUrl: string, board: string) {
  if (baseUrl.includes("{board}")) {
    return baseUrl.replace("{board}", encodeURIComponent(board));
  }

  return `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(board)}`;
}

function buildAmazonSearchUrl(baseUrl: string, query: string) {
  const url = new URL(baseUrl);
  const location = process.env.JOB_AMAZON_LOCATION;

  url.searchParams.set("base_query", query);
  url.searchParams.set("offset", "0");
  url.searchParams.set("result_limit", process.env.JOB_AMAZON_RESULT_LIMIT ?? "25");

  if (location) {
    url.searchParams.set("loc_query", location);
  }

  return url.toString();
}

function getAmazonTeamLabel(value: AmazonJob["team"]) {
  return typeof value === "string" ? value : value?.label;
}

function buildAmazonJobUrl(jobPath: string | undefined) {
  if (!jobPath) {
    return undefined;
  }

  try {
    return new URL(jobPath, "https://www.amazon.jobs").toString();
  } catch {
    return undefined;
  }
}

function getActivateSites(defaultUrl: string) {
  const configured = process.env.JOB_ACTIVATE_SITES;

  if (!configured) {
    return defaultActivateSites.map((site) => ({
      ...site,
      url: site.url || defaultUrl
    }));
  }

  return configured
    .split(";;")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, url, queries] = entry.split("|");

      if (!name || !url || !queries) {
        throw new Error(`Invalid JOB_ACTIVATE_SITES entry: ${entry}`);
      }

      return {
        name: cleanText(name),
        url: cleanText(url),
        queries: queries.split(";").map(cleanText).filter(Boolean)
      };
    });
}

function getJibeSites(defaultUrl: string) {
  const configured = process.env.JOB_JIBE_SITES;

  if (!configured) {
    return defaultJibeSites.map((site) => ({
      ...site,
      url: site.url || defaultUrl
    }));
  }

  return configured
    .split(";;")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, url, queries] = entry.split("|");

      if (!name || !url || !queries) {
        throw new Error(`Invalid JOB_JIBE_SITES entry: ${entry}`);
      }

      return {
        name: cleanText(name),
        url: cleanText(url),
        queries: queries.split(";").map(cleanText).filter(Boolean)
      };
    });
}

function getWorkdaySites(defaultUrl: string) {
  const configured = process.env.JOB_WORKDAY_SITES;

  if (!configured) {
    return defaultWorkdaySites.map((site) => ({
      ...site,
      url: site.url || defaultUrl
    }));
  }

  return configured
    .split(";;")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, url, queries] = entry.split("|");

      if (!name || !url || !queries) {
        throw new Error(`Invalid JOB_WORKDAY_SITES entry: ${entry}`);
      }

      return {
        name: cleanText(name),
        url: cleanText(url),
        queries: queries.split(";").map(cleanText).filter(Boolean)
      };
    });
}

function buildActivateSearchUrl(siteUrl: string, query: string) {
  const url = new URL(siteUrl);
  url.searchParams.set("Keyword", query);
  return url.toString();
}

function buildJibeSearchUrl(siteUrl: string, query: string) {
  const url = new URL(siteUrl);
  url.searchParams.set("keywords", query);
  return url.toString();
}

function buildJibeJobUrl(siteUrl: string, slug: string | undefined) {
  if (!slug) {
    return undefined;
  }

  try {
    return new URL(`/jobs/${encodeURIComponent(slug)}`, new URL(siteUrl).origin).toString();
  } catch {
    return undefined;
  }
}

function buildWorkdayJobUrl(siteUrl: string, externalPath: string | undefined) {
  if (!externalPath) {
    return undefined;
  }

  try {
    const url = new URL(siteUrl);
    const [, sitePath] = url.pathname.match(/\/wday\/cxs\/[^/]+\/([^/]+)\/jobs/) ?? [];
    const visibleSitePath = sitePath ? `/${sitePath}` : "";
    return new URL(`${visibleSitePath}${externalPath}`, url.origin).toString();
  } catch {
    return undefined;
  }
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

function parseActivateJobs(html: string, siteUrl: string) {
  const itemPattern = new RegExp(String.raw`<li class="job-item[^"]*"[^>]*>[\s\S]*?<\/li>`, "gi");
  const titlePattern = new RegExp(String.raw`<h3[^>]*>([\s\S]*?)<\/h3>`, "i");
  const locationPattern = new RegExp(
    String.raw`<div class="job-detail (?:city-state|country)-column">[\s\S]*?<dd>([\s\S]*?)<\/dd>`,
    "gi"
  );
  const items = [...html.matchAll(itemPattern)].map((match) => match[0]);

  return items
    .map((item) => {
      const id = cleanText(item.match(/data-record-key="([^"]+)"/i)?.[1]);
      const title = stripHtml(item.match(titlePattern)?.[1] ?? "");
      const href = item.match(/<a[^>]+href="([^"]+)"[^>]*class="view-details-link"/i)?.[1];
      const locationParts = [...item.matchAll(locationPattern)]
        .map((match) => stripHtml(match[1]))
        .filter(Boolean);
      const sourceJobUrl = href ? new URL(href, new URL(siteUrl).origin).toString() : undefined;

      return {
        id,
        title,
        location: locationParts.join(", "),
        sourceJobUrl,
        summary: stripHtml(item)
      } satisfies ActivateJob;
    })
    .filter(isActivateJob);
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
    anthropic: "Anthropic",
    automox: "Automox",
    brightonjones: "Brighton Jones",
    commvault: "Commvault",
    doordashusa: "DoorDash",
    jamf: "Jamf",
    kaseya: "Kaseya",
    jumpcloud: "JumpCloud",
    kymeratherapeutics: "Kymera Therapeutics",
    okta: "Okta",
    sonyinteractiveentertainmentglobal: "PlayStation",
    tanium: "Tanium",
    verkada: "Verkada"
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
