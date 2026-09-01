import type { Job, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
  formatProviderError,
  formatSlugLabel,
  getCsvConfig,
  normalizeEmploymentTypeLabel,
  normalizeSalary,
  parseDateLike,
  summarize,
  toEndpointJob
} from "../shared";

type FourDayWeekNamedItem = {
  name?: string;
  slug?: string;
};

type FourDayWeekLocation = {
  city?: string;
  state?: string;
  country?: string;
  continent?: string;
  work_arrangement?: string;
  is_primary?: boolean;
};

type FourDayWeekCompany = {
  name?: string;
  slug?: string;
};

type FourDayWeekJob = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  url?: string;
  category?: string;
  role?: string;
  level?: string;
  contract_type?: string;
  schedule_type?: string;
  work_arrangement?: string;
  locations?: FourDayWeekLocation[];
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
  skills?: FourDayWeekNamedItem[];
  stack?: FourDayWeekNamedItem[];
  tools?: FourDayWeekNamedItem[];
  posted_at?: string;
  expires_at?: string | null;
  company?: FourDayWeekCompany;
};

type FourDayWeekPage = {
  data: FourDayWeekJob[];
  hasMore: boolean;
};

const defaultQueries = [
  "intune",
  "jamf",
  "mdm",
  "uem",
  "euc",
  "sccm",
  "tanium",
  "autopilot",
  "endpoint engineer"
];

export const fourdayweekProvider: ProviderAdapter<"fourdayweek"> = {
  id: "fourdayweek",
  displayName: "4 Day Week",
  defaultUrl: "https://4dayweek.io/api/v2/jobs",
  fetchJobs: ({ url, fetchedAt }) => fetchFourDayWeekJobs(url, fetchedAt)
};

async function fetchFourDayWeekJobs(baseUrl: string, fetchedAt: Date) {
  const queries = getCsvConfig("JOB_FOURDAYWEEK_QUERIES", defaultQueries);
  const maxPages = getBoundedInteger(process.env.JOB_FOURDAYWEEK_MAX_PAGES, 1, 1, 2);
  const limit = getBoundedInteger(process.env.JOB_FOURDAYWEEK_LIMIT, 25, 1, 100);
  const jobs: Array<Job | null> = [];
  let successfulSearches = 0;
  const failures: string[] = [];

  queryLoop:
  for (const query of queries) {
    for (let page = 1; page <= maxPages; page += 1) {
      const requestUrl = buildFourDayWeekUrl(baseUrl, query, limit, page);

      try {
        const payload = await fetchFourDayWeekPage(requestUrl);
        successfulSearches += 1;
        jobs.push(...payload.data.map((job) => normalizeFourDayWeekJob(job, fetchedAt)));
        console.log(`Fetched ${payload.data.length} raw jobs from 4 Day Week query ${query} page ${page}`);

        if (!payload.hasMore || payload.data.length < limit) {
          break;
        }
      } catch (error) {
        const detail = formatProviderError(error);
        failures.push(`4 Day Week query ${query} page ${page}: ${detail}`);
        console.warn(`Skipping 4 Day Week query ${query} page ${page}: ${detail}`);

        if (isRateLimitError(error)) {
          break queryLoop;
        }

        break;
      }
    }
  }

  if (successfulSearches === 0 && failures.length > 0) {
    throw new Error(`All 4 Day Week searches failed: ${failures.join("; ")}`);
  }

  return jobs;
}

function buildFourDayWeekUrl(baseUrl: string, query: string, limit: number, page: number) {
  const url = new URL(baseUrl);

  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));

  return url.toString();
}

async function fetchFourDayWeekPage(url: string): Promise<FourDayWeekPage> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/jorgeasaurus/EndpointJobs)"
    }
  });

  if (response.status === 429) {
    throw new Error("429 Too Many Requests");
  }

  if (!response.ok) {
    const detail = summarize(cleanText(await response.text()));
    throw new Error(
      `4 Day Week request failed: ${response.status} ${response.statusText}${
        detail ? ` - ${detail}` : ""
      }`
    );
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { data?: unknown }).data)) {
    throw new Error("4 Day Week response did not include a data array");
  }

  const payload = json as { data: unknown[]; has_more?: unknown };

  return {
    data: payload.data.filter(isFourDayWeekJob),
    hasMore: payload.has_more === true
  };
}

