import {
  filterJobs,
  freshnessFilterDayValues,
  minimumSalaryFilterValues,
  type JobFilters
} from "@/lib/job-filters";
import {
  jobsApiQueryContract,
  type JobsApiAppliedFilters,
  type JobsApiQueryDefinition
} from "@/lib/jobs-api-contract";
import {
  isActiveJob,
  platformOptions,
  roleFamilyOptions,
  seniorityOptions,
  toolOptions
} from "@/lib/jobs";
import { metroAreaOptions } from "@/lib/metro-areas";
import type { Job, JobsFeed } from "@/types/job";

export const jobsApiHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600"
} as const;

export type JobsApiError = {
  error: {
    code: "INVALID_QUERY" | "JOB_NOT_FOUND";
    details?: string[];
    message: string;
  };
};

export type JobsApiCollection = {
  data: Job[];
  filters: JobsApiAppliedFilters;
  meta: { limit: number; page: number; total: number; totalPages: number; updatedAt: string };
};

export type JobsApiJobResponse = { data: Job; meta: { updatedAt: string } };

export type JobsApiQueryResult =
  | { ok: true; body: JobsApiCollection }
  | { ok: false; body: JobsApiError; status: 400 };

export function queryJobs(
  feed: JobsFeed,
  searchParams: URLSearchParams,
  now = new Date()
): JobsApiQueryResult {
  const parsed = parseQuery(searchParams);
  if (!parsed.ok) {
    return { ok: false, status: 400, body: createJobsApiError("INVALID_QUERY", "One or more query parameters are invalid.", parsed.errors) };
  }

  const { page, limit, filters } = parsed;
  const filteredJobs = filterJobs(
    feed.jobs.filter((job) => isActiveJob(job, now)),
    filters,
    now
  );
  const startIndex = (page - 1) * limit;

  return {
    ok: true,
    body: {
      data: filteredJobs.slice(startIndex, startIndex + limit),
      filters: toAppliedFilters(filters),
      meta: {
        page,
        limit,
        total: filteredJobs.length,
        totalPages: Math.max(1, Math.ceil(filteredJobs.length / limit)),
        updatedAt: feed.updatedAt
      }
    }
  };
}

