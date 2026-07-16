import type { Job, Workplace } from "../../../src/types/job";
import { serpApiJobSourceName } from "../../../src/lib/job-sources";

import type { ProviderAdapter } from "../provider";
import { defaultCompanyJobQueries, defaultEndpointSearchQueries } from "../search-config";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
  extractSalaryFromText,
  getCsvConfig,
  getString,
  normalizeEmploymentTypeLabel,
  parseRelativeAgeDate,
  summarize,
  toEndpointJob
} from "../shared";

type SerpApiApplyOption = {
  title?: string;
  link?: string;
};

type SerpApiDetectedExtensions = {
  posted_at?: string;
  schedule_type?: string;
  salary?: string;
  work_from_home?: boolean;
};

export type SerpApiGoogleJob = {
  title?: string;
  company_name?: string;
  location?: string;
  via?: string;
  share_link?: string;
  description?: string;
  job_highlights?: unknown;
  extensions?: string[];
  detected_extensions?: SerpApiDetectedExtensions;
  apply_options?: SerpApiApplyOption[];
  job_id?: string;
};

type SerpApiGoogleJobsPage = {
  jobs: SerpApiGoogleJob[];
  nextPageToken?: string;
};

type SerpApiMarket = {
  code: string;
  currency: string;
  gl: string;
  googleDomain: string;
  hl: string;
  location?: string;
};

type SerpApiSearch = {
  market: SerpApiMarket;
  query: string;
};

const serpApiMarketPresets = {
  au: {
    code: "au",
    currency: "AUD",
    gl: "au",
    googleDomain: "google.com.au",
    hl: "en",
    location: "Australia"
  },
  us: {
    code: "us",
    currency: "USD",
    gl: "us",
    googleDomain: "google.com",
    hl: "en",
    location: "United States"
  }
} as const satisfies Record<string, SerpApiMarket>;

const defaultSerpApiQueries = Array.from(new Set([
  ...defaultEndpointSearchQueries,
  ...defaultCompanyJobQueries
]));
const pinnedSerpApiQueries = [
  "endpoint engineer",
  "endpoint administrator",
  "end user computing engineer",
  "digital workplace engineer",
  "zero-touch deployment",
  "powershell administrator"
];
export const serpApiProvider: ProviderAdapter<"serpapi"> = {
  id: "serpapi",
  displayName: serpApiJobSourceName,
  defaultUrl: "https://serpapi.com/search.json",
  fetchJobs: ({ url, fetchedAt }) => fetchSerpApiGoogleJobs(url, fetchedAt)
};

async function fetchSerpApiGoogleJobs(url: string, fetchedAt: Date) {
  const apiKey = process.env.SERPAPI_API_KEY ?? process.env.JOB_SERPAPI_API_KEY;

  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is required");
  }

  const sharedQueries = getCsvConfig("JOB_SERPAPI_QUERIES", defaultSerpApiQueries);
  const rotationIndex = getSerpApiRotationIndex(fetchedAt);
  const marketSchedules = getSerpApiMarkets().map((market) => {
    const queries = getCsvConfig(
      `JOB_SERPAPI_${market.code.toUpperCase()}_QUERIES`,
      sharedQueries
    );
    const locations = getDelimitedConfig(
      `JOB_SERPAPI_${market.code.toUpperCase()}_LOCATIONS`,
      "|"
    );

    const searches = buildMarketSearches(market, queries, locations);

    return {
      market,
      searches: selectRotatingSearches(
        searches,
        getOptionalPositiveInteger(
          process.env[`JOB_SERPAPI_${market.code.toUpperCase()}_QUERY_LIMIT`]
        ),
        rotationIndex,
        pinnedSerpApiQueries
      )
    };
  });
  const maxPages = getPositiveInteger(process.env.JOB_SERPAPI_MAX_PAGES, 1);
  const configuredMaxSearches = getPositiveInteger(
    process.env.JOB_SERPAPI_MAX_SEARCHES_PER_RUN,
    28
  );
  const maxSearches = await getSerpApiSearchBudget(apiKey, configuredMaxSearches);
  const jobs: Array<Job | null> = [];
  let firstError: unknown;
  let searchCount = 0;
  let successfulSearches = 0;

  const queryRoundCount = Math.max(...marketSchedules.map(({ searches }) => searches.length));

  for (let queryIndex = 0; queryIndex < queryRoundCount; queryIndex += 1) {
    const marketStates = marketSchedules
      .map(({ searches }) => searches[queryIndex])
      .filter((search): search is SerpApiSearch => Boolean(search))
      .map(({ market, query }) => ({
        active: true,
        market,
        nextPageToken: undefined as string | undefined,
        query
      }));

    for (let page = 0; page < maxPages; page += 1) {
      for (const state of marketStates) {
        if (!state.active) {
          continue;
        }

        const { market, query } = state;
        if (searchCount >= maxSearches) {
          console.log(`Reached SerpAPI run cap after ${searchCount} searches`);
          return jobs;
        }

        const queryUrl = buildSerpApiGoogleJobsUrl(
          url,
          query,
          apiKey,
          market,
          state.nextPageToken
        );
        let payload: SerpApiGoogleJobsPage;
        searchCount += 1;

        try {
          payload = await fetchSerpApiGoogleJobsPage(queryUrl);
          successfulSearches += 1;
        } catch (error) {
          const usableJobs = jobs.filter((job): job is Job => Boolean(job));

          if (isSerpApiQuotaError(error)) {
            if (usableJobs.length > 0) {
              console.warn(
                `Returning ${usableJobs.length} partial SerpAPI jobs after quota exhaustion in market ${market.code} query ${query} page ${page}: ${formatError(error)}`
              );
              return usableJobs;
            }

            throw error;
          }

          firstError ??= error;
          state.active = false;
          console.warn(
            `Skipping SerpAPI market ${market.code} query ${query} page ${page} after request failed: ${formatError(error)}`
          );
          continue;
        }

        jobs.push(...payload.jobs.map((job) =>
          normalizeSerpApiGoogleJob(job, query, fetchedAt, market.currency)
        ));
        console.log(
          `Fetched ${payload.jobs.length} raw jobs from ${serpApiJobSourceName} market ${market.code} query ${query} page ${page}`
        );

        state.nextPageToken = payload.nextPageToken;

        if (!state.nextPageToken || payload.jobs.length === 0) {
          state.active = false;
        }
      }
    }
  }

  if (successfulSearches === 0 && firstError) {
    throw firstError;
  }

  return jobs;
}