function isFourDayWeekJob(value: unknown): value is FourDayWeekJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const job = value as FourDayWeekJob;
  return Boolean(job.title && job.company?.name && job.url);
}

function normalizeFourDayWeekJob(raw: FourDayWeekJob, fetchedAt: Date) {
  const title = cleanText(raw.title);
  const company = cleanText(raw.company?.name);
  const sourceUrl = cleanUrl(raw.url);

  if (!title || !company || !sourceUrl) {
    return null;
  }

  const expiresAt = parseDateLike(raw.expires_at ?? undefined);

  if (expiresAt && new Date(expiresAt).getTime() <= fetchedAt.getTime()) {
    return null;
  }

  const toolNames = namedItemNames(raw.tools);
  const skillNames = namedItemNames(raw.skills);
  const stackNames = namedItemNames(raw.stack);
  const location = formatFourDayWeekLocation(raw.locations, raw.work_arrangement);
  const sourceTags = [
    raw.category,
    raw.role,
    raw.level,
    raw.contract_type,
    raw.schedule_type,
    raw.work_arrangement,
    ...toolNames,
    ...skillNames,
    ...stackNames
  ].map(cleanText).filter(Boolean);

  return toEndpointJob({
    id: buildStableJobId("fourdayweek", company, title, raw.id ?? sourceUrl),
    title,
    company,
    location,
    workplace: normalizeFourDayWeekWorkplace(raw.work_arrangement),
    postedAt: parseDateLike(raw.posted_at) ?? fetchedAt.toISOString(),
    fetchedAt,
    ...(expiresAt ? { staleAfter: expiresAt } : {}),
    source: "4 Day Week",
    sourceUrl,
    applyUrl: sourceUrl,
    attributionLabel: "4dayweek.io",
    termsProfile: "attribution-required",
    description: raw.description,
    sourceTags,
    haystackParts: [
      ...toolNames,
      ...skillNames,
      ...stackNames,
      raw.category,
      raw.role,
      raw.level,
      raw.schedule_type,
      location
    ],
    salary: normalizeFourDayWeekSalary(raw),
    employmentType: normalizeEmploymentTypeLabel(raw.contract_type)
  });
}

function namedItemNames(values: FourDayWeekNamedItem[] | undefined) {
  return (values ?? []).map((item) => cleanText(item.name)).filter(Boolean);
}

function formatFourDayWeekLocation(
  locations: FourDayWeekLocation[] | undefined,
  workArrangement: string | undefined
) {
  const labels = (locations ?? [])
    .map((location) => cleanText(
      [location.city, location.state, location.country].filter(Boolean).join(", ")
    ))
    .filter(Boolean);

  if (labels.length > 0) {
    return Array.from(new Set(labels)).slice(0, 3).join("; ");
  }

  const arrangement = cleanText(workArrangement);
  return arrangement ? formatSlugLabel(arrangement) : "Unknown";
}

function normalizeFourDayWeekWorkplace(value: string | undefined): Workplace | undefined {
  switch (cleanText(value).toLowerCase()) {
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    case "onsite":
    case "on-site":
    case "on_site":
      return "On-site";
    default:
      return undefined;
  }
}

function normalizeFourDayWeekSalary(raw: FourDayWeekJob) {
  const period = cleanText(raw.salary_period).toLowerCase();

  if (period && period !== "year" && period !== "annual") {
    return undefined;
  }

  const min = centsToDollars(raw.salary_min);
  const max = centsToDollars(raw.salary_max);

  if (!min && !max) {
    return undefined;
  }

  const currency = cleanText(raw.salary_currency).toUpperCase() || "USD";

  if (currency === "USD") {
    return normalizeSalary(min, max);
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    return undefined;
  }

  const format = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  });
  const label = min && max
    ? `${format.format(min)}-${format.format(max)}`
    : format.format(min ?? max ?? 0);

  return {
    ...(min ? { min } : {}),
    ...(max ? { max } : {}),
    currency,
    label
  };
}

function centsToDollars(value: number | null | undefined) {
  const parsed = typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;

  return parsed ? parsed / 100 : undefined;
}

function getBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (!value || !/^\d+$/.test(value.trim())) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10)));
}

function isRateLimitError(error: unknown) {
  return formatProviderError(error).includes("429");
}
