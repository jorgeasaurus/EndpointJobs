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
  inferEmploymentType,
  inferRoleFamily,
  inferSeniority,
  inferWorkplace,
  isEndpointRelevant,
  normalizeSalary,
  normalizeSearchText,
  normalizeDescription,
  normalizeTags,
  stripHtml,
  summarize
} from "../shared";

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

const staleDays = Number(process.env.JOB_STALE_DAYS ?? 45);

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

export const publicJobBoardProviders = [
  {
    id: "remoteok",
    displayName: "Remote OK",
    defaultUrl: "https://remoteok.com/api",
    fetchJobs: async ({ url, fetchedAt }) => {
      const payload = await fetchRemoteOk(url);
      return payload.map((job) => normalizeRemoteOkJob(job, fetchedAt));
    }
  },
  {
    id: "remotive",
    displayName: "Remotive",
    defaultUrl: "https://remotive.com/api/remote-jobs",
    fetchJobs: async ({ url, fetchedAt }) => {
      const payload = await fetchRemotive(url);
      return payload.map((job) => normalizeRemotiveJob(job, fetchedAt));
    }
  },
  {
    id: "arbeitnow",
    displayName: "Arbeitnow",
    defaultUrl: "https://www.arbeitnow.com/api/job-board-api",
    fetchJobs: async ({ url, fetchedAt }) => {
      const payload = await fetchArbeitnow(url);
      return payload.map((job) => normalizeArbeitnowJob(job, fetchedAt));
    }
  },
  {
    id: "jobicy",
    displayName: "Jobicy",
    defaultUrl: "https://jobicy.com/api/v2/remote-jobs?count=50&industry=engineering",
    fetchJobs: async ({ url, fetchedAt }) => {
      const payload = await fetchJobicy(url);
      return payload.map((job) => normalizeJobicyJob(job, fetchedAt));
    }
  },
  {
    id: "muse",
    displayName: "The Muse",
    defaultUrl: "https://www.themuse.com/api/public/jobs?category=Computer%20and%20IT&page={page}",
    fetchJobs: ({ url, fetchedAt }) => fetchMuseJobs(url, fetchedAt)
  },
  {
    id: "adzuna",
    displayName: "Adzuna",
    defaultUrl: "https://api.adzuna.com/v1/api/jobs/{country}/search/{page}",
    fetchJobs: ({ url, fetchedAt }) => fetchAdzunaJobs(url, fetchedAt)
  }
] as const satisfies readonly ProviderAdapter[];

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
    description: normalizeDescription(description),
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
    description: normalizeDescription(description),
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
    description: normalizeDescription(description),
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
    description: normalizeDescription(description),
    tags: normalizeTags([...industry, ...jobType], tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: jobType[0] || inferEmploymentType(haystack)
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
    description: normalizeDescription(description),
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
    description: normalizeDescription(description),
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

function normalizeRemotiveJobType(value: string | undefined) {
  const jobType = normalizeSearchText(value ?? "");

  if (jobType.includes("contract")) return "Contract";
  if (jobType.includes("part")) return "Part-time";
  if (jobType.includes("freelance")) return "Freelance";
  if (jobType.includes("intern")) return "Internship";
  return "Full-time";
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
