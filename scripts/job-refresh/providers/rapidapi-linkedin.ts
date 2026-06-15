import type { Job, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
  formatSlugLabel,
  getCsvConfig,
  normalizeFirstEmploymentType,
  normalizeSalary,
  normalizeSearchText,
  parseDateLike,
  summarize,
  toArray,
  toEndpointJob
} from "../shared";

type RapidApiLinkedInJob = Record<string, unknown>;

const defaultTitleFilters = [
  "Endpoint Engineer",
  "Intune Engineer",
  "macOS Engineer",
  "Client Platform Engineer",
  "Desktop Engineer",
  "Digital Workplace Engineer"
];

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
      jobs.push(...rawJobs.map((job) => normalizeRapidApiLinkedInJob(job, titleFilter, fetchedAt)));
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
  const candidate = findFirstArray(payload);

  return candidate.filter(isRapidApiLinkedInJob);
}

function findFirstArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const direct = ["jobs", "data", "result", "results", "items", "elements"]
    .map((key) => record[key])
    .find(Array.isArray);

  if (direct) {
    return direct;
  }

  for (const key of ["data", "result", "results"]) {
    const nested = findFirstArray(record[key]);

    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

function isRapidApiLinkedInJob(value: unknown): value is RapidApiLinkedInJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const job = value as RapidApiLinkedInJob;

  return Boolean(
    getString(job, "title", "job_title", "jobTitle", "name") &&
      getString(job, "company", "company_name", "companyName", "organization") &&
      getRapidApiLinkedInUrl(job)
  );
}

function normalizeRapidApiLinkedInJob(
  raw: RapidApiLinkedInJob,
  titleFilter: string,
  fetchedAt: Date
) {
  const title = cleanText(getString(raw, "title", "job_title", "jobTitle", "name"));
  const company = cleanText(getString(raw, "company", "company_name", "companyName", "organization"));
  const sourceJobUrl = getRapidApiLinkedInUrl(raw);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const description = cleanText(
    getString(raw, "description", "job_description", "jobDescription", "summary", "snippet")
  );
  const location = cleanText(
    getString(raw, "location", "job_location", "jobLocation", "formatted_location", "formattedLocation")
  );
  const sourceTags = [
    titleFilter,
    getString(raw, "employment_type", "employmentType", "job_type", "jobType"),
    getString(raw, "seniority", "seniority_level", "seniorityLevel"),
    getString(raw, "workplace_type", "workplaceType"),
    getString(raw, "source")
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
    haystackParts: [titleFilter, raw],
    salary: getRapidApiLinkedInSalary(raw),
    employmentType: normalizeFirstEmploymentType([
      getString(raw, "employment_type", "employmentType"),
      getString(raw, "job_type", "jobType")
    ].filter(Boolean))
  });
}

function getRapidApiLinkedInUrl(raw: RapidApiLinkedInJob) {
  return cleanUrl(
    getString(
      raw,
      "url",
      "job_url",
      "jobUrl",
      "linkedin_url",
      "linkedinUrl",
      "apply_url",
      "applyUrl"
    )
  );
}

function getRapidApiLinkedInPostedAt(raw: RapidApiLinkedInJob) {
  for (const key of [
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
  ]) {
    const date = parseDateLike(getString(raw, key));

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
    getString(raw, "workplace_type", "workplaceType")
  ].join(" "));

  if (text.includes("remote")) return "Remote";
  if (text.includes("hybrid")) return "Hybrid";
  if (text.includes("on-site") || text.includes("onsite")) return "On-site";
  return undefined;
}

function getRapidApiLinkedInSalary(raw: RapidApiLinkedInJob) {
  const min = getNumber(raw, "salary_min", "salaryMin", "min_salary", "minSalary");
  const max = getNumber(raw, "salary_max", "salaryMax", "max_salary", "maxSalary");
  const salary = normalizeSalary(min, max);
  const currency = cleanText(getString(raw, "salary_currency", "salaryCurrency", "currency"));

  if (!salary || !currency || salary.currency === currency) {
    return salary;
  }

  return { ...salary, currency };
}

function getString(raw: RapidApiLinkedInJob, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    const first = toArray(value).find((item) => typeof item === "string" && item.trim());

    if (typeof first === "string") {
      return first;
    }
  }

  return undefined;
}

function getNumber(raw: RapidApiLinkedInJob, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/[$,]/g, ""));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
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
