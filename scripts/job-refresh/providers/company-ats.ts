import type { Job } from "../../../src/types/job";
import type { ProviderAdapter } from "../provider";
import {
  addDays,
  buildStableJobId,
  cleanText,
  cleanUrl,
  containsAlias,
  deriveMatchReasons,
  derivePlatforms,
  deriveTools,
  getCsvConfig,
  inferEmploymentType,
  inferRoleFamily,
  inferSeniority,
  inferWorkplace,
  isEndpointRelevant,
  normalizeIdPart,
  normalizeSearchText,
  normalizeDescription,
  normalizeTags,
  parseDateLike,
  stripHtml,
  summarize
} from "../shared";

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

const staleDays = Number(process.env.JOB_STALE_DAYS ?? 45);

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

export const companyAtsProviders = [
  {
    id: "amazon",
    displayName: "Amazon Jobs",
    defaultUrl: "https://www.amazon.jobs/en/search.json",
    fetchJobs: ({ url, fetchedAt }) => fetchAmazonJobs(url, fetchedAt)
  },
  {
    id: "workday",
    displayName: "Workday",
    defaultUrl: "https://accenture.wd103.myworkdayjobs.com/wday/cxs/accenture/AccentureCareers/jobs",
    fetchJobs: ({ url, fetchedAt }) => fetchWorkdayJobs(url, fetchedAt)
  },
  {
    id: "jibe",
    displayName: "Jibe",
    defaultUrl: "https://careers.mheducation.com/api/jobs",
    fetchJobs: ({ url, fetchedAt }) => fetchJibeJobs(url, fetchedAt)
  },
  {
    id: "activate",
    displayName: "Activate",
    defaultUrl: "https://jobs.cardinalhealth.com/search/searchresultslist",
    fetchJobs: ({ url, fetchedAt }) => fetchActivateJobs(url, fetchedAt)
  }
] as const satisfies readonly ProviderAdapter[];

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
    description: normalizeDescription(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: cleanText(raw.job_schedule_type) || inferEmploymentType(haystack)
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
    id: buildStableJobId("workday", site.name, title, sourceJobUrl),
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
    description: normalizeDescription(description),
    tags: normalizeTags([query, ...bulletFields], tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: inferEmploymentType(haystack)
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
    description: normalizeDescription(description),
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
    description: normalizeDescription(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack),
    employmentType: cleanText(data.employment_type) || inferEmploymentType(haystack)
  };
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

function buildActivateSearchUrl(siteUrl: string, query: string) {
  const url = new URL(siteUrl);
  url.searchParams.set("Keyword", query);
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

function isAmazonJob(value: unknown): value is AmazonJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as AmazonJob;
  return Boolean(candidate.id && candidate.title && candidate.job_path);
}

function isWorkdayJob(value: unknown): value is WorkdayJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as WorkdayJob;
  return Boolean(candidate.title && candidate.externalPath);
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
