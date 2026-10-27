import { filterSearchParamKeys } from "@/lib/board-search-params";
import { filterStateFromSearchParams, filterStateToBoardSearchParams } from "@/components/job-board/filter-url";
import { initialFilterState, type FilterState } from "@/components/job-board/filter-model";

export const preferenceSchemaVersion = 1;

export type SavedPreferences = {
  filters: FilterState;
  hideViewed: boolean;
};

export function encodePreferences(filters: FilterState, hideViewed: boolean) {
  const params = filterStateToBoardSearchParams(filters, 1);
  params.delete("page");
  const stored: Record<string, string | boolean> = { hideViewed };
  for (const [key, value] of params) stored[key] = value;
  return stored;
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
    hideViewed: record.hideViewed === true
  };
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
  updatedAt: string
) {
  return {
    user_id: userId,
    filters: encodePreferences(filters, hideViewed),
    schema_version: preferenceSchemaVersion,
    updated_at: updatedAt
  };
}

export function emptyPreferences(): SavedPreferences {
  return { filters: initialFilterState, hideViewed: false };
}
