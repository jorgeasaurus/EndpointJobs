import { minimumSalaryFilterValues } from "@/lib/job-filters";
import type {
  FreshnessFilter,
  JobFilters,
  MinimumSalaryFilter,
  SortKey
} from "@/lib/job-filters";
export { filterJobs } from "@/lib/job-filters";
export type { FreshnessFilter, MinimumSalaryFilter, SortKey } from "@/lib/job-filters";
import type {
  EndpointTool,
  Platform,
  RoleFamily,
  Seniority,
  Workplace
} from "@/types/job";

export type SeniorityFilter = "All" | Seniority;
export type RoleFamilyFilter = "All" | RoleFamily;
export type WorkplaceFilter = "Any" | Exclude<Workplace, "Unknown">;
export { minimumSalaryFilterValues } from "@/lib/job-filters";

export type FilterState = JobFilters;

export type FilterAction =
  | { type: "setQuery"; value: string }
  | { type: "setLocationQuery"; value: string }
  | { type: "togglePlatform"; value: Platform }
  | { type: "toggleTool"; value: EndpointTool }
  | { type: "toggleSalaryOnly" }
  | { type: "setMinimumSalary"; value: MinimumSalaryFilter }
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
  minimumSalary: "Any",
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

export const minimumSalaryFilterOptions: {
  value: MinimumSalaryFilter;
  label: string;
}[] = [
  { value: "Any", label: "Any salary" },
  { value: "80000", label: "$80k+" },
  { value: "100000", label: "$100k+" },
  { value: "120000", label: "$120k+" },
  { value: "150000", label: "$150k+" },
  { value: "180000", label: "$180k+" },
  { value: "200000", label: "$200k+" }
];

export function isMinimumSalaryFilter(
  value: string
): value is MinimumSalaryFilter {
  return minimumSalaryFilterValues.some((option) => option === value);
}

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
    case "setMinimumSalary":
      return { ...state, minimumSalary: action.value };
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

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}
