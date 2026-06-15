import {
  getPostedAgeDays,
  getSalarySortValue,
  getSearchText,
  platformOptions,
  roleFamilyOptions,
  seniorityOptions,
  toolOptions
} from "@/lib/jobs";
import type {
  EndpointTool,
  Job,
  Platform,
  RoleFamily,
  Seniority
} from "@/types/job";

export type SortKey = "newest" | "salary" | "company";
export type SeniorityFilter = "All" | Seniority;
export type RoleFamilyFilter = "All" | RoleFamily;
export type FreshnessFilter = "Any" | "7" | "14" | "30";

export type FilterState = {
  query: string;
  selectedPlatforms: Platform[];
  selectedTools: EndpointTool[];
  remoteOnly: boolean;
  salaryOnly: boolean;
  seniority: SeniorityFilter;
  roleFamily: RoleFamilyFilter;
  freshness: FreshnessFilter;
  sort: SortKey;
};

export type FilterAction =
  | { type: "setQuery"; value: string }
  | { type: "togglePlatform"; value: Platform }
  | { type: "toggleTool"; value: EndpointTool }
  | { type: "toggleRemoteOnly" }
  | { type: "toggleSalaryOnly" }
  | { type: "setSeniority"; value: SeniorityFilter }
  | { type: "setRoleFamily"; value: RoleFamilyFilter }
  | { type: "setFreshness"; value: FreshnessFilter }
  | { type: "setSort"; value: SortKey }
  | { type: "replace"; value: FilterState }
  | { type: "clear" };

export type FilterDispatch = (action: FilterAction) => void;

export type ActiveFilterItem = {
  clearAction: FilterAction;
  id: string;
  label: string;
  variant?: "salary";
};

const filterSearchParamKeys = [
  "q",
  "platforms",
  "tools",
  "remote",
  "salary",
  "seniority",
  "family",
  "freshness",
  "sort"
];

export const initialFilterState: FilterState = {
  query: "",
  selectedPlatforms: [],
  selectedTools: [],
  remoteOnly: false,
  salaryOnly: false,
  seniority: "All",
  roleFamily: "All",
  freshness: "Any",
  sort: "newest"
};

export const freshnessFilterOptions: {
  value: FreshnessFilter;
  label: string;
}[] = [
  { value: "Any", label: "Any active listing" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" }
];

export const sortOptions: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "salary", label: "Compensation" },
  { value: "company", label: "Company" }
];

export function filterReducer(
  state: FilterState,
  action: FilterAction
): FilterState {
  switch (action.type) {
    case "setQuery":
      return { ...state, query: action.value };
    case "togglePlatform":
      return {
        ...state,
        selectedPlatforms: toggleValue(state.selectedPlatforms, action.value)
      };
    case "toggleTool":
      return {
        ...state,
        selectedTools: toggleValue(state.selectedTools, action.value)
      };
    case "toggleRemoteOnly":
      return { ...state, remoteOnly: !state.remoteOnly };
    case "toggleSalaryOnly":
      return { ...state, salaryOnly: !state.salaryOnly };
    case "setSeniority":
      return { ...state, seniority: action.value };
    case "setRoleFamily":
      return { ...state, roleFamily: action.value };
    case "setFreshness":
      return { ...state, freshness: action.value };
    case "setSort":
      return { ...state, sort: action.value };
    case "replace":
      return action.value;
    case "clear":
      return initialFilterState;
  }
}

export function filterJobs(jobs: Job[], filters: FilterState) {
  const normalizedQuery = filters.query.trim().toLowerCase();

  return jobs
    .filter((job) => {
      if (normalizedQuery && !getSearchText(job).includes(normalizedQuery)) {
        return false;
      }

      if (
        filters.selectedPlatforms.length > 0 &&
        !filters.selectedPlatforms.some((platform) =>
          job.platforms.includes(platform)
        )
      ) {
        return false;
      }

      if (
        filters.selectedTools.length > 0 &&
        !filters.selectedTools.some((tool) => job.tools.includes(tool))
      ) {
        return false;
      }

      if (filters.remoteOnly && job.workplace !== "Remote") {
        return false;
      }

      if (filters.salaryOnly && !hasSalaryRange(job)) {
        return false;
      }

      if (filters.seniority !== "All" && job.seniority !== filters.seniority) {
        return false;
      }

      if (
        filters.roleFamily !== "All" &&
        job.roleFamily !== filters.roleFamily
      ) {
        return false;
      }

      if (
        filters.freshness !== "Any" &&
        getPostedAgeDays(job.postedAt) > Number(filters.freshness)
      ) {
        return false;
      }

      return true;
    })
    .sort((first, second) => sortJobs(first, second, filters.sort));
}

