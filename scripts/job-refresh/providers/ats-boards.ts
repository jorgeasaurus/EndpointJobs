import type { Job } from "../../../src/types/job";
import type { ProviderAdapter } from "../provider";
import {
  addDays,
  cleanText,
  cleanUrl,
  deriveMatchReasons,
  derivePlatforms,
  deriveTools,
  getCsvConfig,
  getString,
  inferEmploymentType,
  inferRoleFamily,
  inferSeniority,
  inferWorkplace,
  isEndpointRelevant,
  normalizeEmploymentTypeLabel,
  normalizeSearchText,
  normalizeDescription,
  normalizeTags,
  stripHtml,
  summarize
} from "../shared";

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

type WorkableLocation = {
  city?: string;
  region?: string;
  country?: string;
  workplace?: string;
};

type WorkableJob = {
  id?: string | number;
  shortcode?: string;
  title?: string;
  location?: WorkableLocation;
  department?: string | string[];
  type?: string;
  employment_type?: string;
  published?: string;
  published_on?: string;
  remote?: boolean;
  workplace?: string;
  description?: string;
  requirements?: string;
  benefits?: string;
  url?: string;
};

type WorkableAccount = {
  name: string;
  slug: string;
};

const staleDays = Number(process.env.JOB_STALE_DAYS ?? 45);

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
  "kymeratherapeutics",
  "databricks",
  "zscaler",
  "samsara",
  "scaleai",
  "wizinc",
  "stripe",
  "spacex",
  "robinhood",
  "boxinc",
  "datadog",
  "elastic",
  "lyft",
  "instacart",
  "andurilindustries",
  "asana",
  "mongodb",
  "brex",
  "figma",
  "airbnb",
  "discord",
  "reddit",
  "rubrik",
  "dropbox",
  "affirm",
  "duolingo",
  "gitlab",
  "coinbase",
  "canonical",
  "pinterest",
  "block",
  "roblox",
  "huntress",
  "keepersecurity",
  "truveta",
  "intercom",
  "amplitude",
  "ubiquiti"
];

const defaultLeverCompanies = ["jumpcloud", "brightonjones", "hermeus", "omnidian", "whoop"];

const defaultAshbyBoards = [
  "1password",
  "docker",
  "cursor",
  "perplexity",
  "openai",
  "cohere",
  "elevenlabs",
  "watershed",
  "suno",
  "voleon"
];

const defaultWorkableAccounts: WorkableAccount[] = [];

export const atsBoardProviders = [
  {
    id: "greenhouse",
    displayName: "Greenhouse",
    defaultUrl: "https://boards-api.greenhouse.io/v1/boards",
    fetchJobs: ({ url, fetchedAt }) => fetchGreenhouseJobs(url, fetchedAt)
  },
  {
    id: "lever",
    displayName: "Lever",
    defaultUrl: "https://api.lever.co/v0/postings",
    fetchJobs: ({ url, fetchedAt }) => fetchLeverJobs(url, fetchedAt)
  },
  {
    id: "ashby",
    displayName: "Ashby",
    defaultUrl: "https://api.ashbyhq.com/posting-api/job-board",
    fetchJobs: ({ url, fetchedAt }) => fetchAshbyJobs(url, fetchedAt)
  },
  {
    id: "workable",
    displayName: "Workable",
    defaultUrl: "https://apply.workable.com/api/v3/accounts",
    fetchJobs: ({ url, fetchedAt }) => fetchWorkableJobs(url, fetchedAt)
  }
] as const satisfies readonly ProviderAdapter[];

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

