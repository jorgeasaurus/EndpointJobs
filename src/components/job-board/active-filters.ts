import type {
  FilterAction,
  FilterState,
  FreshnessFilter,
  MetroAreaFilter,
  MinimumSalaryFilter,
  SortKey,
  WorkplaceFilter
} from "./filter-model";
import {
  freshnessFilterOptions,
  minimumSalaryFilterOptions,
  sortOptions,
  workplaceFilterOptions
} from "./filter-model";
import type { EndpointTool, Platform } from "@/types/job";

export type ActiveFilterItem = {
  clearAction: FilterAction;
  id: string;
  label: string;
  variant?: "salary";
};

type ScalarFilterDescriptor = {
  id: string;
  isActive: (filters: FilterState) => boolean;
  getLabel: (filters: FilterState) => string;
  getClearAction: () => FilterAction;
  variant?: ActiveFilterItem["variant"];
};

type ArrayFilterDescriptor<Item extends string> = {
  idPrefix: string;
  getItems: (filters: FilterState) => Item[];
  getItemLabel: (item: Item) => string;
  getItemClearAction: (item: Item) => FilterAction;
};

const scalarFilterDescriptors: ScalarFilterDescriptor[] = [
  {
    id: "query",
    isActive: (filters) => getQuery(filters).length > 0,
    getLabel: (filters) => `Search: ${getQuery(filters)}`,
    getClearAction: () => ({ type: "setQuery", value: "" })
  },
  {
    id: "location-query",
    isActive: (filters) => getLocationQuery(filters).length > 0,
    getLabel: (filters) => `Location: ${getLocationQuery(filters)}`,
    getClearAction: () => ({ type: "setLocationQuery", value: "" })
  },
  {
    id: "workplace",
    isActive: (filters) => filters.workplace !== "Any",
    getLabel: (filters) => getWorkplaceFilterLabel(filters.workplace),
    getClearAction: () => ({ type: "setWorkplace", value: "Any" })
  },
  {
    id: "salary",
    isActive: (filters) => filters.salaryOnly,
    getLabel: () => "Salary shown",
    getClearAction: () => ({ type: "toggleSalaryOnly" }),
    variant: "salary"
  },
  {
    id: "leadership",
    isActive: (filters) => filters.leadershipOnly,
    getLabel: () => "Leadership",
    getClearAction: () => ({ type: "toggleLeadershipOnly" })
  },
  {
    id: "minimum-salary",
    isActive: (filters) => filters.minimumSalary !== "Any",
    getLabel: (filters) =>
      `Minimum: ${getMinimumSalaryFilterLabel(filters.minimumSalary)}`,
    getClearAction: () => ({ type: "setMinimumSalary", value: "Any" }),
    variant: "salary"
  },
  {
    id: "family",
    isActive: (filters) => filters.roleFamily !== "All",
    getLabel: (filters) => filters.roleFamily,
    getClearAction: () => ({ type: "setRoleFamily", value: "All" })
  },
  {
    id: "freshness",
    isActive: (filters) => filters.freshness !== "Any",
    getLabel: (filters) => getFreshnessFilterLabel(filters.freshness),
    getClearAction: () => ({ type: "setFreshness", value: "Any" })
  },
  {
    id: "seniority",
    isActive: (filters) => filters.seniority !== "All",
    getLabel: (filters) => filters.seniority,
    getClearAction: () => ({ type: "setSeniority", value: "All" })
  },
  {
    id: "sort",
    isActive: (filters) => filters.sort !== "newest",
    getLabel: (filters) => `Sort: ${getSortFilterLabel(filters.sort)}`,
    getClearAction: () => ({ type: "setSort", value: "newest" })
  }
];

const platformFilterDescriptor: ArrayFilterDescriptor<Platform> = {
  idPrefix: "platform",
  getItems: (filters) => filters.selectedPlatforms,
  getItemLabel: (platform) => platform,
  getItemClearAction: (platform) => ({ type: "togglePlatform", value: platform })
};

const toolFilterDescriptor: ArrayFilterDescriptor<EndpointTool> = {
  idPrefix: "tool",
  getItems: (filters) => filters.selectedTools,
  getItemLabel: (tool) => tool,
  getItemClearAction: (tool) => ({ type: "toggleTool", value: tool })
};

const metroAreaFilterDescriptor: ArrayFilterDescriptor<MetroAreaFilter> = {
  idPrefix: "metro-area",
  getItems: (filters) => filters.selectedMetroAreas,
  getItemLabel: (metroArea) => `Metro: ${metroArea}`,
  getItemClearAction: (metroArea) => ({
    type: "toggleMetroArea",
    value: metroArea
  })
};

export function getActiveFilterItems(filters: FilterState): ActiveFilterItem[] {
  const items: ActiveFilterItem[] = [];

  for (const descriptor of scalarFilterDescriptors) {
    if (descriptor.isActive(filters)) {
      items.push({
        clearAction: descriptor.getClearAction(),
        id: descriptor.id,
        label: descriptor.getLabel(filters),
        ...(descriptor.variant ? { variant: descriptor.variant } : {})
      });
    }
  }

  pushArrayFilterItems(items, filters, platformFilterDescriptor);
  pushArrayFilterItems(items, filters, toolFilterDescriptor);
  pushArrayFilterItems(items, filters, metroAreaFilterDescriptor);

  return items;
}

function pushArrayFilterItems<Item extends string>(
  items: ActiveFilterItem[],
  filters: FilterState,
  descriptor: ArrayFilterDescriptor<Item>
) {
  for (const item of descriptor.getItems(filters)) {
    items.push({
      clearAction: descriptor.getItemClearAction(item),
      id: `${descriptor.idPrefix}:${item}`,
      label: descriptor.getItemLabel(item)
    });
  }
}

function getQuery(filters: FilterState) {
  return filters.query.trim();
}

function getLocationQuery(filters: FilterState) {
  return filters.locationQuery.trim();
}

function getFreshnessFilterLabel(value: FreshnessFilter) {
  return freshnessFilterOptions.find((option) => option.value === value)?.label ??
    "Freshness";
}

function getMinimumSalaryFilterLabel(value: MinimumSalaryFilter) {
  return minimumSalaryFilterOptions.find((option) => option.value === value)?.label ??
    "Salary";
}

function getSortFilterLabel(value: SortKey) {
  return sortOptions.find((option) => option.value === value)?.label ?? value;
}

function getWorkplaceFilterLabel(value: WorkplaceFilter) {
  return workplaceFilterOptions.find((option) => option.value === value)?.label ??
    value;
}