export function getActiveFilterItems(filters: FilterState): ActiveFilterItem[] {
  const items: ActiveFilterItem[] = [];
  const query = filters.query.trim();

  if (query) {
    items.push({
      clearAction: { type: "setQuery", value: "" },
      id: "query",
      label: `Search: ${query}`
    });
  }

  if (filters.remoteOnly) {
    items.push({
      clearAction: { type: "toggleRemoteOnly" },
      id: "remote",
      label: "Remote"
    });
  }

  if (filters.salaryOnly) {
    items.push({
      clearAction: { type: "toggleSalaryOnly" },
      id: "salary",
      label: "Salary shown",
      variant: "salary"
    });
  }

  if (filters.roleFamily !== "All") {
    items.push({
      clearAction: { type: "setRoleFamily", value: "All" },
      id: "family",
      label: filters.roleFamily
    });
  }

  if (filters.freshness !== "Any") {
    items.push({
      clearAction: { type: "setFreshness", value: "Any" },
      id: "freshness",
      label: getFreshnessFilterLabel(filters.freshness)
    });
  }

  if (filters.seniority !== "All") {
    items.push({
      clearAction: { type: "setSeniority", value: "All" },
      id: "seniority",
      label: filters.seniority
    });
  }

  if (filters.sort !== "newest") {
    items.push({
      clearAction: { type: "setSort", value: "newest" },
      id: "sort",
      label: `Sort: ${getSortFilterLabel(filters.sort)}`
    });
  }

  for (const platform of filters.selectedPlatforms) {
    items.push({
      clearAction: { type: "togglePlatform", value: platform },
      id: `platform:${platform}`,
      label: platform
    });
  }

  for (const tool of filters.selectedTools) {
    items.push({
      clearAction: { type: "toggleTool", value: tool },
      id: `tool:${tool}`,
      label: tool
    });
  }

  return items;
}

export function filterStateFromSearchParams(
  searchParams: URLSearchParams
): FilterState {
  return {
    query: searchParams.get("q") ?? "",
    selectedPlatforms: parseMultiFilter(
      searchParams.get("platforms"),
      platformOptions
    ),
    selectedTools: parseMultiFilter(searchParams.get("tools"), toolOptions),
    remoteOnly: searchParams.get("remote") === "1",
    salaryOnly: searchParams.get("salary") === "1",
    seniority: toSeniorityFilter(searchParams.get("seniority") ?? "All"),
    roleFamily: toRoleFamilyFilter(searchParams.get("family") ?? "All"),
    freshness: toFreshnessFilter(searchParams.get("freshness") ?? "Any"),
    sort: toSortKey(searchParams.get("sort") ?? "newest")
  };
}

function filterStateToSearchParams(filters: FilterState) {
  const searchParams = new URLSearchParams();
  const query = filters.query.trim();

  if (query) searchParams.set("q", query);
  if (filters.selectedPlatforms.length > 0) {
    searchParams.set("platforms", filters.selectedPlatforms.join(","));
  }
  if (filters.selectedTools.length > 0) {
    searchParams.set("tools", filters.selectedTools.join(","));
  }
  if (filters.remoteOnly) searchParams.set("remote", "1");
  if (filters.salaryOnly) searchParams.set("salary", "1");
  if (filters.seniority !== "All") searchParams.set("seniority", filters.seniority);
  if (filters.roleFamily !== "All") searchParams.set("family", filters.roleFamily);
  if (filters.freshness !== "Any") searchParams.set("freshness", filters.freshness);
  if (filters.sort !== "newest") searchParams.set("sort", filters.sort);

  return searchParams;
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
    nextSearchParams.set(key, value);
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

export function toSortKey(value: string): SortKey {
  if (value === "salary" || value === "company") {
    return value;
  }

  return "newest";
}

function getFreshnessFilterLabel(value: FreshnessFilter) {
  return freshnessFilterOptions.find((option) => option.value === value)?.label ??
    "Freshness";
}

function getSortFilterLabel(value: SortKey) {
  return sortOptions.find((option) => option.value === value)?.label ?? value;
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

function hasSalaryRange(job: Job) {
  return (
    typeof job.salary?.min === "number" &&
    typeof job.salary.max === "number"
  );
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function sortJobs(first: Job, second: Job, sort: SortKey) {
  if (sort === "salary") {
    return getSalarySortValue(second) - getSalarySortValue(first);
  }

  if (sort === "company") {
    return first.company.localeCompare(second.company);
  }

  return new Date(second.postedAt).getTime() - new Date(first.postedAt).getTime();
}
