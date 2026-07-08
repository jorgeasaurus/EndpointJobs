import type { Job, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
  extractSalaryFromText,
  formatSlugLabel,
  getCsvConfig,
  normalizeFirstEmploymentType,
  normalizeSalary,
  normalizeSearchText,
  parseDateLike,
  summarize,
  toEndpointJob
} from "../shared";

type ApiText = string | number | Array<string | number>;

const rapidApiLinkedInFields = {
  title: ["title", "job_title", "jobTitle", "name"],
  company: ["company", "company_name", "companyName", "organization"],
  url: [
    "url",
    "job_url",
    "jobUrl",
    "linkedin_url",
    "linkedinUrl",
    "apply_url",
    "applyUrl"
  ],
  description: [
    "description",
    "job_description",
    "jobDescription",
    "summary",
    "snippet"
  ],
  location: [
    "location",
    "job_location",
    "jobLocation",
    "formatted_location",
    "formattedLocation"
  ],
  employmentType: ["employment_type", "employmentType", "job_type", "jobType"],
  seniority: ["seniority", "seniority_level", "seniorityLevel"],
  workplaceType: ["workplace_type", "workplaceType"],
  source: ["source"],
  postedAt: [
    "posted_at",
    "postedAt",
    "date_posted",
    "datePosted",
    "listed_at",
    "listedAt",
    "published_at",
    "publishedAt",
    "created_at",
    "createdAt",
    "indexed_at",
    "indexedAt"
  ],
  salaryMin: ["salary_min", "salaryMin", "min_salary", "minSalary"],
  salaryMax: ["salary_max", "salaryMax", "max_salary", "maxSalary"],
  currency: ["salary_currency", "salaryCurrency", "currency"]
} as const;

type RapidApiLinkedInField =
  (typeof rapidApiLinkedInFields)[keyof typeof rapidApiLinkedInFields][number];

type RapidApiLinkedInJob = Partial<Record<RapidApiLinkedInField, ApiText>> & {
  remote?: boolean | string;
  is_remote?: boolean | string;
  isRemote?: boolean | string;
};

type RapidApiLinkedInEnvelope = {
  jobs?: unknown;
  data?: unknown;
  result?: unknown;
  results?: unknown;
  items?: unknown;
  elements?: unknown;
};

const defaultTitleFilters = [
  "Endpoint Engineer",
  "Intune Engineer",
  "macOS Engineer",
  "Client Platform Engineer",
  "Desktop Engineer",
  "PowerShell Systems Administrator",
  "PowerShell Sysadmin",
  "Digital Workplace Engineer"
];

const jobArrayKeys = [
  "jobs",
  "data",
  "result",
  "results",
  "items",
  "elements"
] as const;

const nestedEnvelopeKeys = ["data", "result", "results"] as const;

export const rapidApiLinkedInProvider: ProviderAdapter<"rapidapilinkedin"> = {
  id: "rapidapilinkedin",
  displayName: "RapidAPI LinkedIn Job Search",
  defaultUrl: "https://linkedin-job-search-api.p.rapidapi.com/active-jb-24h",
  fetchJobs: ({ url, fetchedAt }) => fetchRapidApiLinkedInJobs(url, fetchedAt)
};

async function fetchRapidApiLinkedInJobs(url: string, fetchedAt: Date) {
  const apiKey = process.env.RAPIDAPI_LINKEDIN_JOBS_KEY
    ?? process.env.JOB_RAPIDAPI_LINKEDIN_JOBS_KEY
    ?? process.env.RAPIDAPI_KEY;

  if (!apiKey) {
    throw new Error("RAPIDAPI_LINKEDIN_JOBS_KEY is required");
  }

  const titleFilters = getCsvConfig(
    "JOB_RAPIDAPI_LINKEDIN_TITLE_FILTERS",
    defaultTitleFilters
  );
  const maxPages = Math.max(
    1,
    Number(process.env.JOB_RAPIDAPI_LINKEDIN_MAX_PAGES ?? 1)
  );
  const limit = Math.max(
    1,
    Number(process.env.JOB_RAPIDAPI_LINKEDIN_LIMIT ?? 25)
  );
  const jobs: Array<Job | null> = [];

  for (const titleFilter of titleFilters) {
    for (let page = 0; page < maxPages; page += 1) {
      const queryUrl = buildRapidApiLinkedInUrl(url, titleFilter, limit, page);
      const rawJobs = await fetchRapidApiLinkedInPage(queryUrl, apiKey);
      const normalized = rawJobs.map((job) =>
        normalizeRapidApiLinkedInJob(job, titleFilter, fetchedAt)
      );

      jobs.push(...normalized);
      console.log(
        `Fetched ${rawJobs.length} raw jobs from RapidAPI LinkedIn ${titleFilter} page ${page + 1}`
      );

      if (rawJobs.length < limit) {
        break;
      }
    }
  }

  return jobs;
}

