import { filterSearchParamKeys } from "@/lib/board-search-params";
import { filterStateFromSearchParams, filterStateToBoardSearchParams } from "@/components/job-board/filter-url";
import { initialFilterState, type FilterState } from "@/components/job-board/filter-model";

export const preferenceSchemaVersion = 1;

export type SavedPreferences = {
  filters: FilterState;
  hideViewed: boolean;
  savedOnly: boolean;
};

export function encodePreferences(filters: FilterState, hideViewed: boolean, savedOnly = false) {
  const params = filterStateToBoardSearchParams(filters, 1);
  params.delete("page");
  const stored: Record<string, string | boolean> = { hideViewed, savedOnly };
  for (const [key, value] of params) stored[key] = value;
  return stored;
}

/** A board link never turns Saved jobs only on, even when savedOnly or saved is present. */
export function savedOnlyFromBoardSearch(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("savedOnly");
  params.delete("saved");
  return false;
}

export function decodePreferences(value: unknown): SavedPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const params = new URLSearchParams();
  for (const key of filterSearchParamKeys) {
    const item = record[key];
    if (typeof item === "string" && item) params.set(key, item);
  }
  return {
    filters: filterStateFromSearchParams(params),
    hideViewed: record.hideViewed === true,
    savedOnly: record.savedOnly === true
  };
}

export function filtersForPreferenceSave(input: {
  pageFilters: FilterState;
  savedFilters: FilterState | null;
  pageFiltersOwned: boolean;
}) {
  if (input.pageFiltersOwned || !input.savedFilters) return input.pageFilters;
  return input.savedFilters;
}

export function shouldRestoreSavedFilters(pathname: string, search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (filterSearchParamKeys.some((key) => params.has(key))) return false;
  const segment = pathname.replace(/^\/+|\/+$/g, "");
  return segment === "" || segment === "board";
}

export function preferenceRow(
  userId: string,
  filters: FilterState,
  hideViewed: boolean,
  updatedAt: string,
  savedOnly = false
) {
  return {
    user_id: userId,
    filters: encodePreferences(filters, hideViewed, savedOnly),
    schema_version: preferenceSchemaVersion,
    updated_at: updatedAt
  };
}

export function emptyPreferences(): SavedPreferences {
  return { filters: initialFilterState, hideViewed: false, savedOnly: false };
}
