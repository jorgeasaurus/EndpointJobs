import {
  getPostedAgeDays,
  getSalarySortValue,
  getSearchText
} from "@/lib/jobs";
import type {
  EndpointTool,
  Job,
  Platform,
  RoleFamily,
  Seniority,
  Workplace
} from "@/types/job";

export type SortKey = "newest" | "salary" | "company";
export type SeniorityFilter = "All" | Seniority;
export type RoleFamilyFilter = "All" | RoleFamily;
export type FreshnessFilter = "Any" | "7" | "14" | "30";
export type WorkplaceFilter = "Any" | Exclude<Workplace, "Unknown">;

export type FilterState = {
  query: string;
  locationQuery: string;
  selectedPlatforms: Platform[];
  selectedTools: EndpointTool[];
  workplace: WorkplaceFilter;
  salaryOnly: boolean;
  seniority: SeniorityFilter;
  roleFamily: RoleFamilyFilter;
  freshness: FreshnessFilter;
  sort: SortKey;
};

export type FilterAction =
  | { type: "setQuery"; value: string }
  | { type: "setLocationQuery"; value: string }
  | { type: "togglePlatform"; value: Platform }
  | { type: "toggleTool"; value: EndpointTool }
  | { type: "toggleSalaryOnly" }
  | { type: "setWorkplace"; value: WorkplaceFilter }
  | { type: "setSeniority"; value: SeniorityFilter }
  | { type: "setRoleFamily"; value: RoleFamilyFilter }
  | { type: "setFreshness"; value: FreshnessFilter }
  | { type: "setSort"; value: SortKey }
  | { type: "replace"; value: FilterState }
  | { type: "clear" };

export type FilterDispatch = (action: FilterAction) => void;

export const initialFilterState: FilterState = {
  query: "",
  locationQuery: "",
  selectedPlatforms: [],
  selectedTools: [],
  workplace: "Any",
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
  { value: "Any", label: "Any" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" }
];

export const workplaceFilterOptions: {
  value: WorkplaceFilter;
  label: string;
}[] = [
  { value: "Any", label: "Any" },
  { value: "Remote", label: "Remote" },
  { value: "Hybrid", label: "Hybrid" },
  { value: "On-site", label: "On-site" }
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
    case "setLocationQuery":
      return { ...state, locationQuery: action.value };
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
    case "toggleSalaryOnly":
      return { ...state, salaryOnly: !state.salaryOnly };
    case "setWorkplace":
      return { ...state, workplace: action.value };
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
  const normalizedLocationQuery = normalizeFilterText(filters.locationQuery);

  return jobs
    .filter((job) => {
      if (normalizedQuery && !getSearchText(job).includes(normalizedQuery)) {
        return false;
      }

      if (
        normalizedLocationQuery &&
        !getLocationSearchText(job).includes(normalizedLocationQuery)
      ) {
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

      if (filters.workplace !== "Any" && job.workplace !== filters.workplace) {
        return false;
      }

      if (filters.salaryOnly && !hasSalaryShown(job)) {
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

function hasSalaryShown(job: Job) {
  return (
    typeof job.salary?.min === "number" ||
    typeof job.salary?.max === "number"
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

function getLocationSearchText(job: Job) {
  return normalizeFilterText(
    `${job.location} ${job.mapLocation?.label ?? ""} ${job.workplace}`
  );
}

function normalizeFilterText(value: string) {
  return value.replace(/[,/\s]+/g, " ").trim().toLowerCase();
}
