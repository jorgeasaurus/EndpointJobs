import {
  getPostedAgeDays,
  getSalarySortValue,
  getSearchText,
  roleFamilyOptions,
  seniorityOptions
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
  | { type: "clear" };

export type FilterDispatch = (action: FilterAction) => void;

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

export function getActiveFilterCount({
  freshness,
  query,
  remoteOnly,
  roleFamily,
  salaryOnly,
  selectedPlatforms,
  selectedTools,
  seniority
}: FilterState) {
  return (
    selectedPlatforms.length +
    selectedTools.length +
    (remoteOnly ? 1 : 0) +
    (salaryOnly ? 1 : 0) +
    (seniority !== "All" ? 1 : 0) +
    (roleFamily !== "All" ? 1 : 0) +
    (freshness !== "Any" ? 1 : 0) +
    (query.trim() ? 1 : 0)
  );
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