function buildRapidApiLinkedInUrl(
  baseUrl: string,
  titleFilter: string,
  limit: number,
  page: number
) {
  const url = new URL(baseUrl);
  const locationFilter = process.env.JOB_RAPIDAPI_LINKEDIN_LOCATION_FILTER
    ?? "\"United States\" OR \"Remote\"";

  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(page * limit));
  url.searchParams.set("title_filter", quoteFilter(titleFilter));
  url.searchParams.set("location_filter", locationFilter);
  url.searchParams.set(
    "description_type",
    process.env.JOB_RAPIDAPI_LINKEDIN_DESCRIPTION_TYPE ?? "text"
  );

  return url.toString();
}

async function fetchRapidApiLinkedInPage(url: string, apiKey: string) {
  const host = process.env.JOB_RAPIDAPI_LINKEDIN_HOST
    ?? "linkedin-job-search-api.p.rapidapi.com";
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/jorgeasaurus/EndpointJobs)",
      "x-rapidapi-host": host,
      "x-rapidapi-key": apiKey
    }
  });

  if (!response.ok) {
    const detail = summarize(cleanText(await response.text()));
    throw new Error(
      `RapidAPI LinkedIn request failed: ${response.status} ${response.statusText}${
        detail ? ` - ${detail}` : ""
      }`
    );
  }

  return extractRapidApiLinkedInJobs(await response.json());
}

function extractRapidApiLinkedInJobs(payload: unknown): RapidApiLinkedInJob[] {
  const topLevelJobs = getJobArray(payload);

  if (topLevelJobs) {
    return topLevelJobs;
  }

  const envelope = asEnvelope(payload);

  if (!envelope) {
    throw new Error("RapidAPI LinkedIn response was not an object or array");
  }

  for (const key of jobArrayKeys) {
    const jobs = getJobArray(envelope[key]);

    if (jobs) {
      return jobs;
    }
  }

  for (const key of nestedEnvelopeKeys) {
    const nested = asEnvelope(envelope[key]);

    if (!nested) {
      continue;
    }

    for (const nestedKey of jobArrayKeys) {
      const jobs = getJobArray(nested[nestedKey]);

      if (jobs) {
        return jobs;
      }
    }
  }

  throw new Error("RapidAPI LinkedIn response did not include a jobs array");
}

function asEnvelope(value: unknown): RapidApiLinkedInEnvelope | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as RapidApiLinkedInEnvelope;
}

function getJobArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter(isRapidApiLinkedInJob);
}

function isRapidApiLinkedInJob(value: unknown): value is RapidApiLinkedInJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const job = value as RapidApiLinkedInJob;

  return Boolean(
    getRapidApiLinkedInTitle(job) &&
      getRapidApiLinkedInCompany(job) &&
      getRapidApiLinkedInUrl(job)
  );
}

function normalizeRapidApiLinkedInJob(
  raw: RapidApiLinkedInJob,
  titleFilter: string,
  fetchedAt: Date
) {
  const title = cleanText(getRapidApiLinkedInTitle(raw));
  const company = cleanText(getRapidApiLinkedInCompany(raw));
  const sourceJobUrl = getRapidApiLinkedInUrl(raw);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const description = cleanText(
    firstFieldText(raw, rapidApiLinkedInFields.description)
  );
  const location = cleanText(
    firstFieldText(raw, rapidApiLinkedInFields.location)
  );
  const employmentType = firstFieldText(raw, rapidApiLinkedInFields.employmentType);
  const workplaceType = firstFieldText(raw, rapidApiLinkedInFields.workplaceType);
  const sourceTags = [
    titleFilter,
    employmentType,
    firstFieldText(raw, rapidApiLinkedInFields.seniority),
    workplaceType,
    firstFieldText(raw, rapidApiLinkedInFields.source)
  ].map(formatSlugLabel).filter(Boolean);

  return toEndpointJob({
    id: buildStableJobId("rapidapi-linkedin", company, title, sourceJobUrl),
    title,
    company,
    location,
    workplace: inferRapidApiLinkedInWorkplace(raw, location, description),
    postedAt: getRapidApiLinkedInPostedAt(raw) ?? fetchedAt.toISOString(),
    fetchedAt,
    source: "RapidAPI LinkedIn Job Search",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: "LinkedIn Job Search via RapidAPI",
    termsProfile: "partner-terms",
    description,
    sourceTags,
    haystackParts: [titleFilter, workplaceType],
    salary: getRapidApiLinkedInSalary(raw, description),
    employmentType: normalizeFirstEmploymentType([employmentType])
  });
}

