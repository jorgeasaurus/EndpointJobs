import type { Job, Seniority, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
  getCsvConfig,
  normalizeEmploymentTypeLabel,
  normalizeSalary,
  parseDateLike,
  summarize,
  toEndpointJob
} from "../shared";

type AiDevBoardJob = {
  id?: string;
  title?: string;
  company_name?: string;
  description?: string;
  requirements?: string;
  location?: string;
  workplace?: "remote" | "hybrid" | "onsite" | string;
  job_type?: string;
  experience_level?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  tags?: string[];
  apply_url?: string;
  slug?: string;
  created_at?: string;
  published_at?: string;
  expires_at?: string;
  url?: string;
};

type AiDevBoardPage = {
  jobs: AiDevBoardJob[];
  hasNext: boolean;
};

const defaultAiDevBoardQueries = [
  "client platform",
  "endpoint",
  "endpoint security",
  "intune",
  "jamf",
  "macOS",
  "windows endpoint",
  "device management",
  "digital workplace",
  "IT systems"
];

export const aiDevBoardProvider: ProviderAdapter<"aidevboard"> = {
  id: "aidevboard",
  displayName: "AI Dev Board",
  defaultUrl: "https://aidevboard.com/api/v1/jobs",
  fetchJobs: ({ url, fetchedAt }) => fetchAiDevBoardJobs(url, fetchedAt)
};

async function fetchAiDevBoardJobs(url: string, fetchedAt: Date) {
  const apiKey = process.env.AIDEVBOARD_API_KEY ?? process.env.JOB_AIDEVBOARD_API_KEY;

  if (!apiKey && process.env.JOB_AIDEVBOARD_REQUIRE_API_KEY === "true") {
    throw new Error("AIDEVBOARD_API_KEY is required");
  }

  const queries = getCsvConfig("JOB_AIDEVBOARD_QUERIES", defaultAiDevBoardQueries);
  const maxPages = Math.max(1, Number(process.env.JOB_AIDEVBOARD_MAX_PAGES ?? 1));
  const limit = Math.min(
    50,
    Math.max(1, Number(process.env.JOB_AIDEVBOARD_LIMIT ?? 20))
  );
  const jobs: Array<Job | null> = [];

  for (const query of queries) {
    for (let page = 1; page <= maxPages; page += 1) {
      const queryUrl = buildAiDevBoardUrl(url, query, limit, page);
      const payload = await fetchAiDevBoardPage(queryUrl, apiKey);
      const normalized = payload.jobs.map((job) =>
        normalizeAiDevBoardJob(job, query, fetchedAt)
      );

      jobs.push(...normalized);
      console.log(`Fetched ${payload.jobs.length} raw jobs from AI Dev Board query ${query} page ${page}`);

      if (!payload.hasNext || payload.jobs.length < limit) {
        break;
      }
    }
  }

  return jobs;
}

function buildAiDevBoardUrl(
  baseUrl: string,
  query: string,
  limit: number,
  page: number
) {
  const url = new URL(baseUrl);

  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));

  setOptionalSearchParam(url, "tags", process.env.JOB_AIDEVBOARD_TAGS);
  setOptionalSearchParam(url, "location", process.env.JOB_AIDEVBOARD_LOCATION);
  setOptionalSearchParam(url, "workplace", process.env.JOB_AIDEVBOARD_WORKPLACE);
  setOptionalSearchParam(url, "type", process.env.JOB_AIDEVBOARD_TYPE);
  setOptionalSearchParam(url, "level", process.env.JOB_AIDEVBOARD_LEVEL);
  setOptionalSearchParam(url, "salary_min", process.env.JOB_AIDEVBOARD_SALARY_MIN);
  setOptionalSearchParam(url, "salary_max", process.env.JOB_AIDEVBOARD_SALARY_MAX);
  setOptionalSearchParam(url, "salary_floor_min", process.env.JOB_AIDEVBOARD_SALARY_FLOOR_MIN);
  setOptionalSearchParam(url, "posted_within_days", process.env.JOB_AIDEVBOARD_POSTED_WITHIN_DAYS);

  return url.toString();
}

