import type { Job, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
  formatProviderError,
  getCsvConfig,
  normalizeEmploymentTypeLabel,
  normalizeSalary,
  parseDateLike,
  summarize,
  toEndpointJob
} from "../shared";

type HimalayasLocation = {
  alpha2?: string;
  name?: string;
  slug?: string;
};

type HimalayasJob = {
  title?: string;
  excerpt?: string;
  companyName?: string;
  companySlug?: string;
  employmentType?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string;
  seniority?: string | string[];
  currency?: string | null;
  locationRestrictions?: Array<string | HimalayasLocation>;
  timezoneRestrictions?: string[];
  categories?: string[];
  parentCategories?: string[];
  description?: string;
  pubDate?: number | string;
  expiryDate?: number | string;
  applicationLink?: string;
  guid?: string;
};

type HimalayasPage = {
  jobs: HimalayasJob[];
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

export const himalayasProvider: ProviderAdapter<"himalayas"> = {
  id: "himalayas",
  displayName: "Himalayas",
  defaultUrl: "https://himalayas.app/jobs/api/search",
  fetchJobs: ({ url, fetchedAt }) => fetchHimalayasJobs(url, fetchedAt)
};

async function fetchHimalayasJobs(baseUrl: string, fetchedAt: Date) {
  const queries = getCsvConfig("JOB_HIMALAYAS_QUERIES", defaultQueries);
  const jobs: Array<Job | null> = [];
  let successfulSearches = 0;
  const failures: string[] = [];

  for (const query of queries) {
    const requestUrl = buildHimalayasSearchUrl(baseUrl, query);

    try {
      const payload = await fetchHimalayasPage(requestUrl);
      successfulSearches += 1;
      jobs.push(...payload.jobs.map((job) => normalizeHimalayasJob(job, fetchedAt)));
      console.log(`Fetched ${payload.jobs.length} raw jobs from Himalayas query ${query}`);
    } catch (error) {
      const detail = formatProviderError(error);
      failures.push(`Himalayas query ${query}: ${detail}`);
      console.warn(`Skipping Himalayas query ${query}: ${detail}`);

      if (isRateLimitError(error)) {
        break;
      }
    }
  }

  if (successfulSearches === 0 && failures.length > 0) {
    throw new Error(`All Himalayas searches failed: ${failures.join("; ")}`);
  }

  return jobs;
}

function buildHimalayasSearchUrl(baseUrl: string, query: string) {
  const url = new URL(baseUrl);

  url.searchParams.set("q", query);
  url.searchParams.set("sort", "recent");
  url.searchParams.set("limit", "20");
  url.searchParams.set("page", "1");

  return url.toString();
}

async function fetchHimalayasPage(url: string): Promise<HimalayasPage> {
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
      `Himalayas request failed: ${response.status} ${response.statusText}${
        detail ? ` - ${detail}` : ""
      }`
    );
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { jobs?: unknown }).jobs)) {
    throw new Error("Himalayas response did not include a jobs array");
  }

  return {
    jobs: (json as { jobs: unknown[] }).jobs.filter(isHimalayasJob)
  };
}

function isHimalayasJob(value: unknown): value is HimalayasJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const job = value as HimalayasJob;
  return Boolean(job.title && job.companyName && (job.applicationLink || job.guid));
}

function normalizeHimalayasJob(raw: HimalayasJob, fetchedAt: Date) {
  const title = cleanText(raw.title);
  const company = cleanText(raw.companyName);
  const sourceUrl = cleanUrl(raw.guid) ?? cleanUrl(raw.applicationLink);
  const applyUrl = cleanUrl(raw.applicationLink) ?? sourceUrl;

  if (!title || !company || !sourceUrl || !applyUrl) {
    return null;
  }

  const expiresAt = parseUnixTimestamp(raw.expiryDate);

  if (expiresAt && new Date(expiresAt).getTime() <= fetchedAt.getTime()) {
    return null;
  }

  const location = formatHimalayasLocation(raw.locationRestrictions);
  const description = [raw.excerpt, raw.description].filter(Boolean).join("\n\n");
  const sourceTags = [
    raw.employmentType,
    ...(Array.isArray(raw.seniority) ? raw.seniority : [raw.seniority]),
    ...(raw.categories ?? []),
    ...(raw.parentCategories ?? []),
    ...(raw.timezoneRestrictions ?? [])
  ].map(cleanText).filter(Boolean);

  return toEndpointJob({
    id: buildStableJobId("himalayas", company, title, sourceUrl),
    title,
    company,
    location,
    workplace: "Remote" satisfies Workplace,
    postedAt: parseUnixTimestamp(raw.pubDate) ?? fetchedAt.toISOString(),
    fetchedAt,
    ...(expiresAt ? { staleAfter: expiresAt } : {}),
    source: "Himalayas",
    sourceUrl,
    applyUrl,
    attributionLabel: "Himalayas",
    termsProfile: "attribution-required",
    description,
    sourceTags,
    haystackParts: [
      raw.excerpt,
      ...(raw.categories ?? []),
      ...(raw.parentCategories ?? []),
      location
    ],
    salary: normalizeHimalayasSalary(raw),
    employmentType: normalizeEmploymentTypeLabel(raw.employmentType)
  });
}

function formatHimalayasLocation(restrictions: HimalayasJob["locationRestrictions"]) {
  const names = (restrictions ?? [])
    .map((entry) => {
      if (typeof entry === "string") {
        return cleanText(entry);
      }

      return cleanText(entry?.name) || cleanText(entry?.alpha2);
    })
    .filter(Boolean);

  return names.length > 0 ? Array.from(new Set(names)).join("; ") : "Worldwide";
}

function normalizeHimalayasSalary(raw: HimalayasJob) {
  const period = cleanText(raw.salaryPeriod).toLowerCase() || "annual";

  if (period && period !== "annual") {
    return undefined;
  }

  const min = toPositiveNumber(raw.minSalary);
  const max = toPositiveNumber(raw.maxSalary);

  if (!min && !max) {
    return undefined;
  }

  const currency = cleanText(raw.currency).toUpperCase() || "USD";

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

function parseUnixTimestamp(value: number | string | undefined) {
  if (typeof value === "string") {
    if (/^\d+$/.test(value.trim())) {
      return parseUnixTimestamp(Number(value));
    }

    return parseDateLike(value);
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  const milliseconds = value < 1e12 ? value * 1000 : value;
  const parsed = new Date(milliseconds);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function toPositiveNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function isRateLimitError(error: unknown) {
  return formatProviderError(error).includes("429");
}
