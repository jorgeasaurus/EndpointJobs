import type { Job, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
  formatProviderError,
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

type RapidApiJsonLdLocation = {
  name?: string;
  address?: {
    addressLocality?: string;
    addressRegion?: string;
    addressCountry?: string;
  };
};

type RapidApiJsonLd = {
  title?: string;
  url?: string;
  description?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string | string[];
  salaryCurrency?: string;
  baseSalary?: {
    currency?: string;
    value?: {
      minValue?: string | number;
      maxValue?: string | number;
      unitText?: string;
    };
  };
  hiringOrganization?: {
    name?: string;
  };
  jobLocation?: RapidApiJsonLdLocation | RapidApiJsonLdLocation[];
};

type RapidApiDailyJob = {
  portal?: string;
  source?: string;
  dateCreated?: string;
  dateExpired?: string;
  dateActive?: string;
  isDirect?: boolean;
  isRecruiter?: boolean;
  hasSalary?: boolean;
  minSalary?: number;
  maxSalary?: number;
  title?: string;
  countryCode?: string;
  state?: string;
  city?: string;
  postCode?: string;
  company?: string;
  industry?: string;
  department?: string;
  occupation?: string;
  workPlace?: string | string[];
  workType?: string | string[];
  contractType?: string | string[];
  careerLevel?: string | string[];
  skills?: string | string[];
  url?: string;
  applyUrl?: string;
  externalApplyUrl?: string;
  jobUrl?: string;
  jsonLD?: RapidApiJsonLd | RapidApiJsonLd[];
};

type RapidApiDailyJobsPage = {
  jobs: RapidApiDailyJob[];
  totalCount?: number;
};

export const rapidApiDailyJobsProvider: ProviderAdapter<"rapidapi"> = {
  id: "rapidapi",
  displayName: "RapidAPI Daily International Jobs",
  defaultUrl: "https://daily-international-job-postings.p.rapidapi.com/api/v2/jobs/search",
  fetchJobs: ({ url, fetchedAt }) => fetchRapidApiDailyJobs(url, fetchedAt)
};

async function fetchRapidApiDailyJobs(url: string, fetchedAt: Date) {
  const apiKey = process.env.RAPIDAPI_DAILY_JOBS_KEY ?? process.env.JOB_RAPIDAPI_DAILY_JOBS_KEY;

  if (!apiKey) {
    throw new Error("RAPIDAPI_DAILY_JOBS_KEY is required");
  }

  const configuredQueries = getCsvConfig("JOB_RAPIDAPI_QUERIES", []);
  const queries = configuredQueries.length > 0 ? configuredQueries : [""];
  const countryCodes = getCsvConfig("JOB_RAPIDAPI_COUNTRY_CODES", [
    process.env.JOB_RAPIDAPI_COUNTRY_CODE ?? "us"
  ]);
  const maxPages = Math.max(1, Number(process.env.JOB_RAPIDAPI_MAX_PAGES ?? 1));
  const jobs: Array<Job | null> = [];
  let successfulPages = 0;
  const failures: string[] = [];

  for (const countryCode of countryCodes) {
    for (const query of queries) {
      for (let page = 1; page <= maxPages; page += 1) {
        const queryUrl = buildRapidApiDailyJobsUrl(url, query, page, countryCode);
        const label = `RapidAPI Daily Jobs/${countryCode} ${query || "salary feed"} page ${page}`;
        try {
          const payload = await fetchRapidApiDailyJobsPage(queryUrl, apiKey);
          successfulPages += 1;
          jobs.push(...payload.jobs.map((job) => normalizeRapidApiDailyJob(job, query, fetchedAt)));
          console.log(`Fetched ${payload.jobs.length} raw jobs from ${label}`);

          if (payload.jobs.length === 0) {
            break;
          }
        } catch (error) {
          const detail = formatProviderError(error);
          failures.push(`${label}: ${detail}`);
          console.warn(`Skipping ${label}: ${detail}`);
          break;
        }
      }
    }
  }

  if (successfulPages === 0 && failures.length > 0) {
    throw new Error(`All RapidAPI Daily Jobs requests failed: ${failures.join("; ")}`);
  }

  return jobs;
}

function buildRapidApiDailyJobsUrl(
  baseUrl: string,
  query: string,
  page: number,
  countryCode: string
) {
  const url = new URL(baseUrl);
  const hasSalary = process.env.JOB_RAPIDAPI_HAS_SALARY ?? "true";
  const queryParam = process.env.JOB_RAPIDAPI_QUERY_PARAM ?? "query";

  url.searchParams.set("format", "json");
  url.searchParams.set("countryCode", countryCode);
  url.searchParams.set("hasSalary", hasSalary);
  url.searchParams.set("page", String(page));

  if (process.env.JOB_RAPIDAPI_PAGE_SIZE) {
    url.searchParams.set("pageSize", process.env.JOB_RAPIDAPI_PAGE_SIZE);
  }

  if (queryParam && query) {
    url.searchParams.set(queryParam, query);
  }

  return url.toString();
}

async function fetchRapidApiDailyJobsPage(url: string, apiKey: string): Promise<RapidApiDailyJobsPage> {
  const host = process.env.JOB_RAPIDAPI_DAILY_JOBS_HOST
    ?? "daily-international-job-postings.p.rapidapi.com";
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)",
      "x-rapidapi-host": host,
      "x-rapidapi-key": apiKey
    }
  });

  if (!response.ok) {
    const detail = summarize(cleanText(await response.text()));
    throw new Error(
      `RapidAPI Daily Jobs request failed: ${response.status} ${response.statusText}${
        detail ? ` - ${detail}` : ""
      }`
    );
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object") {
    throw new Error("RapidAPI Daily Jobs response was not an object");
  }

  const candidate = json as { result?: unknown; totalCount?: unknown };
  const jobs = Array.isArray(candidate.result)
    ? candidate.result.filter(isRapidApiDailyJob)
    : [];

  return {
    jobs,
    totalCount: toNumber(candidate.totalCount)
  };
}