function buildMarketSearches(
  market: SerpApiMarket,
  queries: string[],
  locations: string[]
): SerpApiSearch[] {
  if (locations.length === 0) {
    return queries.map((query) => ({ market, query }));
  }

  return locations.flatMap((location) => queries.map((query) => ({
    market: { ...market, location },
    query
  })));
}

function getDelimitedConfig(envKey: string, delimiter: string) {
  return (process.env[envKey] ?? "")
    .split(delimiter)
    .map((value) => value.trim())
    .filter(Boolean);
}

function selectRotatingSearches(
  searches: SerpApiSearch[],
  limit: number | undefined,
  rotationIndex: number,
  pinnedQueries: string[]
) {
  if (!limit || searches.length <= limit) {
    return searches;
  }

  const pinnedQuerySet = new Set(pinnedQueries);
  const pinned = searches.filter(({ query }) => pinnedQuerySet.has(query)).slice(0, limit);
  const rotating = searches.filter(({ query }) => !pinnedQuerySet.has(query));
  const rotatingLimit = limit - pinned.length;

  if (rotatingLimit <= 0 || rotating.length === 0) {
    return pinned;
  }

  const offset = (rotationIndex * rotatingLimit) % rotating.length;
  const selected = Array.from(
    { length: Math.min(rotatingLimit, rotating.length) },
    (_, index) => rotating[(offset + index) % rotating.length]
  );

  return [...pinned, ...selected];
}

