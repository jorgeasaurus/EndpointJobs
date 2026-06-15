import type { Job, Seniority, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import { defaultEndpointSearchQueries, monitoredCompanyNames } from "../search-config";
import {
  cleanText,
  cleanUrl,
  formatSlugLabel,
  getCsvConfig,
  normalizeSalary,
  parseDateLike,
  summarize,
  toEndpointJob
} from "../shared";

type TheirStackLocation = {
  display_name?: string;
  name?: string;
  state?: string;
  state_code?: string;
  country_name?: string;
  country_code?: string;
};

type TheirStackJob = {
  id?: string | number;
  job_title?: string;
  company?: string;
  company_domain?: string;
  company_object?: {
    name?: string;
    domain?: string;
    is_recruiting_agency?: boolean;
    technology_names?: string[];
    technology_slugs?: string[];
  };
  location?: string;
  short_location?: string;
  long_location?: string;
  city?: string;
  state_code?: string;
  country?: string;
  country_code?: string;
  cities?: string[];
  locations?: TheirStackLocation[];
  date_posted?: string;
  date_reposted?: string;
  discovered_at?: string;
  closed_at?: string | null;
  description?: string;
  final_url?: string;
  url?: string;
  source_url?: string;
  remote?: boolean;
  hybrid?: boolean;
  employment_statuses?: string[];
  min_annual_salary?: number;
  max_annual_salary?: number;
  min_annual_salary_usd?: number;
  max_annual_salary_usd?: number;
  salary_currency?: string;
  salary_string?: string;
  seniority?: string;
  keyword_slugs?: string[];
  technology_slugs?: string[];
  matching_phrases?: string[];
  matching_words?: string[];
};

export const theirStackProvider: ProviderAdapter<"theirstack"> = {
  id: "theirstack",
  displayName: "TheirStack",
  defaultUrl: "https://api.theirstack.com/v1/jobs/search",
  fetchJobs: ({ url, fetchedAt }) => fetchTheirStackJobs(url, fetchedAt)
};

async function fetchTheirStackJobs(url: string, fetchedAt: Date) {
  const maxPages = Math.max(1, Number(process.env.JOB_THEIRSTACK_MAX_PAGES ?? 1));
  const jobs: Array<Job | null> = [];

  await fetchTheirStackPages({
    url,
    fetchedAt,
    jobs,
    maxPages,
    label: "role query"
  });

  await fetchTheirStackCompanyPages({
    url,
    fetchedAt,
    jobs,
    maxPages
  });

  return jobs;
}

type TheirStackPageFetchOptions = {
  url: string;
  fetchedAt: Date;
  jobs: Array<Job | null>;
  maxPages: number;
  label: string;
  companyNames?: string[];
};

async function fetchTheirStackPages(options: TheirStackPageFetchOptions) {
  for (let page = 0; page < options.maxPages; page += 1) {
    const payload = await fetchTheirStackSearch(options.url, page, {
      companyNames: options.companyNames
    });
    options.jobs.push(...payload.map((job) => normalizeTheirStackJob(job, options.fetchedAt)));
    console.log(`Fetched ${payload.length} raw jobs from TheirStack ${options.label} page ${page}`);

    if (payload.length === 0) {
      break;
    }
  }
}

async function fetchTheirStackCompanyPages(options: Omit<TheirStackPageFetchOptions, "label" | "companyNames">) {
  const companyNames = getCsvConfig("JOB_THEIRSTACK_COMPANY_NAMES", monitoredCompanyNames);

  if (companyNames.length === 0) {
    return;
  }

  try {
    await fetchTheirStackPages({
      ...options,
      label: "company monitor",
      companyNames
    });
  } catch (error) {
    console.warn(
      `Skipping TheirStack company monitor: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function fetchTheirStackSearch(
  url: string,
  page: number,
  options: { companyNames?: string[] } = {}
) {
  const apiKey = process.env.THEIRSTACK_API_KEY ?? process.env.JOB_THEIRSTACK_API_KEY;

  if (!apiKey) {
    throw new Error("THEIRSTACK_API_KEY is required");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    },
    body: JSON.stringify(buildTheirStackSearchBody(page, options))
  });

  if (!response.ok) {
    const detail = summarize(cleanText(await response.text()));
    throw new Error(
      `TheirStack request failed: ${response.status} ${response.statusText}${
        detail ? ` - ${detail}` : ""
      }`
    );
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { data?: unknown }).data)) {
    throw new Error("TheirStack response did not include a data array");
  }

  return (json as { data: unknown[] }).data.filter(isTheirStackJob);
}

function isTheirStackJob(value: unknown): value is TheirStackJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as TheirStackJob;
  return Boolean(
    candidate.id &&
      candidate.job_title &&
      (candidate.company || candidate.company_object?.name) &&
      (candidate.final_url || candidate.url || candidate.source_url)
  );
}

function normalizeTheirStackJob(raw: TheirStackJob, fetchedAt: Date) {
  const title = cleanText(raw.job_title);
  const company = cleanText(raw.company ?? raw.company_object?.name);
  const sourceJobUrl = cleanUrl(raw.final_url) ?? cleanUrl(raw.url) ?? cleanUrl(raw.source_url);
  const applyUrl = cleanUrl(raw.final_url) ?? sourceJobUrl;

  if (!title || !company || !sourceJobUrl || !applyUrl) {
    return null;
  }

  const closedAt = parseDateLike(raw.closed_at ?? undefined);

  if (closedAt && new Date(closedAt).getTime() <= fetchedAt.getTime()) {
    return null;
  }

  const sourceTags = [
    raw.seniority,
    raw.company_domain,
    raw.company_object?.domain,
    ...(raw.employment_statuses ?? []),
    ...(raw.keyword_slugs ?? []),
    ...(raw.technology_slugs ?? []),
    ...(raw.company_object?.technology_names ?? []),
    ...(raw.company_object?.technology_slugs ?? []),
    ...(raw.matching_phrases ?? []),
    ...(raw.matching_words ?? [])
  ]
    .map(formatSlugLabel)
    .filter(Boolean);
  const postedAt = parseDateLike(raw.date_posted)
    ?? parseDateLike(raw.date_reposted)
    ?? parseDateLike(raw.discovered_at)
    ?? fetchedAt.toISOString();

  return toEndpointJob({
    id: `theirstack-${raw.id}`,
    title,
    company,
    location: getTheirStackLocation(raw),
    workplace: inferTheirStackWorkplace(raw),
    postedAt,
    fetchedAt,
    source: "TheirStack",
    sourceUrl: sourceJobUrl,
    applyUrl,
    attributionLabel: "TheirStack",
    termsProfile: "partner-terms",
    description: raw.description ?? "",
    sourceTags,
    salary: normalizeTheirStackSalary(raw),
    seniority: normalizeTheirStackSeniority(raw.seniority),
    employmentType: normalizeTheirStackEmploymentType(raw.employment_statuses)
  });
}

function buildTheirStackSearchBody(
  page: number,
  options: { companyNames?: string[] } = {}
) {
  const limit = Math.max(1, Number(process.env.JOB_THEIRSTACK_LIMIT ?? 25));
  const maxAgeDays = Number(process.env.JOB_THEIRSTACK_MAX_AGE_DAYS ?? 30);
  const countryCodes = getCsvConfig("JOB_THEIRSTACK_COUNTRY_CODES", ["US"]);
  const titleQueries = getCsvConfig("JOB_THEIRSTACK_TITLE_QUERIES", defaultEndpointSearchQueries);
  const descriptionPatterns = getCsvConfig("JOB_THEIRSTACK_DESCRIPTION_PATTERNS", []);
  const remote = parseOptionalBoolean(process.env.JOB_THEIRSTACK_REMOTE);
  const body: Record<string, unknown> = {
    include_total_results: false,
    job_country_code_or: countryCodes,
    job_title_or: titleQueries,
    limit,
    page,
    posted_at_max_age_days: Number.isFinite(maxAgeDays) ? maxAgeDays : 30,
    property_exists_or: ["final_url", "company_object.domain"]
  };

  if (options.companyNames && options.companyNames.length > 0) {
    body.company_name_or = options.companyNames;
  }

  if (descriptionPatterns.length > 0) {
    body.job_description_pattern_or = descriptionPatterns;
  }

  if (remote !== undefined) {
    body.remote = remote;
  }

  return body;
}

function parseOptionalBoolean(value: string | undefined) {
  if (value === undefined || value === "") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean value: ${value}`);
}

function getTheirStackLocation(raw: TheirStackJob) {
  const direct = cleanText(raw.long_location ?? raw.location ?? raw.short_location);

  if (direct) {
    return direct;
  }

  const structured = (raw.locations ?? [])
    .map((location) => cleanText(location.display_name) || cleanText([
      location.name,
      location.state_code ?? location.state,
      location.country_code ?? location.country_name
    ].filter(Boolean).join(", ")))
    .filter(Boolean);

  if (structured.length > 0) {
    return structured.slice(0, 2).join("; ");
  }

  const cities = (raw.cities ?? []).map(cleanText).filter(Boolean);

  if (cities.length > 0) {
    return cities.slice(0, 2).join("; ");
  }

  return cleanText([raw.city, raw.state_code, raw.country_code ?? raw.country].filter(Boolean).join(", "));
}

function inferTheirStackWorkplace(raw: TheirStackJob): Workplace | undefined {
  if (raw.remote) return "Remote";
  if (raw.hybrid) return "Hybrid";
  return undefined;
}

function normalizeTheirStackSalary(raw: TheirStackJob) {
  const currency = cleanText(raw.salary_currency) || "USD";
  const numericSalary = normalizeSalary(
    raw.min_annual_salary_usd ?? raw.min_annual_salary,
    raw.max_annual_salary_usd ?? raw.max_annual_salary
  );

  if (numericSalary) {
    return currency === "USD" ? numericSalary : { ...numericSalary, currency };
  }

  const label = cleanText(raw.salary_string);

  return label ? { currency, label } : undefined;
}

function normalizeTheirStackEmploymentType(values: string[] | undefined) {
  const [first] = values ?? [];

  if (!first) {
    return undefined;
  }

  const normalized = first.trim().toLowerCase();
  const employmentTypes: Record<string, string> = {
    contract: "Contract",
    contractor: "Contract",
    fulltime: "Full-time",
    full_time: "Full-time",
    full: "Full-time",
    internship: "Internship",
    parttime: "Part-time",
    part_time: "Part-time",
    temporary: "Temporary"
  };

  return employmentTypes[normalized] ?? formatSlugLabel(first);
}

function normalizeTheirStackSeniority(value: string | undefined): Seniority | undefined {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "staff" || normalized === "principal") return "Staff";
  if (normalized === "senior") return "Senior";
  if (normalized === "junior" || normalized === "entry") return "Associate";
  if (normalized === "c_level") return "Lead";
  if (normalized === "mid_level" || normalized === "mid") return "Mid";
  return undefined;
}
