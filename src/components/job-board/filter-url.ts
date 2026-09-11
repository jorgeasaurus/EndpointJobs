import {
  platformOptions,
  roleFamilyOptions,
  seniorityOptions,
  toolOptions
} from "@/lib/jobs";
import { isFreshnessFilter } from "@/lib/job-filters";
import { getEndpointToolBySlug, getEndpointToolSlug } from "@/lib/job-taxonomy";

import type {
  FilterState,
  FreshnessFilter,
  MinimumSalaryFilter,
  RoleFamilyFilter,
  SeniorityFilter,
  SortKey,
  WorkplaceFilter
} from "./filter-model";
import { isMinimumSalaryFilter, metroAreaOptions } from "./filter-model";

const filterParams = {
  query: "q",
  locationQuery: "location",
  selectedPlatforms: "platforms",
  selectedTools: "tools",
  selectedMetroAreas: "metroAreas",
  workplace: "workplace",
  salaryOnly: "salary",
  leadershipOnly: "leadership",
  minimumSalary: "minSalary",
  seniority: "seniority",
  roleFamily: "family",
  freshness: "freshness",
  sort: "sort"
} satisfies Record<keyof FilterState, string>;

const currentFilterSearchParamKeys = Object.values(filterParams);

const legacyFilterSearchParamKeys = ["locations", "remote"];
const filterSearchParamKeys = [
  ...currentFilterSearchParamKeys,
  ...legacyFilterSearchParamKeys
];

export function getBoardPathnameForFilters(filters: FilterState) {
  if (filters.selectedTools.length === 1) {
    return `/${getEndpointToolSlug(filters.selectedTools[0])}`;
  }

  return "/";
}

export function filterStateFromLocation(
  pathname: string,
  searchParams: URLSearchParams
): FilterState {
  const filters = filterStateFromSearchParams(searchParams);
  const segment = pathname.replace(/^\/+|\/+$/g, "");

  if (!segment || segment.includes("/")) {
    return filters;
  }

  const pathTool = getEndpointToolBySlug(segment);

  if (!pathTool || filters.selectedTools.includes(pathTool)) {
    return filters;
  }

  return {
    ...filters,
    selectedTools: [pathTool, ...filters.selectedTools]
  };
}

export function filterStateFromSearchParams(
  searchParams: URLSearchParams
): FilterState {
  const workplace = searchParams.get(filterParams.workplace);

  return {
    query: searchParams.get(filterParams.query) ?? "",
    locationQuery: searchParams.get(filterParams.locationQuery) ?? "",
    selectedPlatforms: parseMultiFilter(searchParams.get(filterParams.selectedPlatforms), platformOptions),
    selectedTools: parseMultiFilter(searchParams.get(filterParams.selectedTools), toolOptions),
    selectedMetroAreas: parseMultiFilter(searchParams.get(filterParams.selectedMetroAreas), metroAreaOptions, "|"),
    workplace: toWorkplaceFilter(workplace ?? (searchParams.get("remote") === "1" ? "Remote" : "Any")),
    salaryOnly: searchParams.get(filterParams.salaryOnly) === "1",
    leadershipOnly: searchParams.get(filterParams.leadershipOnly) === "1",
    minimumSalary: toMinimumSalaryFilter(searchParams.get(filterParams.minimumSalary) ?? "Any"),
    seniority: toSeniorityFilter(searchParams.get(filterParams.seniority) ?? "All"),
    roleFamily: toRoleFamilyFilter(searchParams.get(filterParams.roleFamily) ?? "All"),
    freshness: toFreshnessFilter(searchParams.get(filterParams.freshness) ?? "Any"),
    sort: toSortKey(searchParams.get(filterParams.sort) ?? "newest")
  };
}

export function mergeFilterStateIntoSearchParams(
  currentSearchParams: URLSearchParams,
  filters: FilterState
) {
  const nextSearchParams = new URLSearchParams(currentSearchParams);
  const filterSearchParams = filterStateToSearchParams(filters);

  for (const key of filterSearchParamKeys) {
    nextSearchParams.delete(key);
  }

  filterSearchParams.forEach((value, key) => {
    nextSearchParams.append(key, value);
  });

  return nextSearchParams;
}

export function toSeniorityFilter(value: string): SeniorityFilter {
  if (value === "All") {
    return "All";
  }

  return seniorityOptions.find((level) => level === value) ?? "All";
}

export function toRoleFamilyFilter(value: string): RoleFamilyFilter {
  if (value === "All") {
    return "All";
  }

  return roleFamilyOptions.find((family) => family === value) ?? "All";
}

export function toFreshnessFilter(value: string): FreshnessFilter {
  return isFreshnessFilter(value) ? value : "Any";
}

export function toWorkplaceFilter(value: string): WorkplaceFilter {
  if (value === "Remote" || value === "Hybrid" || value === "On-site") {
    return value;
  }

  return "Any";
}

export function toMinimumSalaryFilter(value: string): MinimumSalaryFilter {
  return isMinimumSalaryFilter(value) ? value : "Any";
}

export function toSortKey(value: string): SortKey {
  if (value === "salary" || value === "company") {
    return value;
  }

  return "newest";
}

function filterStateToSearchParams(filters: FilterState) {
  const values = {
    query: filters.query.trim() ? filters.query : "",
    locationQuery: filters.locationQuery.trim() ? filters.locationQuery : "",
    selectedPlatforms: filters.selectedPlatforms.join(","),
    selectedTools: filters.selectedTools.length === 1 ? "" : filters.selectedTools.join(","),
    selectedMetroAreas: filters.selectedMetroAreas.join("|"),
    workplace: filters.workplace === "Any" ? "" : filters.workplace,
    salaryOnly: filters.salaryOnly ? "1" : "",
    leadershipOnly: filters.leadershipOnly ? "1" : "",
    minimumSalary: filters.minimumSalary === "Any" ? "" : filters.minimumSalary,
    seniority: filters.seniority === "All" ? "" : filters.seniority,
    roleFamily: filters.roleFamily === "All" ? "" : filters.roleFamily,
    freshness: filters.freshness === "Any" ? "" : filters.freshness,
    sort: filters.sort === "newest" ? "" : filters.sort
  } satisfies Record<keyof FilterState, string>;
  const searchParams = new URLSearchParams();

  for (const key of Object.keys(filterParams) as (keyof FilterState)[]) {
    if (values[key]) {
      searchParams.set(filterParams[key], values[key]);
    }
  }

  return searchParams;
}

function parseMultiFilter<T extends string>(
  value: string | null,
  options: readonly T[],
  separator = ","
) {
  if (!value) {
    return [];
  }

  const allowedValues = new Set<string>(options);

  return [...new Set(value
    .split(separator)
    .map((item) => item.trim())
    .filter((item): item is T => allowedValues.has(item)))];
}