function getSerpApiRotationIndex(fetchedAt: Date) {
  const configured = process.env.JOB_SERPAPI_ROTATION_INDEX ?? process.env.GITHUB_RUN_NUMBER;

  if (configured !== undefined && /^\d+$/.test(configured.trim())) {
    const parsed = Number.parseInt(configured, 10);

    if (Number.isSafeInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return Math.floor(fetchedAt.getTime() / (24 * 60 * 60 * 1000));
}

async function getSerpApiSearchBudget(apiKey: string, configuredMaxSearches: number) {
  if (process.env.JOB_SERPAPI_QUOTA_PREFLIGHT !== "true") {
    return configuredMaxSearches;
  }

  const reserve = getNonNegativeInteger(process.env.JOB_SERPAPI_MONTHLY_RESERVE, 100);
  const url = new URL("https://serpapi.com/account.json");
  url.searchParams.set("api_key", apiKey);
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`SerpAPI account preflight failed: ${response.status} ${response.statusText}`);
  }

  const payload: unknown = await response.json();

  if (!payload || typeof payload !== "object") {
    throw new Error("SerpAPI account preflight response was not an object");
  }

  const account = payload as {
    plan_searches_left?: unknown;
    total_searches_left?: unknown;
  };
  const remaining = getNonNegativeNumber(
    account.plan_searches_left ?? account.total_searches_left
  );

  if (remaining === undefined) {
    throw new Error("SerpAPI account preflight response did not include remaining searches");
  }

  const budget = Math.min(configuredMaxSearches, Math.max(0, Math.floor(remaining) - reserve));
  console.log(
    `SerpAPI quota preflight allows ${budget} searches (${Math.floor(remaining)} remaining, ${reserve} reserved)`
  );
  return budget;
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  if (!value || !/^\d+$/.test(value.trim())) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getOptionalPositiveInteger(value: string | undefined) {
  if (!value || !/^\d+$/.test(value.trim())) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function getNonNegativeInteger(value: string | undefined, fallback: number) {
  if (value === undefined || !/^\d+$/.test(value.trim())) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function getNonNegativeNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

function isSerpApiQuotaError(error: unknown) {
  return (error instanceof SerpApiRequestError && error.status === 429)
    || /run out of searches|quota exhausted/i.test(formatError(error));
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

class SerpApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SerpApiRequestError";
  }
}

async function fetchSerpApiGoogleJobsPage(url: string): Promise<SerpApiGoogleJobsPage> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    const detail = summarize(cleanText(await response.text()));
    throw new SerpApiRequestError(
      `SerpAPI request failed: ${response.status} ${response.statusText}${
        detail ? ` - ${detail}` : ""
      }`,
      response.status
    );
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object") {
    throw new Error("SerpAPI response was not an object");
  }

  const candidate = json as {
    error?: unknown;
    jobs_results?: unknown;
    serpapi_pagination?: { next_page_token?: unknown };
  };

  if (candidate.error) {
    const message = cleanText(candidate.error);

    if (isSerpApiNoResultsError(message)) {
      return { jobs: [], nextPageToken: undefined };
    }

    throw new Error(`SerpAPI returned an error: ${message}`);
  }

  const jobs = Array.isArray(candidate.jobs_results)
    ? candidate.jobs_results.filter(isSerpApiGoogleJob)
    : [];

  return {
    jobs,
    nextPageToken: getString(candidate.serpapi_pagination?.next_page_token)
  };
}

function isSerpApiNoResultsError(value: string) {
  return /no results|hasn['’]t returned any results/i.test(value);
}

function isSerpApiGoogleJob(value: unknown): value is SerpApiGoogleJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as SerpApiGoogleJob;
  return Boolean(candidate.job_id && candidate.title && candidate.company_name);
}

export function normalizeSerpApiGoogleJob(
  raw: SerpApiGoogleJob,
  query: string,
  fetchedAt: Date,
  marketCurrency = "USD"
) {
  const title = cleanText(raw.title);
  const company = cleanText(raw.company_name);
  const sourceJobUrl = getSerpApiGoogleJobsApplyUrl(raw) ?? cleanUrl(raw.share_link);
  const location = cleanText(raw.location);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const extensions = (raw.extensions ?? []).map(cleanText).filter(Boolean);
  const sourceTags = [query, raw.via, raw.detected_extensions?.schedule_type, ...extensions]
    .map(cleanText)
    .filter(Boolean);

  return toEndpointJob({
    id: buildStableJobId("serpapi", [company, location].filter(Boolean).join(" "), title, sourceJobUrl),
    title,
    company,
    location,
    workplace: inferSerpApiGoogleJobsWorkplace(raw),
    postedAt: getSerpApiGoogleJobsPostedAt(raw, fetchedAt),
    fetchedAt,
    source: serpApiJobSourceName,
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: "Google Jobs via SerpAPI",
    termsProfile: "partner-terms",
    description: restoreSerpApiDescriptionStructure(raw),
    sourceTags,
    haystackParts: [raw.via],
    salary: getSerpApiGoogleJobsSalary(raw, marketCurrency),
    employmentType: normalizeSerpApiGoogleJobsEmploymentType(raw)
  });
}

function restoreSerpApiDescriptionStructure(raw: SerpApiGoogleJob) {
  const description = (raw.description ?? "").replace(/\\r\\n|\\n|\\r/g, "\n");

  if (!description || description.includes("\n")) {
    return description;
  }

  if (!Array.isArray(raw.job_highlights)) {
    return description;
  }

  const items: string[] = [];

  for (const section of raw.job_highlights) {
    if (!section || typeof section !== "object" || !("items" in section) || !Array.isArray(section.items)) {
      return description;
    }

    for (const item of section.items) {
      if (typeof item !== "string") {
        return description;
      }

      const trimmedItem = item.trim();

      if (trimmedItem) {
        items.push(trimmedItem);
      }
    }
  }
  const matches: Array<{ end: number; start: number }> = [];
  let previousEnd = 0;

  for (const item of items) {
    const start = description.indexOf(item);

    if (start < previousEnd || start < 0 || start !== description.lastIndexOf(item)) {
      return description;
    }

    previousEnd = start + item.length;
    matches.push({ end: previousEnd, start });
  }

  if (matches.length === 0) {
    return description;
  }

  let formatted = "";
  let cursor = 0;

  for (const match of matches) {
    formatted += `${description.slice(cursor, match.start)}\n\n${description.slice(match.start, match.end)}\n\n`;
    cursor = match.end;
  }

  return formatted + description.slice(cursor);
}