export function createJobsApiError(
  code: JobsApiError["error"]["code"],
  message: string,
  details?: string[]
): JobsApiError {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

export function createJobResponse(feed: JobsFeed, job: Job): JobsApiJobResponse {
  return { data: job, meta: { updatedAt: feed.updatedAt } };
}

export function findActiveJob(feed: JobsFeed, id: string, now = new Date()) {
  return feed.jobs.find((job) => job.id === id && isActiveJob(job, now));
}

export function getJobsApiHeaders(cacheable = true) {
  return { ...jobsApiHeaders, "Cache-Control": cacheable ? jobsApiHeaders["Cache-Control"] : "no-store" };
}

function parseQuery(searchParams: URLSearchParams):
  | { ok: false; errors: string[] }
  | { ok: true; filters: JobFilters; page: number; limit: number } {
  const errors: string[] = [];
  const contract = jobsApiQueryContract as Record<string, JobsApiQueryDefinition>;

  for (const key of new Set(searchParams.keys())) {
    const definition = contract[key];
    if (!definition) {
      errors.push(`Unknown parameter: ${key}`);
      continue;
    }
    if (searchParams.getAll(key).length > 1) {
      errors.push(`Parameter may only be specified once: ${key}`);
      continue;
    }
    validateValue(key, searchParams.get(key) ?? "", definition, errors);
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    page: readInteger(searchParams, "page"),
    limit: readInteger(searchParams, "limit"),
    filters: {
      query: readText(searchParams, "q"),
      locationQuery: readText(searchParams, "location"),
      selectedPlatforms: readMulti(searchParams, "platforms", platformOptions),
      selectedTools: readMulti(searchParams, "tools", toolOptions),
      selectedMetroAreas: readMulti(searchParams, "metroAreas", metroAreaOptions, "|"),
      workplace: readEnum(searchParams, "workplace", ["Remote", "Hybrid", "On-site"] as const, "Any"),
      salaryOnly: readEnum(searchParams, "salary", ["1"] as const, "0") === "1",
      leadershipOnly: readEnum(searchParams, "leadership", ["1"] as const, "0") === "1",
      minimumSalary: readEnum(searchParams, "minSalary", minimumSalaryFilterValues, "Any"),
      seniority: readEnum(searchParams, "seniority", seniorityOptions, "All"),
      roleFamily: readEnum(searchParams, "family", roleFamilyOptions, "All"),
      freshness: readEnum(searchParams, "freshness", freshnessFilterDayValues, "Any"),
      sort: readEnum(searchParams, "sort", ["newest", "salary", "company"] as const, "newest")
    }
  };
}

function validateValue(
  key: string,
  value: string,
  definition: JobsApiQueryDefinition,
  errors: string[]
) {
  const normalizedValue = value.trim();
  if (definition.kind === "text") {
    const length = normalizedValue.length;
    if (length < definition.minimumLength || length > definition.maximumLength) {
      errors.push(`${key} must contain ${definition.minimumLength}-${definition.maximumLength} characters`);
    }
    return;
  }
  if (definition.kind === "integer") {
    if (!/^[1-9]\d*$/.test(normalizedValue)) {
      errors.push(definition.maximum === undefined
        ? `${key} must be a positive integer`
        : `${key} must be an integer between ${definition.minimum} and ${definition.maximum}`);
      return;
    }
    const parsed = Number(normalizedValue);
    if (!Number.isSafeInteger(parsed) || parsed < definition.minimum || (definition.maximum !== undefined && parsed > definition.maximum)) {
      errors.push(definition.maximum === undefined
        ? `${key} must be a positive integer`
        : `${key} must be an integer between ${definition.minimum} and ${definition.maximum}`);
    }
    return;
  }
  const separator = definition.kind === "multi" ? definition.separator ?? "," : ",";
  const values = definition.kind === "multi" ? value.split(separator).map((item) => item.trim()) : [normalizedValue];
  if (values.some((item) => !item || !definition.values.includes(item as never))) {
    errors.push(definition.kind === "multi"
      ? `${key} contains an unsupported value`
      : `${key} must be one of: ${definition.values.join(", ")}`);
  }
}

function readInteger(searchParams: URLSearchParams, key: "page" | "limit") {
  return Number(searchParams.get(key)?.trim() ?? jobsApiQueryContract[key].default);
}

function readText(searchParams: URLSearchParams, key: "q" | "location") {
  return searchParams.get(key)?.trim() ?? "";
}

function readMulti<T extends string>(
  params: URLSearchParams,
  key: string,
  options: readonly T[],
  separator = ","
) {
  const selected = new Set(params.get(key)?.split(separator).map((value) => value.trim()) ?? []);
  return options.filter((option) => selected.has(option));
}

function readEnum<T extends string, F extends string>(
  params: URLSearchParams,
  key: string,
  options: readonly T[],
  fallback: F
): T | F {
  const value = params.get(key)?.trim();
  return options.find((option) => option === value) ?? fallback;
}

function toAppliedFilters(filters: JobFilters): JobsApiAppliedFilters {
  return {
    q: filters.query || null,
    platforms: filters.selectedPlatforms,
    tools: filters.selectedTools,
    metroAreas: filters.selectedMetroAreas,
    location: filters.locationQuery || null,
    workplace: filters.workplace === "Any" ? null : filters.workplace,
    salaryShown: filters.salaryOnly,
    leadership: filters.leadershipOnly,
    minSalary: filters.minimumSalary === "Any" ? null : filters.minimumSalary,
    seniority: filters.seniority === "All" ? null : filters.seniority,
    family: filters.roleFamily === "All" ? null : filters.roleFamily,
    freshness: filters.freshness === "Any" ? null : filters.freshness,
    sort: filters.sort
  };
}