function getRapidApiLinkedInTitle(raw: RapidApiLinkedInJob) {
  return firstFieldText(raw, rapidApiLinkedInFields.title);
}

function getRapidApiLinkedInCompany(raw: RapidApiLinkedInJob) {
  return firstFieldText(raw, rapidApiLinkedInFields.company);
}

function getRapidApiLinkedInUrl(raw: RapidApiLinkedInJob) {
  return cleanUrl(firstFieldText(raw, rapidApiLinkedInFields.url));
}

function getRapidApiLinkedInPostedAt(raw: RapidApiLinkedInJob) {
  for (const field of rapidApiLinkedInFields.postedAt) {
    const date = parseDateLike(firstText(raw[field]));

    if (date) {
      return date;
    }
  }

  return undefined;
}

function inferRapidApiLinkedInWorkplace(
  raw: RapidApiLinkedInJob,
  location: string,
  description: string
): Workplace | undefined {
  const isRemote = raw.remote ?? raw.is_remote ?? raw.isRemote;

  if (isRemote === true || isRemote === "true") return "Remote";
  if (isRemote === false || isRemote === "false") return undefined;

  const text = normalizeSearchText([
    location,
    description,
    firstFieldText(raw, rapidApiLinkedInFields.workplaceType)
  ].join(" "));

  if (text.includes("remote")) return "Remote";
  if (text.includes("hybrid")) return "Hybrid";
  if (text.includes("on-site") || text.includes("onsite")) return "On-site";
  return undefined;
}

function getRapidApiLinkedInSalary(
  raw: RapidApiLinkedInJob,
  description: string
) {
  const min = firstFieldNumber(raw, rapidApiLinkedInFields.salaryMin);
  const max = firstFieldNumber(raw, rapidApiLinkedInFields.salaryMax);
  const salary = normalizeSalary(min, max) ?? extractSalaryFromText(description);
  const currency = cleanText(
    firstFieldText(raw, rapidApiLinkedInFields.currency)
  );

  if (!salary || !currency || salary.currency === currency) {
    return salary;
  }

  return { ...salary, currency };
}

function firstFieldText(
  raw: RapidApiLinkedInJob,
  fields: readonly RapidApiLinkedInField[]
) {
  return firstText(...fields.map((field) => raw[field]));
}

function firstFieldNumber(
  raw: RapidApiLinkedInJob,
  fields: readonly RapidApiLinkedInField[]
) {
  return firstNumber(...fields.map((field) => raw[field]));
}

function firstText(...values: Array<ApiText | undefined>) {
  for (const value of values) {
    const candidates = Array.isArray(value) ? value : [value];
    const match = candidates.find((candidate) =>
      typeof candidate === "string"
        ? candidate.trim()
        : typeof candidate === "number" && Number.isFinite(candidate)
    );

    if (match !== undefined) {
      return String(match);
    }
  }

  return undefined;
}

function firstNumber(...values: Array<ApiText | undefined>) {
  for (const value of values) {
    const text = firstText(value);

    if (!text) {
      continue;
    }

    const normalized = text.replace(/[$,]/g, "").trim();
    const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)(k)?$/i);

    if (!match) {
      continue;
    }

    const amount = Number(match[1]);

    if (Number.isFinite(amount)) {
      return match[2] ? amount * 1000 : amount;
    }
  }

  return undefined;
}

function quoteFilter(value: string) {
  const trimmed = cleanText(value);

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed;
  }

  return `"${trimmed}"`;
}
