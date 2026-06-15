import type {
  FilterAction,
  FilterState,
  FreshnessFilter,
  SortKey,
  WorkplaceFilter
} from "./filter-model";
import {
  freshnessFilterOptions,
  sortOptions,
  workplaceFilterOptions
} from "./filter-model";

export type ActiveFilterItem = {
  clearAction: FilterAction;
  id: string;
  label: string;
  variant?: "salary";
};

export function getActiveFilterItems(filters: FilterState): ActiveFilterItem[] {
  const items: ActiveFilterItem[] = [];
  const query = filters.query.trim();
  const locationQuery = filters.locationQuery.trim();

  if (query) {
    items.push({
      clearAction: { type: "setQuery", value: "" },
      id: "query",
      label: `Search: ${query}`
    });
  }

  if (locationQuery) {
    items.push({
      clearAction: { type: "setLocationQuery", value: "" },
      id: "location-query",
      label: `Location: ${locationQuery}`
    });
  }


  if (filters.workplace !== "Any") {
    items.push({
      clearAction: { type: "setWorkplace", value: "Any" },
      id: "workplace",
      label: getWorkplaceFilterLabel(filters.workplace)
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

function getFreshnessFilterLabel(value: FreshnessFilter) {
  return freshnessFilterOptions.find((option) => option.value === value)?.label ??
    "Freshness";
}

function getSortFilterLabel(value: SortKey) {
  return sortOptions.find((option) => option.value === value)?.label ?? value;
}

function getWorkplaceFilterLabel(value: WorkplaceFilter) {
  return workplaceFilterOptions.find((option) => option.value === value)?.label ??
    value;
}
