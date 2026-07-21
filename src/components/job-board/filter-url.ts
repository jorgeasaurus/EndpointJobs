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
import { isMinimumSalaryFilter, metroAreaOptions } from "./filter-model";

type FilterParamDescriptor<Key extends keyof FilterState = keyof FilterState> = {
  [K in keyof FilterState]: {
    key: K;
    param: string;
    parse: (value: string | null) => FilterState[K];
    serialize: (value: FilterState[K]) => string;
    isDefault: (value: FilterState[K]) => boolean;
  };
}[Key];

function defineFilterParamDescriptor<Key extends keyof FilterState>(
  descriptor: FilterParamDescriptor<Key>
): FilterParamDescriptor<Key> {
  return descriptor;
}

const parseTextFilter = (value: string | null) => value ?? "";

const parseFlagFilter = (value: string | null) => value === "1";

const serializeFlagFilter = (value: boolean) => (value ? "1" : "0");

const isEmptyText = (value: string) => !hasFilterText(value);

const isEmptyList = (value: readonly string[]) => value.length === 0;

const filterParamDescriptors: FilterParamDescriptor[] = [
  defineFilterParamDescriptor({
    key: "query",
    param: "q",
    parse: parseTextFilter,
    serialize: (value) => value,
    isDefault: isEmptyText
  }),
  defineFilterParamDescriptor({
    key: "locationQuery",
    param: "location",
    parse: parseTextFilter,
    serialize: (value) => value,
    isDefault: isEmptyText
  }),
  defineFilterParamDescriptor({
    key: "selectedPlatforms",
    param: "platforms",
    parse: (value) => parseMultiFilter(value, platformOptions),
    serialize: (value) => value.join(","),
    isDefault: isEmptyList
  }),
  defineFilterParamDescriptor({
    key: "selectedTools",
    param: "tools",
    parse: (value) => parseMultiFilter(value, toolOptions),
    serialize: (value) => value.join(","),
    isDefault: isEmptyList
  }),
  defineFilterParamDescriptor({
    key: "selectedMetroAreas",
    param: "metroAreas",
    parse: (value) => parseMultiFilter(value, metroAreaOptions, "|"),
    serialize: (value) => value.join("|"),
    isDefault: isEmptyList
  }),
  defineFilterParamDescriptor({
    key: "workplace",
    param: "workplace",
    parse: (value) => toWorkplaceFilter(value ?? "Any"),
    serialize: (value) => value,
    isDefault: (value) => value === "Any"
  }),
  defineFilterParamDescriptor({
    key: "salaryOnly",
    param: "salary",
    parse: parseFlagFilter,
    serialize: serializeFlagFilter,
    isDefault: (value) => !value
  }),
  defineFilterParamDescriptor({
    key: "leadershipOnly",
    param: "leadership",
    parse: parseFlagFilter,
    serialize: serializeFlagFilter,
    isDefault: (value) => !value
  }),
  defineFilterParamDescriptor({
    key: "minimumSalary",
    param: "minSalary",
    parse: (value) => toMinimumSalaryFilter(value ?? "Any"),
    serialize: (value) => value,
    isDefault: (value) => value === "Any"
  }),
  defineFilterParamDescriptor({
    key: "seniority",
    param: "seniority",
    parse: (value) => toSeniorityFilter(value ?? "All"),
    serialize: (value) => value,
    isDefault: (value) => value === "All"
  }),
  defineFilterParamDescriptor({
    key: "roleFamily",
    param: "family",
    parse: (value) => toRoleFamilyFilter(value ?? "All"),
    serialize: (value) => value,
    isDefault: (value) => value === "All"
  }),
  defineFilterParamDescriptor({
    key: "freshness",
    param: "freshness",
    parse: (value) => toFreshnessFilter(value ?? "Any"),
    serialize: (value) => value,
    isDefault: (value) => value === "Any"
  }),
  defineFilterParamDescriptor({
    key: "sort",
    param: "sort",
    parse: (value) => toSortKey(value ?? "newest"),
    serialize: (value) => value,
    isDefault: (value) => value === "newest"
  })
];

const currentFilterSearchParamKeys = filterParamDescriptors.map(
  ({ param }) => param
);

const legacyFilterSearchParamKeys = ["locations", "remote"];
const filterSearchParamKeys = [
  ...currentFilterSearchParamKeys,
  ...legacyFilterSearchParamKeys
];

export function filterStateFromSearchParams(
  searchParams: URLSearchParams
): FilterState {
  let filters = {} as FilterState;

  for (const descriptor of filterParamDescriptors) {
    filters = applyFilterParamDescriptor(filters, descriptor, searchParams);
  }

  if (searchParams.get("remote") === "1" && !searchParams.has("workplace")) {
    filters.workplace = toWorkplaceFilter("Remote");
  }

  return filters;
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

function applyFilterParamDescriptor<Key extends keyof FilterState>(
  filters: FilterState,
  descriptor: FilterParamDescriptor<Key>,
  searchParams: URLSearchParams
): FilterState {
  return {
    ...filters,
    [descriptor.key]: descriptor.parse(searchParams.get(descriptor.param))
  };
}

function applyFilterParamSerializer<Key extends keyof FilterState>(
  searchParams: URLSearchParams,
  filters: FilterState,
  descriptor: FilterParamDescriptor<Key>
) {
  const value = filters[descriptor.key];

  if (!descriptor.isDefault(value)) {
    searchParams.set(descriptor.param, descriptor.serialize(value));
  }
}

function filterStateToSearchParams(filters: FilterState) {
  const searchParams = new URLSearchParams();

  for (const descriptor of filterParamDescriptors) {
    applyFilterParamSerializer(searchParams, filters, descriptor);
  }

  return searchParams;
}

function hasFilterText(value: string) {
  return value.trim().length > 0;
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

  return value
    .split(separator)
    .map((item) => item.trim())
    .filter((item): item is T => allowedValues.has(item));
}
