import type { MetroAreaFilter } from "@/lib/metro-areas";
import type { EndpointTool, Seniority } from "@/types/job";

import { filterReducer, type FilterAction, type FilterState } from "./filter-model";
import { getBoardPathnameForFilters, mergeFilterStateIntoSearchParams } from "./filter-url";

export type BoardStatFilter =
  | { type: "salary" }
  | { type: "leadership" }
  | { type: "seniority"; seniority: Seniority }
  | { type: "metro"; metroArea: MetroAreaFilter }
  | { type: "tool"; tool: EndpointTool };

export function boardStatFilterAction(filters: FilterState, stat: BoardStatFilter): FilterAction {
  switch (stat.type) {
    case "salary":
      return { type: "toggleSalaryOnly" };
    case "leadership":
      return { type: "toggleLeadershipOnly" };
    case "seniority":
      return {
        type: "setSeniority",
        value: filters.seniority === stat.seniority ? "All" : stat.seniority
      };
    case "metro":
      return { type: "toggleMetroArea", value: stat.metroArea };
    case "tool":
      return { type: "toggleTool", value: stat.tool };
  }
}

export function boardStatFilterHref(
  filters: FilterState,
  stat: BoardStatFilter,
  currentSearch = ""
) {
  const next = filterReducer(filters, boardStatFilterAction(filters, stat));
  const params = mergeFilterStateIntoSearchParams(new URLSearchParams(currentSearch), next);
  const query = params.toString();

  return `${getBoardPathnameForFilters(next)}${query ? `?${query}` : ""}`;
}

export function isBoardStatActive(filters: FilterState, stat: BoardStatFilter) {
  switch (stat.type) {
    case "salary":
      return filters.salaryOnly;
    case "leadership":
      return filters.leadershipOnly;
    case "seniority":
      return filters.seniority === stat.seniority;
    case "metro":
      return filters.selectedMetroAreas.includes(stat.metroArea);
    case "tool":
      return filters.selectedTools.includes(stat.tool);
  }
}

export function boardStatAccessibleName(
  label: string,
  value: number,
  total: number,
  active: boolean
) {
  const figure = `${value} of ${total} jobs`;
  return active ? `Remove ${label} filter, ${figure}` : `Filter by ${label}, ${figure}`;
}
