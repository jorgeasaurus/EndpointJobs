import type { Job, Workplace } from "../../../src/types/job";

import { isHighVolumeJobCountry, isSpainJobCountry } from "../high-volume-countries";
import type { ProviderAdapter } from "../provider";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
  formatProviderError,
  formatSlugLabel,
  getCsvConfig,
  getNonNegativeInteger,
  getPositiveInteger,
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

const RAPIDAPI_DAILY_PAGE_SIZE_MAX = 10;
const DEFAULT_REQUEST_DELAY_MS = 650;
const DEFAULT_MONTHLY_REQUEST_BUDGET = 2700;
const ASSUMED_REFRESHES_PER_MONTH = 31;
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_QUERY_PARAM = "title";

export const defaultRapidApiDailyTitleTerms = [
  "intune",
  "jamf",
  "mdm",
  "uem",
  "endpoint"
] as const;

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
  const countryCodes = prioritizeRapidApiCountryCodes(
    getCsvConfig("JOB_RAPIDAPI_COUNTRY_CODES", [
      process.env.JOB_RAPIDAPI_COUNTRY_CODE ?? "us"
    ])
  );
  const maxRequests = getRapidApiDailyJobsMaxRequestsPerRun();
  const requestDelayMs = getRapidApiDailyJobsRequestDelayMs();
  const retryDelayMs = getRapidApiDailyJobsRetryDelayMs();
  const jobs: Array<Job | null> = [];
  let requestCount = 0;
  let successfulPages = 0;
  const failures: string[] = [];

  countryLoop: for (const countryCode of countryCodes) {
    const queries = getRapidApiDailyJobsSearchQueries(countryCode, configuredQueries);
    const maxPages = getRapidApiDailyJobsMaxPages(countryCode);

    for (const query of queries) {
      for (let page = 1; page <= maxPages; page += 1) {
        if (requestCount >= maxRequests) {
          console.log(`Reached RapidAPI Daily run cap after ${requestCount} requests`);
          break countryLoop;
        }

        const queryUrl = buildRapidApiDailyJobsUrl(url, query, page, countryCode, fetchedAt);
        const label = `RapidAPI Daily Jobs/${countryCode} ${query || "salary feed"} page ${page}`;

        if (requestCount > 0) {
          await delay(requestDelayMs);
        }

        try {
          const payload = await fetchRapidApiDailyJobsPage(queryUrl, apiKey);
          requestCount += 1;
          successfulPages += 1;
          jobs.push(...payload.jobs.map((job) => normalizeRapidApiDailyJob(job, fetchedAt)));
          console.log(`Fetched ${payload.jobs.length} raw jobs from ${label}`);

          if (payload.jobs.length === 0) {
            break;
          }
        } catch (error) {
          requestCount += 1;
          const detail = formatProviderError(error);

          if (isRapidApiDailyJobsRateLimitError(error)) {
            if (requestCount >= maxRequests) {
              failures.push(`${label}: ${detail}`);
              console.warn(`Stopping RapidAPI Daily after rate limit at run cap: ${detail}`);
              break countryLoop;
            }

            console.warn(`Retrying ${label} after 429`);
            await delay(retryDelayMs);

            try {
              const payload = await fetchRapidApiDailyJobsPage(queryUrl, apiKey);
              requestCount += 1;
              successfulPages += 1;
              jobs.push(...payload.jobs.map((job) => normalizeRapidApiDailyJob(job, fetchedAt)));
              console.log(`Fetched ${payload.jobs.length} raw jobs from ${label} (retry)`);

              if (payload.jobs.length === 0) {
                break;
              }

              continue;
            } catch (retryError) {
              requestCount += 1;
              const retryDetail = formatProviderError(retryError);
              failures.push(`${label}: ${retryDetail}`);
              console.warn(`Skipping ${label}: ${retryDetail}`);

              if (isRapidApiDailyJobsRateLimitError(retryError)) {
                console.warn("Stopping RapidAPI Daily after repeated 429s");
                break countryLoop;
              }

              break;
            }
          }

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

export function getRapidApiDailyJobsQueries(
  countryCode: string,
  configuredQueries: string[] = getCsvConfig("JOB_RAPIDAPI_QUERIES", [])
) {
  if (configuredQueries.length > 0) {
    return configuredQueries;
  }

  if (isHighVolumeJobCountry(countryCode)) {
    return [""];
  }

  const latamQueries = getCsvConfig(
    "JOB_RAPIDAPI_LATAM_QUERIES",
    [...defaultRapidApiDailyTitleTerms]
  );

  if (isSpainJobCountry(countryCode)) {
    return getCsvConfig("JOB_RAPIDAPI_SPAIN_QUERIES", latamQueries);
  }

  return latamQueries;
}

export function joinRapidApiDailyTitleTerms(terms: string[]) {
  return terms.map((term) => term.trim()).filter(Boolean).join(",");
}

export function getRapidApiDailyJobsSearchQueries(
  countryCode: string,
  configuredQueries: string[] = getCsvConfig("JOB_RAPIDAPI_QUERIES", [])
) {
  const terms = getRapidApiDailyJobsQueries(countryCode, configuredQueries);
  const joined = joinRapidApiDailyTitleTerms(terms);
  return [joined];
}

export function getRapidApiDailyJobsQueryParam() {
  return process.env.JOB_RAPIDAPI_QUERY_PARAM ?? DEFAULT_QUERY_PARAM;
}

export function getRapidApiDailyJobsLookbackDays() {
  return getPositiveInteger(process.env.JOB_RAPIDAPI_LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS);
}

export type RapidApiDailyDateRange =
  | { dateCreated: string }
  | { dateCreatedMin: string; dateCreatedMax: string };

export function getRapidApiDailyJobsDateRange(fetchedAt: Date): RapidApiDailyDateRange {
  const explicitDate = process.env.JOB_RAPIDAPI_DATE_CREATED?.trim();

  if (explicitDate) {
    return { dateCreated: explicitDate };
  }

  const max = toIsoDateUtc(fetchedAt);
  const minDate = new Date(fetchedAt.getTime());
  minDate.setUTCDate(minDate.getUTCDate() - getRapidApiDailyJobsLookbackDays());

  return {
    dateCreatedMin: toIsoDateUtc(minDate),
    dateCreatedMax: max
  };
}

export function getRapidApiDailyJobsMaxPages(countryCode: string) {
  const fallback = getPositiveInteger(process.env.JOB_RAPIDAPI_MAX_PAGES, 1);

  if (isHighVolumeJobCountry(countryCode)) {
    return fallback;
  }

  if (isSpainJobCountry(countryCode)) {
    return getPositiveInteger(
      process.env.JOB_RAPIDAPI_SPAIN_MAX_PAGES,
      getPositiveInteger(process.env.JOB_RAPIDAPI_LATAM_MAX_PAGES, fallback)
    );
  }

  return getPositiveInteger(process.env.JOB_RAPIDAPI_LATAM_MAX_PAGES, fallback);
}

export function getRapidApiDailyJobsRequestDelayMs() {
  return getNonNegativeInteger(process.env.JOB_RAPIDAPI_REQUEST_DELAY_MS, DEFAULT_REQUEST_DELAY_MS);
}

export function getRapidApiDailyJobsRetryDelayMs() {
  return getNonNegativeInteger(
    process.env.JOB_RAPIDAPI_RETRY_DELAY_MS,
    Math.max(1500, getRapidApiDailyJobsRequestDelayMs() * 2)
  );
}

export function getRapidApiDailyJobsMonthlyRequestBudget() {
  return getPositiveInteger(
    process.env.JOB_RAPIDAPI_MONTHLY_REQUEST_BUDGET,
    DEFAULT_MONTHLY_REQUEST_BUDGET
  );
}

export function getRapidApiDailyJobsMaxRequestsPerRun() {
  const derived = Math.max(
    1,
    Math.floor(getRapidApiDailyJobsMonthlyRequestBudget() / ASSUMED_REFRESHES_PER_MONTH)
  );

  return getPositiveInteger(process.env.JOB_RAPIDAPI_MAX_REQUESTS_PER_RUN, derived);
}

export function prioritizeRapidApiCountryCodes(countryCodes: string[]) {
  const spain: string[] = [];
  const latam: string[] = [];
  const highVolume: string[] = [];

  for (const countryCode of countryCodes) {
    if (isSpainJobCountry(countryCode)) {
      spain.push(countryCode);
    } else if (isHighVolumeJobCountry(countryCode)) {
      highVolume.push(countryCode);
    } else {
      latam.push(countryCode);
    }
  }

  return [...spain, ...latam, ...highVolume];
}

export function isRapidApiDailyJobsRateLimitError(error: unknown) {
  return /(?:^|\D)429(?:\D|$)/.test(formatProviderError(error));
}

export function getRapidApiDailyJobsHasSalary(countryCode: string) {
  if (isHighVolumeJobCountry(countryCode)) {
    return process.env.JOB_RAPIDAPI_HAS_SALARY ?? "true";
  }

  return process.env.JOB_RAPIDAPI_LATAM_HAS_SALARY ?? "false";
}

function buildRapidApiDailyJobsUrl(
  baseUrl: string,
  query: string,
  page: number,
  countryCode: string,
  fetchedAt: Date
) {
  const url = new URL(baseUrl);
  const hasSalary = getRapidApiDailyJobsHasSalary(countryCode);
  const queryParam = getRapidApiDailyJobsQueryParam();
  const dateRange = getRapidApiDailyJobsDateRange(fetchedAt);

  url.searchParams.set("format", "json");
  url.searchParams.set("countryCode", countryCode);
  url.searchParams.set("hasSalary", hasSalary);
  url.searchParams.set("page", String(page));

  if ("dateCreated" in dateRange) {
    url.searchParams.set("dateCreated", dateRange.dateCreated);
  } else {
    url.searchParams.set("dateCreatedMin", dateRange.dateCreatedMin);
    url.searchParams.set("dateCreatedMax", dateRange.dateCreatedMax);
  }

  if (process.env.JOB_RAPIDAPI_PAGE_SIZE) {
    const pageSize = Math.min(
      RAPIDAPI_DAILY_PAGE_SIZE_MAX,
      getPositiveInteger(process.env.JOB_RAPIDAPI_PAGE_SIZE, RAPIDAPI_DAILY_PAGE_SIZE_MAX)
    );
    url.searchParams.set("pageSize", String(pageSize));
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

  if (response.status === 429) {
    await response.body?.cancel();
    throw new Error("429 Too Many Requests");
  }

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

function normalizeRapidApiDailyJob(raw: RapidApiDailyJob, fetchedAt: Date) {
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

function toIsoDateUtc(value: Date) {
  return value.toISOString().slice(0, 10);
}

function delay(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
