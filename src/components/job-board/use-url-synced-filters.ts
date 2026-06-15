import { useCallback, useSyncExternalStore } from "react";

import {
  filterReducer,
  filterStateFromSearchParams,
  initialFilterState,
  mergeFilterStateIntoSearchParams
} from "./filter-model";
import type { FilterAction, FilterState } from "./filter-model";

const filterUrlStoreEvent = "endpointjobs:filters-changed";
let cachedSearch = "";
let cachedFilters: FilterState = initialFilterState;

export function useUrlSyncedFilters() {
  const filters = useSyncExternalStore(
    subscribeToFilterUrlStore,
    getFilterSnapshot,
    getServerFilterSnapshot
  );

  const dispatch = useCallback((action: FilterAction) => {
    const nextFilters = filterReducer(getFilterSnapshot(), action);
    replaceFilterUrl(nextFilters);
  }, []);

  return [filters, dispatch] as const;
}

function getFilterSnapshot() {
  if (typeof window === "undefined") {
    return initialFilterState;
  }

  const currentSearch = window.location.search;

  if (currentSearch === cachedSearch) {
    return cachedFilters;
  }

  cachedSearch = currentSearch;
  cachedFilters = filterStateFromSearchParams(
    new URLSearchParams(currentSearch)
  );

  return cachedFilters;
}

function getServerFilterSnapshot() {
  return initialFilterState;
}

function replaceFilterUrl(filters: FilterState) {
  if (typeof window === "undefined") {
    return;
  }

  const searchParams = mergeFilterStateIntoSearchParams(
    new URLSearchParams(window.location.search),
    filters
  );
  const query = searchParams.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${
    window.location.hash
  }`;
  const currentUrl = `${window.location.pathname}${window.location.search}${
    window.location.hash
  }`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
    window.dispatchEvent(new Event(filterUrlStoreEvent));
  }
}

function subscribeToFilterUrlStore(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(filterUrlStoreEvent, onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(filterUrlStoreEvent, onStoreChange);
  };
}
