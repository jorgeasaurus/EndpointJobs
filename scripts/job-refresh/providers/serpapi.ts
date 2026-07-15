import type { Job, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import { defaultCompanyJobQueries, defaultEndpointSearchQueries } from "../search-config";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
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
      let payload: SerpApiGoogleJobsPage;

      try {
        payload = await fetchSerpApiGoogleJobsPage(queryUrl);
      } catch (error) {
        const usableJobCount = jobs.filter(Boolean).length;

        if (usableJobCount === 0) {
          throw error;
        }

        console.warn(
          `Returning ${usableJobCount} partial SerpAPI jobs after query ${query} page ${page} failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return jobs;
      }

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

export function normalizeSerpApiGoogleJob(raw: SerpApiGoogleJob, query: string, fetchedAt: Date) {
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
    description: restoreSerpApiDescriptionStructure(raw),
    sourceTags,
    haystackParts: [raw.via],
    salary: getSerpApiGoogleJobsSalary(raw),
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

  return normalizeEmploymentTypeLabel(schedule);
}
