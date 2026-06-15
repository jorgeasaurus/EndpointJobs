import type { Job, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import { defaultCompanyJobQueries, defaultEndpointSearchQueries } from "../search-config";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
  getCsvConfig,
  getString,
  normalizeSearchText,
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

type SerpApiGoogleJob = {
  title?: string;
  company_name?: string;
  location?: string;
  via?: string;
  share_link?: string;
  description?: string;
  extensions?: string[];
  detected_extensions?: SerpApiDetectedExtensions;
  apply_options?: SerpApiApplyOption[];
  job_id?: string;
};

type SerpApiGoogleJobsPage = {
  jobs: SerpApiGoogleJob[];
  nextPageToken?: string;
};

const defaultSerpApiQueries = Array.from(new Set([
  ...defaultEndpointSearchQueries,
  ...defaultCompanyJobQueries
]));
export const serpApiProvider: ProviderAdapter<"serpapi"> = {
  id: "serpapi",
  displayName: "SerpAPI Google Jobs",
  defaultUrl: "https://serpapi.com/search.json",
  fetchJobs: ({ url, fetchedAt }) => fetchSerpApiGoogleJobs(url, fetchedAt)
};

async function fetchSerpApiGoogleJobs(url: string, fetchedAt: Date) {
  const apiKey = process.env.SERPAPI_API_KEY ?? process.env.JOB_SERPAPI_API_KEY;

  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is required");
  }

  const queries = getCsvConfig("JOB_SERPAPI_QUERIES", defaultSerpApiQueries);
  const maxPages = Math.max(1, Number(process.env.JOB_SERPAPI_MAX_PAGES ?? 1));
  const jobs: Array<Job | null> = [];

  for (const query of queries) {
    let nextPageToken: string | undefined;

    for (let page = 0; page < maxPages; page += 1) {
      const queryUrl = buildSerpApiGoogleJobsUrl(url, query, apiKey, nextPageToken);
      const payload = await fetchSerpApiGoogleJobsPage(queryUrl);
      jobs.push(...payload.jobs.map((job) => normalizeSerpApiGoogleJob(job, query, fetchedAt)));
      console.log(`Fetched ${payload.jobs.length} raw jobs from SerpAPI Google Jobs query ${query} page ${page}`);

      nextPageToken = payload.nextPageToken;

      if (!nextPageToken || payload.jobs.length === 0) {
        break;
      }
    }
  }

  return jobs;
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
    throw new Error(
      `SerpAPI request failed: ${response.status} ${response.statusText}${
        detail ? ` - ${detail}` : ""
      }`
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
    throw new Error(`SerpAPI returned an error: ${cleanText(candidate.error)}`);
  }

  const jobs = Array.isArray(candidate.jobs_results)
    ? candidate.jobs_results.filter(isSerpApiGoogleJob)
    : [];

  return {
    jobs,
    nextPageToken: getString(candidate.serpapi_pagination?.next_page_token)
  };
}

function isSerpApiGoogleJob(value: unknown): value is SerpApiGoogleJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as SerpApiGoogleJob;
  return Boolean(candidate.job_id && candidate.title && candidate.company_name);
}

function normalizeSerpApiGoogleJob(raw: SerpApiGoogleJob, query: string, fetchedAt: Date) {
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
    source: "SerpAPI Google Jobs",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: "Google Jobs via SerpAPI",
    termsProfile: "partner-terms",
    description: raw.description ?? "",
    sourceTags,
    haystackParts: [raw.via],
    salary: getSerpApiGoogleJobsSalary(raw),
    employmentType: normalizeSerpApiGoogleJobsEmploymentType(raw)
  });
}

function buildSerpApiGoogleJobsUrl(
  baseUrl: string,
  query: string,
  apiKey: string,
  nextPageToken?: string
) {
  const url = new URL(baseUrl);

  url.searchParams.set("engine", "google_jobs");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("google_domain", process.env.JOB_SERPAPI_GOOGLE_DOMAIN ?? "google.com");
  url.searchParams.set("gl", process.env.JOB_SERPAPI_GL ?? "us");
  url.searchParams.set("hl", process.env.JOB_SERPAPI_HL ?? "en");
  url.searchParams.set("output", "json");

  if (process.env.JOB_SERPAPI_LOCATION) {
    url.searchParams.set("location", process.env.JOB_SERPAPI_LOCATION);
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

function getSerpApiGoogleJobsSalary(raw: SerpApiGoogleJob) {
  const label = cleanText(raw.detected_extensions?.salary)
    || (raw.extensions ?? []).map(cleanText).find((value) => /[$€£]/.test(value));

  if (!label) {
    return undefined;
  }

  const currency = label.includes("€") ? "EUR" : label.includes("£") ? "GBP" : "USD";

  return { currency, label };
}

function inferSerpApiGoogleJobsWorkplace(raw: SerpApiGoogleJob): Workplace | undefined {
  return raw.detected_extensions?.work_from_home ? "Remote" : undefined;
}

function normalizeSerpApiGoogleJobsEmploymentType(raw: SerpApiGoogleJob) {
  const schedule = cleanText(raw.detected_extensions?.schedule_type)
    || (raw.extensions ?? []).map(cleanText).find((value) => /full-time|part-time|contract|temporary|intern/i.test(value));

  if (!schedule) {
    return undefined;
  }

  const normalized = normalizeSearchText(schedule);

  if (normalized.includes("contract")) return "Contract";
  if (normalized.includes("part")) return "Part-time";
  if (normalized.includes("temp")) return "Temporary";
  if (normalized.includes("intern")) return "Internship";
  if (normalized.includes("full")) return "Full-time";
  return schedule;
}