function buildSerpApiGoogleJobsUrl(
  baseUrl: string,
  query: string,
  apiKey: string,
  market: SerpApiMarket,
  nextPageToken?: string
) {
  const url = new URL(baseUrl);

  url.searchParams.set("engine", "google_jobs");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("google_domain", market.googleDomain);
  url.searchParams.set("gl", market.gl);
  url.searchParams.set("hl", market.hl);
  url.searchParams.set("output", "json");

  if (market.location) {
    url.searchParams.set("location", market.location);
  }

  if (process.env.JOB_SERPAPI_LRAD) {
    url.searchParams.set("lrad", process.env.JOB_SERPAPI_LRAD);
  }

  if (process.env.JOB_SERPAPI_NO_CACHE) {
    url.searchParams.set("no_cache", process.env.JOB_SERPAPI_NO_CACHE);
  }

  if (nextPageToken) {
    url.searchParams.set("next_page_token", nextPageToken);
  }

  return url.toString();
}

function getSerpApiMarkets(): SerpApiMarket[] {
  const configuredCountries = getCsvConfig("JOB_SERPAPI_COUNTRIES", []);

  if (configuredCountries.length === 0) {
    return [{
      code: process.env.JOB_SERPAPI_GL ?? "us",
      currency: "USD",
      gl: process.env.JOB_SERPAPI_GL ?? "us",
      googleDomain: process.env.JOB_SERPAPI_GOOGLE_DOMAIN ?? "google.com",
      hl: process.env.JOB_SERPAPI_HL ?? "en",
      location: process.env.JOB_SERPAPI_LOCATION
    }];
  }

  return Array.from(new Set(configuredCountries.map((country) => country.toLowerCase())))
    .map((country) => {
      const market = serpApiMarketPresets[country as keyof typeof serpApiMarketPresets];

      if (!market) {
        throw new Error(`Unsupported JOB_SERPAPI_COUNTRIES entry: ${country}`);
      }

      return market;
    });
}

function getSerpApiGoogleJobsApplyUrl(raw: SerpApiGoogleJob) {
  return (raw.apply_options ?? [])
    .map((option) => cleanUrl(option.link))
    .find(Boolean);
}

function getSerpApiGoogleJobsPostedAt(raw: SerpApiGoogleJob, fetchedAt: Date) {
  const detected = cleanText(raw.detected_extensions?.posted_at);
  const extension = (raw.extensions ?? [])
    .map(cleanText)
    .find((value) => /ago|today|yesterday/i.test(value));

  return parseRelativeAgeDate(detected || extension, fetchedAt) ?? fetchedAt.toISOString();
}

function getSerpApiGoogleJobsSalary(raw: SerpApiGoogleJob, marketCurrency: string) {
  const label = cleanText(raw.detected_extensions?.salary)
    || (raw.extensions ?? []).map(cleanText).find((value) => /[$€£]/.test(value));

  if (!label) {
    return undefined;
  }

  const numericSalary = extractSalaryFromText(
    label
      .replace(/\b(?:AUD|CHF|EUR|GBP|USD)\b/gi, "")
      .replace(/(?:A|US)\$/gi, "$")
      .replace(/[€£]/g, "$")
  );

  return {
    ...(numericSalary?.min ? { min: numericSalary.min } : {}),
    ...(numericSalary?.max ? { max: numericSalary.max } : {}),
    currency: getSerpApiSalaryCurrency(label, marketCurrency),
    label
  };
}

function getSerpApiSalaryCurrency(label: string, marketCurrency: string) {
  if (/A\$|\bAUD\b/i.test(label)) return "AUD";
  if (/\bCHF\b/i.test(label)) return "CHF";
  if (/€|\bEUR\b/i.test(label)) return "EUR";
  if (/£|\bGBP\b/i.test(label)) return "GBP";
  if (/US\$|\bUSD\b/i.test(label)) return "USD";
  return marketCurrency;
}

function inferSerpApiGoogleJobsWorkplace(raw: SerpApiGoogleJob): Workplace | undefined {
  return raw.detected_extensions?.work_from_home ? "Remote" : undefined;
}

function normalizeSerpApiGoogleJobsEmploymentType(raw: SerpApiGoogleJob) {
  const schedule = cleanText(raw.detected_extensions?.schedule_type)
    || (raw.extensions ?? []).map(cleanText).find((value) => /full-time|part-time|contract|temporary|intern/i.test(value));

  return normalizeEmploymentTypeLabel(schedule);
}
