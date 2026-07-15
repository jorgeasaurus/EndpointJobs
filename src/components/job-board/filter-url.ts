import {
  platformOptions,
  roleFamilyOptions,
  seniorityOptions,
  toolOptions
} from "@/lib/jobs";
import { isFreshnessFilter } from "@/lib/job-filters";

import type {
  FilterState,
  FreshnessFilter,
  MinimumSalaryFilter,
  RoleFamilyFilter,
  SeniorityFilter,
  SortKey,
  WorkplaceFilter
} from "./filter-model";
import { isMinimumSalaryFilter } from "./filter-model";

const currentFilterSearchParamKeys = [
  "q",
  "platforms",
  "tools",
  "location",
  "workplace",
  "salary",
  "minSalary",
  "seniority",
  "family",
  "freshness",
  "sort"
];

const legacyFilterSearchParamKeys = ["locations", "remote"];
const filterSearchParamKeys = [
  ...currentFilterSearchParamKeys,
  ...legacyFilterSearchParamKeys
];

export function filterStateFromSearchParams(
  searchParams: URLSearchParams
): FilterState {
  const legacyWorkplace = searchParams.get("remote") === "1" ? "Remote" : "Any";

  return {
    query: searchParams.get("q") ?? "",
    locationQuery: searchParams.get("location") ?? "",
    selectedPlatforms: parseMultiFilter(
      searchParams.get("platforms"),
      platformOptions
    ),
    selectedTools: parseMultiFilter(searchParams.get("tools"), toolOptions),
    workplace: toWorkplaceFilter(searchParams.get("workplace") ?? legacyWorkplace),
    salaryOnly: searchParams.get("salary") === "1",
    minimumSalary: toMinimumSalaryFilter(searchParams.get("minSalary") ?? "Any"),
    seniority: toSeniorityFilter(searchParams.get("seniority") ?? "All"),
    roleFamily: toRoleFamilyFilter(searchParams.get("family") ?? "All"),
    freshness: toFreshnessFilter(searchParams.get("freshness") ?? "Any"),
    sort: toSortKey(searchParams.get("sort") ?? "newest")
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
  const searchParams = new URLSearchParams();

  if (hasFilterText(filters.query)) searchParams.set("q", filters.query);
  if (hasFilterText(filters.locationQuery)) {
    searchParams.set("location", filters.locationQuery);
  }
  if (filters.selectedPlatforms.length > 0) {
    searchParams.set("platforms", filters.selectedPlatforms.join(","));
  }
  if (filters.selectedTools.length > 0) {
    searchParams.set("tools", filters.selectedTools.join(","));
  }
  if (filters.workplace !== "Any") searchParams.set("workplace", filters.workplace);
  if (filters.salaryOnly) searchParams.set("salary", "1");
  if (filters.minimumSalary !== "Any") {
    searchParams.set("minSalary", filters.minimumSalary);
  }
  if (filters.seniority !== "All") searchParams.set("seniority", filters.seniority);
  if (filters.roleFamily !== "All") searchParams.set("family", filters.roleFamily);
  if (filters.freshness !== "Any") searchParams.set("freshness", filters.freshness);
  if (filters.sort !== "newest") searchParams.set("sort", filters.sort);

  return searchParams;
}

function hasFilterText(value: string) {
  return value.trim().length > 0;
}

function parseMultiFilter<T extends string>(
  value: string | null,
  options: readonly T[]
) {
  if (!value) {
    return [];
  }

  const allowedValues = new Set<string>(options);

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is T => allowedValues.has(item));
}