function isRapidApiDailyJob(value: unknown): value is RapidApiDailyJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as RapidApiDailyJob;
  const jsonLd = getFirstJsonLd(candidate);

  return Boolean(
    (candidate.title || jsonLd?.title) &&
      (candidate.company || jsonLd?.hiringOrganization?.name) &&
      (candidate.url || candidate.applyUrl || candidate.externalApplyUrl || candidate.jobUrl || jsonLd?.url)
  );
}

function normalizeRapidApiDailyJob(raw: RapidApiDailyJob, query: string, fetchedAt: Date) {
  const jsonLd = getFirstJsonLd(raw);
  const title = cleanText(raw.title ?? jsonLd?.title);
  const company = cleanText(raw.company ?? jsonLd?.hiringOrganization?.name);
  const sourceJobUrl = getRapidApiDailyJobUrl(raw, jsonLd);
  const expiredAt = parseDateLike(raw.dateExpired ?? jsonLd?.validThrough);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  if (expiredAt && new Date(expiredAt).getTime() <= fetchedAt.getTime()) {
    return null;
  }

  const sourceTags = [
    query,
    raw.portal,
    raw.source,
    raw.industry,
    raw.department,
    raw.occupation,
    ...(toArray(raw.workPlace).map(formatSlugLabel)),
    ...(toArray(raw.workType).map(formatSlugLabel)),
    ...(toArray(raw.contractType).map(formatSlugLabel)),
    ...(toArray(raw.careerLevel).map(formatSlugLabel)),
    ...(toArray(raw.skills).map(formatSlugLabel))
  ].map(cleanText).filter(Boolean);

  return toEndpointJob({
    id: buildStableJobId("rapidapi", company, title, sourceJobUrl),
    title,
    company,
    location: getRapidApiDailyJobLocation(raw, jsonLd),
    workplace: inferRapidApiDailyJobWorkplace(raw, jsonLd),
    postedAt: parseDateLike(jsonLd?.datePosted)
      ?? parseDateLike(raw.dateActive)
      ?? parseDateLike(raw.dateCreated)
      ?? fetchedAt.toISOString(),
    fetchedAt,
    staleAfter: expiredAt,
    source: "RapidAPI Daily International Jobs",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: "Daily International Jobs via RapidAPI",
    termsProfile: "partner-terms",
    description: jsonLd?.description ?? "",
    sourceTags,
    haystackParts: [raw.portal, raw.source, raw.isDirect ? "direct" : undefined],
    salary: normalizeRapidApiDailyJobSalary(raw, jsonLd),
    employmentType: normalizeRapidApiDailyJobEmploymentType(raw, jsonLd)
  });
}

function getFirstJsonLd(raw: RapidApiDailyJob) {
  return toArray(raw.jsonLD).find(Boolean);
}

function getRapidApiDailyJobUrl(raw: RapidApiDailyJob, jsonLd: RapidApiJsonLd | undefined) {
  return cleanUrl(raw.externalApplyUrl)
    ?? cleanUrl(raw.applyUrl)
    ?? cleanUrl(raw.jobUrl)
    ?? cleanUrl(raw.url)
    ?? cleanUrl(jsonLd?.url);
}

function getRapidApiDailyJobLocation(raw: RapidApiDailyJob, jsonLd: RapidApiJsonLd | undefined) {
  const direct = cleanText([raw.city, raw.state, raw.countryCode].filter(Boolean).join(", "));

  if (direct) {
    return direct;
  }

  const locations = toArray(jsonLd?.jobLocation)
    .map((location) => cleanText(location.name) || cleanText([
      location.address?.addressLocality,
      location.address?.addressRegion,
      location.address?.addressCountry
    ].filter(Boolean).join(", ")))
    .filter(Boolean);

  return locations.slice(0, 2).join("; ");
}

function inferRapidApiDailyJobWorkplace(
  raw: RapidApiDailyJob,
  jsonLd: RapidApiJsonLd | undefined
): Workplace | undefined {
  const text = normalizeSearchText([
    ...toArray(raw.workPlace),
    getRapidApiDailyJobLocation(raw, jsonLd),
    jsonLd?.description
  ].join(" "));

  if (text.includes("remote")) return "Remote";
  if (text.includes("hybrid")) return "Hybrid";
  if (text.includes("on-site") || text.includes("onsite")) return "On-site";
  return undefined;
}

function normalizeRapidApiDailyJobSalary(
  raw: RapidApiDailyJob,
  jsonLd: RapidApiJsonLd | undefined
) {
  const value = jsonLd?.baseSalary?.value;
  const salary = normalizeSalary(
    toNumber(raw.minSalary) ?? toNumber(value?.minValue),
    toNumber(raw.maxSalary) ?? toNumber(value?.maxValue)
  );
  const currency = cleanText(jsonLd?.salaryCurrency ?? jsonLd?.baseSalary?.currency);

  if (!salary || !currency || currency === salary.currency) {
    return salary;
  }

  return { ...salary, currency };
}

function normalizeRapidApiDailyJobEmploymentType(
  raw: RapidApiDailyJob,
  jsonLd: RapidApiJsonLd | undefined
) {
  return normalizeFirstEmploymentType([
    ...toArray(jsonLd?.employmentType),
    ...toArray(raw.workType),
    ...toArray(raw.contractType)
  ]);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}
