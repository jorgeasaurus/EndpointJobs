import {
  platformOptions,
  roleFamilyOptions,
  seniorityOptions,
  toolOptions
} from "@/lib/jobs";

import type {
  FilterState,
  FreshnessFilter,
  RoleFamilyFilter,
  SeniorityFilter,
  SortKey,
  WorkplaceFilter
} from "./filter-model";

const filterSearchParamKeys = [
  "q",
  "platforms",
  "tools",
  "location",
  "locations",
  "workplace",
  "remote",
  "salary",
  "seniority",
  "family",
  "freshness",
  "sort"
];

export function filterStateFromSearchParams(
  searchParams: URLSearchParams
): FilterState {
  const legacyWorkplace = searchParams.get("remote") === "1" ? "Remote" : "Any";

  return {
    query: searchParams.get("q") ?? "",
    locationQuery: searchParams.get("location") ?? "",
    selectedLocations: parseLocationFilters(searchParams.getAll("locations")),
    selectedPlatforms: parseMultiFilter(
      searchParams.get("platforms"),
      platformOptions
    ),
    selectedTools: parseMultiFilter(searchParams.get("tools"), toolOptions),
    workplace: toWorkplaceFilter(searchParams.get("workplace") ?? legacyWorkplace),
    salaryOnly: searchParams.get("salary") === "1",
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
  if (value === "7" || value === "14" || value === "30") {
    return value;
  }

  return "Any";
}

export function toWorkplaceFilter(value: string): WorkplaceFilter {
  if (value === "Remote" || value === "Hybrid" || value === "On-site") {
    return value;
  }

  return "Any";
}

export function toSortKey(value: string): SortKey {
  if (value === "salary" || value === "company") {
    return value;
  }

  return "newest";
}

function filterStateToSearchParams(filters: FilterState) {
  const searchParams = new URLSearchParams();
  const query = filters.query.trim();
  const locationQuery = filters.locationQuery.trim();

  if (query) searchParams.set("q", query);
  if (locationQuery) searchParams.set("location", locationQuery);
  for (const location of filters.selectedLocations) {
    searchParams.append("locations", location);
  }
  if (filters.selectedPlatforms.length > 0) {
    searchParams.set("platforms", filters.selectedPlatforms.join(","));
  }
  if (filters.selectedTools.length > 0) {
    searchParams.set("tools", filters.selectedTools.join(","));
  }
  if (filters.workplace !== "Any") searchParams.set("workplace", filters.workplace);
  if (filters.salaryOnly) searchParams.set("salary", "1");
  if (filters.seniority !== "All") searchParams.set("seniority", filters.seniority);
  if (filters.roleFamily !== "All") searchParams.set("family", filters.roleFamily);
  if (filters.freshness !== "Any") searchParams.set("freshness", filters.freshness);
  if (filters.sort !== "newest") searchParams.set("sort", filters.sort);

  return searchParams;
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

function parseLocationFilters(values: string[]) {
  const locations: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const location = normalizeLocationParam(value);

    if (!location || seen.has(location)) {
      continue;
    }

    seen.add(location);
    locations.push(location);

    if (locations.length === 20) {
      break;
    }
  }

  return locations;
}

function normalizeLocationParam(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
