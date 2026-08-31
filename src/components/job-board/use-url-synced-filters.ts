import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { EndpointTool } from "@/types/job";

import { filterReducer, initialFilterState } from "./filter-model";
import type { FilterAction, FilterState } from "./filter-model";
import {
  filterStateFromLocation,
  getBoardPathnameForFilters,
  mergeFilterStateIntoSearchParams
} from "./filter-url";

const filterUrlStoreEvent = "endpointjobs:filters-changed";
let cachedLocation = "";
let cachedFilters: FilterState = initialFilterState;

export function useUrlSyncedFilters(initialSelectedTools?: readonly EndpointTool[]) {
  const router = useFilterUrlRouter();
  const serverSnapshot = useMemo(
    () => getServerFilterSnapshot(initialSelectedTools ?? []),
    [initialSelectedTools]
  );

  const filters = useSyncExternalStore(
    subscribeToFilterUrlStore,
    getFilterSnapshot,
    () => serverSnapshot
  );

  const dispatch = useCallback((action: FilterAction) => {
    const nextFilters = filterReducer(getFilterSnapshot(), action);
    replaceFilterUrl(nextFilters, router);
  }, [router]);

  return [filters, dispatch] as const;
}

function getFilterSnapshot() {
  if (typeof window === "undefined") {
    return initialFilterState;
  }

  const currentLocation = `${window.location.pathname}${window.location.search}`;

  if (currentLocation === cachedLocation) {
    return cachedFilters;
  }

  cachedLocation = currentLocation;
  cachedFilters = filterStateFromLocation(
    window.location.pathname,
    new URLSearchParams(window.location.search)
  );

  return cachedFilters;
}

function getServerFilterSnapshot(initialSelectedTools: readonly EndpointTool[]) {
  if (initialSelectedTools.length === 0) {
    return initialFilterState;
  }

  return {
    ...initialFilterState,
    selectedTools: [...initialSelectedTools]
  };
}

type FilterUrlRouter = Pick<ReturnType<typeof useRouter>, "replace">;

function useFilterUrlRouter(): FilterUrlRouter {
  try {
    return useRouter();
  } catch {
    // JobBoard is also renderToStaticMarkup'd in data audits (REG-001) outside
    // App Router. Production pages always have the router.
    return { replace: () => undefined };
  }
}

function replaceFilterUrl(
  filters: FilterState,
  router: FilterUrlRouter
) {
  if (typeof window === "undefined") {
    return;
  }

  const searchParams = mergeFilterStateIntoSearchParams(
    new URLSearchParams(window.location.search),
    filters
  );
  const query = searchParams.toString();
  const nextPathname = getBoardPathnameForFilters(filters);
  const nextUrl = `${nextPathname}${query ? `?${query}` : ""}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${
    window.location.hash
  }`;

  if (nextUrl === currentUrl) {
    return;
  }

  // Crossing `/` ↔ `/intune` is a real App Router segment change. replaceState
  // alone updates the address bar without a navigation, so metadata/router
  // state would desync. Same-path query/hash updates stay on replaceState so
  // JobBoard does not remount. Do not location.replace — that full-reloads.
  if (nextPathname !== window.location.pathname) {
    router.replace(nextUrl as Route, { scroll: false });
  } else {
    window.history.replaceState(null, "", nextUrl);
  }

  window.dispatchEvent(new Event(filterUrlStoreEvent));
}

function subscribeToFilterUrlStore(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(filterUrlStoreEvent, onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(filterUrlStoreEvent, onStoreChange);
  };
}