async function fetchWorkableJobs(url: string, fetchedAt: Date) {
  const accounts = getWorkableAccounts();
  const jobs: Array<Job | null> = [];
  let successfulAccounts = 0;

  if (accounts.length === 0) {
    throw new Error("JOB_WORKABLE_ACCOUNTS is required for the Workable provider");
  }

  for (const account of accounts) {
    try {
      const payload = await fetchWorkableAccount(url, account.slug);
      successfulAccounts += 1;
      jobs.push(...payload.map((job) => normalizeWorkableJob(job, account, fetchedAt)));
      console.log(`Fetched ${payload.length} raw jobs from Workable/${account.slug}`);
    } catch (error) {
      console.warn(
        `Skipping Workable/${account.slug}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (successfulAccounts === 0) {
    throw new Error("No Workable accounts returned jobs");
  }

  return jobs;
}

async function fetchWorkableAccount(baseUrl: string, slug: string) {
  const jobs: WorkableJob[] = [];
  const maxPages = Math.max(1, Number(process.env.JOB_WORKABLE_MAX_PAGES ?? 3));
  let token: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const payload = await fetchWorkableListPage(buildWorkableListUrl(baseUrl, slug), slug, token);
    const results = getWorkableResults(payload);
    jobs.push(...results);

    token = getString((payload as { nextPage?: unknown }).nextPage)
      ?? getString((payload as { paging?: { next?: unknown } }).paging?.next);

    if (!token) {
      break;
    }
  }

  if (process.env.JOB_WORKABLE_FETCH_DETAILS === "false") {
    return jobs;
  }

  const detailedJobs: WorkableJob[] = [];

  for (const job of jobs) {
    const shortcode = cleanText(job.shortcode ?? String(job.id ?? ""));

    if (!shortcode) {
      detailedJobs.push(job);
      continue;
    }

    try {
      const detail = await fetchWorkableDetail(slug, shortcode);
      detailedJobs.push({ ...job, ...detail });
    } catch (error) {
      console.warn(
        `Skipping Workable/${slug}/${shortcode} detail: ${error instanceof Error ? error.message : String(error)}`
      );
      detailedJobs.push(job);
    }
  }

  return detailedJobs;
}

async function fetchWorkableListPage(url: string, slug: string, token?: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    },
    body: JSON.stringify(token ? { token } : {})
  });

  if (!response.ok) {
    throw new Error(`Workable ${slug} request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object") {
    throw new Error(`Workable ${slug} response was not an object`);
  }

  return json;
}

async function fetchWorkableDetail(slug: string, shortcode: string) {
  const response = await fetch(buildWorkableDetailUrl(slug, shortcode), {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Workable detail request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!isWorkableJob(json)) {
    throw new Error("Workable detail response was not a job object");
  }

  return json;
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
    description: normalizeDescription(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack, title),
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
    description: normalizeDescription(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack, title),
    employmentType: cleanText(raw.categories?.commitment) || inferEmploymentType(haystack)
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
    description: normalizeDescription(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack, title),
    employmentType: cleanText(raw.employmentType) || inferEmploymentType(haystack)
  };
}

function normalizeWorkableJob(raw: WorkableJob, account: WorkableAccount, fetchedAt: Date): Job | null {
  const title = cleanText(raw.title);
  const company = account.name;
  const shortcode = cleanText(raw.shortcode ?? String(raw.id ?? ""));
  const sourceJobUrl = cleanUrl(raw.url) ?? buildWorkableJobUrl(account.slug, shortcode);

  if (!title || !company || !shortcode || !sourceJobUrl) {
    return null;
  }

  const locationParts = [raw.location?.city, raw.location?.region, raw.location?.country]
    .map(cleanText)
    .filter(Boolean);
  const location = locationParts.join(", ");
  const description = stripHtml([raw.description, raw.requirements, raw.benefits].join(" "));
  const department = Array.isArray(raw.department) ? raw.department.join("; ") : raw.department;
  const employmentType = normalizeWorkableEmploymentType(raw.type ?? raw.employment_type);
  const sourceTags = [department, employmentType, raw.workplace, raw.location?.workplace]
    .map(cleanText)
    .filter(Boolean);
  const haystack = normalizeSearchText([title, company, location, sourceTags.join(" "), description].join(" "));
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const published = raw.published ?? raw.published_on;
  const postedAt = published && !Number.isNaN(new Date(published).getTime())
    ? new Date(published).toISOString()
    : fetchedAt.toISOString();
  const staleAfter = addDays(new Date(postedAt), staleDays).toISOString();
  const workplace = raw.remote
    ? "Remote"
    : inferWorkplace(location, `${haystack} ${raw.workplace ?? ""} ${raw.location?.workplace ?? ""}`);

  return {
    id: `workable-${account.slug}-${shortcode}`,
    title,
    company,
    location: location || "Unknown",
    workplace,
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Workable",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: `Workable / ${company}`,
    termsProfile: "public-api",
    summary: summarize(description),
    description: normalizeDescription(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack, title),
    employmentType: employmentType || inferEmploymentType(haystack)
  };
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

function buildAshbyBoardUrl(baseUrl: string, board: string) {
  if (baseUrl.includes("{board}")) {
    return baseUrl.replace("{board}", encodeURIComponent(board));
  }

  return `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(board)}`;
}

function getWorkableAccounts() {
  const configured = process.env.JOB_WORKABLE_ACCOUNTS;

  if (!configured) {
    return defaultWorkableAccounts;
  }

  return configured
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseWorkableAccountEntry(entry));
}

function parseWorkableAccountEntry(entry: string): WorkableAccount {
  const separatorIndex = entry.indexOf("|");
  const namePart = separatorIndex === -1 ? undefined : cleanText(entry.slice(0, separatorIndex));
  const slug = cleanText(separatorIndex === -1 ? entry : entry.slice(separatorIndex + 1)).toLowerCase();

  if (!slug || (separatorIndex !== -1 && !namePart)) {
    throw new Error(`Invalid JOB_WORKABLE_ACCOUNTS entry: ${entry}`);
  }

  return {
    name: namePart ?? formatSourceAccountName(slug),
    slug
  };
}

function buildWorkableListUrl(baseUrl: string, slug: string) {
  return baseUrl.includes("{account}")
    ? baseUrl.replace("{account}", encodeURIComponent(slug))
    : `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(slug)}/jobs`;
}

function buildWorkableDetailUrl(slug: string, shortcode: string) {
  const detailBaseUrl = process.env.JOB_WORKABLE_DETAIL_API_URL
    ?? "https://apply.workable.com/api/v1/accounts";
  return `${detailBaseUrl.replace(/\/+$/, "")}/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(shortcode)}`;
}

function buildWorkableJobUrl(slug: string, shortcode: string) {
  if (!shortcode) {
    return undefined;
  }

  return `https://apply.workable.com/${encodeURIComponent(slug)}/j/${encodeURIComponent(shortcode)}/`;
}

function normalizeWorkableEmploymentType(value: string | undefined) {
  return normalizeEmploymentTypeLabel(value);
}

function getWorkableResults(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidate = payload as { results?: unknown; jobs?: unknown };
  const values = Array.isArray(candidate.results)
    ? candidate.results
    : Array.isArray(candidate.jobs)
      ? candidate.jobs
      : [];

  return values.filter(isWorkableJob);
}

function formatSourceAccountName(slug: string) {
  const knownNames: Record<string, string> = {
    andurilindustries: "Anduril",
    anthropic: "Anthropic",
    automox: "Automox",
    boxinc: "Box",
    brightonjones: "Brighton Jones",
    cohere: "Cohere",
    commvault: "Commvault",
    cursor: "Cursor",
    databricks: "Databricks",
    datadog: "Datadog",
    doordashusa: "DoorDash",
    elastic: "Elastic",
    elevenlabs: "ElevenLabs",
    instacart: "Instacart",
    jamf: "Jamf",
    kaseya: "Kaseya",
    keepersecurity: "Keeper Security",
    jumpcloud: "JumpCloud",
    kymeratherapeutics: "Kymera Therapeutics",
    lyft: "Lyft",
    mongodb: "MongoDB",
    okta: "Okta",
    openai: "OpenAI",
    perplexity: "Perplexity",
    robinhood: "Robinhood",
    samsara: "Samsara",
    scaleai: "Scale AI",
    sonyinteractiveentertainmentglobal: "PlayStation",
    stripe: "Stripe",
    tanium: "Tanium",
    verkada: "Verkada",
    watershed: "Watershed",
    wizinc: "Wiz",
    zscaler: "Zscaler"
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

function isAshbyJob(value: unknown): value is AshbyJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as AshbyJob;
  return Boolean(candidate.id && candidate.title && candidate.jobUrl);
}

function isWorkableJob(value: unknown): value is WorkableJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as WorkableJob;
  return Boolean((candidate.shortcode || candidate.id) && candidate.title);
}