function setOptionalSearchParam(url: URL, key: string, value: string | undefined) {
  if (value) {
    url.searchParams.set(key, value);
  }
}

async function fetchAiDevBoardPage(
  url: string,
  apiKey: string | undefined
): Promise<AiDevBoardPage> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "EndpointJobs/1.0 (+https://github.com/jorgeasaurus/EndpointJobs)"
  };

  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const detail = summarize(cleanText(await response.text()));
    throw new Error(
      `AI Dev Board request failed: ${response.status} ${response.statusText}${
        detail ? ` - ${detail}` : ""
      }`
    );
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object") {
    throw new Error("AI Dev Board response was not an object");
  }

  const candidate = json as { jobs?: unknown; has_next?: unknown };

  if (!Array.isArray(candidate.jobs)) {
    throw new Error("AI Dev Board response did not include a jobs array");
  }

  return {
    jobs: candidate.jobs.filter(isAiDevBoardJob),
    hasNext: candidate.has_next === true
  };
}

function isAiDevBoardJob(value: unknown): value is AiDevBoardJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const job = value as AiDevBoardJob;
  return Boolean(job.id && job.title && job.company_name && (job.apply_url || job.url));
}

function normalizeAiDevBoardJob(
  raw: AiDevBoardJob,
  query: string,
  fetchedAt: Date
) {
  const title = cleanText(raw.title);
  const company = cleanText(raw.company_name);
  const sourceJobUrl = getAiDevBoardSourceUrl(raw);
  const applyUrl = cleanUrl(raw.apply_url) ?? sourceJobUrl;

  if (!title || !company || !sourceJobUrl || !applyUrl) {
    return null;
  }

  const description = [raw.description, raw.requirements]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("\n\n");
  const sourceTags = [
    query,
    raw.job_type,
    raw.experience_level,
    raw.workplace,
    ...(raw.tags ?? [])
  ].map(cleanText).filter(Boolean);
  const expiresAt = parseDateLike(raw.expires_at);

  return toEndpointJob({
    id: buildStableJobId("aidevboard", company, title, sourceJobUrl),
    title,
    company,
    location: raw.location,
    workplace: normalizeAiDevBoardWorkplace(raw.workplace),
    postedAt: parseDateLike(raw.published_at ?? raw.created_at) ?? fetchedAt.toISOString(),
    fetchedAt,
    staleAfter: expiresAt,
    source: "AI Dev Board",
    sourceUrl: sourceJobUrl,
    applyUrl,
    attributionLabel: "AI Dev Board",
    termsProfile: "public-api",
    description,
    sourceTags,
    salary: normalizeSalary(
      normalizeAiDevBoardSalaryAmount(raw.salary_min),
      normalizeAiDevBoardSalaryAmount(raw.salary_max)
    ),
    seniority: normalizeAiDevBoardSeniority(raw.experience_level),
    employmentType: normalizeEmploymentTypeLabel(raw.job_type)
  });
}

function getAiDevBoardSourceUrl(raw: AiDevBoardJob) {
  return cleanUrl(raw.url)
    ?? (raw.id ? `https://aidevboard.com/job/${raw.id}` : undefined);
}

function normalizeAiDevBoardWorkplace(value: string | undefined): Workplace | undefined {
  switch (value) {
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    case "onsite":
      return "On-site";
    default:
      return undefined;
  }
}

function normalizeAiDevBoardSeniority(value: string | undefined): Seniority | undefined {
  switch (value) {
    case "junior":
      return "Associate";
    case "mid":
      return "Mid";
    case "senior":
      return "Senior";
    case "lead":
      return "Lead";
    case "principal":
      return "Staff";
    default:
      return undefined;
  }
}

function normalizeAiDevBoardSalaryAmount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
