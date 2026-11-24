"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { BoardListing } from "@/lib/board-page";
import {
  listSavedIds,
  listViewedIds,
  readPreferences,
  recordJobView,
  type AccountClient
} from "@/lib/account/store";
import {
  encodePreferences,
  filtersForPreferenceSave,
  shouldRestoreSavedFilters,
  type SavedPreferences
} from "@/lib/account/preferences";
import { devAccountFixture, type DevAccountFixture } from "@/lib/auth/dev-auth-fixture";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useSignInSession } from "@/components/auth/sign-in-session";

import type { FilterAction, FilterState } from "./filter-model";

const saveDelayMs = 400;

/** Where the board's account data comes from. */
type AccountSource =
  | { kind: "signed-out" }
  | { kind: "unconfigured" }
  | { kind: "fixture"; userId: string; fixture: DevAccountFixture }
  | { kind: "account"; userId: string };

type AccountState = {
  hideViewed: boolean;
  savedOnly: boolean;
  viewedIds: ReadonlySet<string>;
  savedIds: ReadonlySet<string>;
};

const emptyAccountState: AccountState = {
  hideViewed: false,
  savedOnly: false,
  viewedIds: new Set(),
  savedIds: new Set()
};

/** Changes exactly when the account data must start over. */
function accountSourceKey(source: AccountSource) {
  return "userId" in source ? `${source.kind}:${source.userId}` : source.kind;
}

function resolveAccountSource(userId: string | null | undefined, fixtureParams: string | null): AccountSource {
  if (!userId) return { kind: "signed-out" };
  const fixture = fixtureParams === null ? null : devAccountFixture(fixtureParams, process.env.NODE_ENV !== "production");
  if (fixture) return { kind: "fixture", userId, fixture };
  if (!isSupabaseConfigured()) return { kind: "unconfigured" };
  return { kind: "account", userId };
}

function initialAccountState(source: AccountSource): AccountState {
  if (source.kind !== "fixture") return emptyAccountState;
  const { fixture } = source;
  return {
    hideViewed: fixture.hideViewed,
    savedOnly: fixture.savedOnly,
    viewedIds: new Set(fixture.viewedIds),
    savedIds: new Set(fixture.savedIds)
  };
}

const subscribeToNothing = () => () => {};
// Only the dev fixture's own `e2e-*` params. Filter changes rewrite the rest of
// the query string, and must not look like a new account source.
const readFixtureParams = () =>
  [...new URLSearchParams(window.location.search)]
    .filter(([name]) => name.startsWith("e2e-"))
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("&");
// The server has no query string; hydration matches, then the client reads the real one.
const readServerFixtureParams = () => null;

/** State owned by one key: another key reads `initial` until something is written for it. */
function useKeyedState<T>(key: string, initial: T) {
  const [stored, setStored] = useState<{ key: string; value: T } | null>(null);
  const value = stored !== null && stored.key === key ? stored.value : initial;
  const update = (next: (current: T) => T) =>
    setStored((previous) => ({ key, value: next(previous !== null && previous.key === key ? previous.value : initial) }));
  const put = useCallback((forKey: string, next: T) => setStored({ key: forKey, value: next }), []);
  return [value, update, put] as const;
}

export function useAccountBoard(
  filters: FilterState,
  dispatch: (action: FilterAction) => void
) {
  const { userId } = useSignInSession();
  const fixtureParams = useSyncExternalStore(subscribeToNothing, readFixtureParams, readServerFixtureParams);
  const source = useMemo(() => resolveAccountSource(userId, fixtureParams), [fixtureParams, userId]);
  const initialState = useMemo(() => initialAccountState(source), [source]);
  const [account, updateAccount, putAccount] = useKeyedState(accountSourceKey(source), initialState);
  const [savedToken, setSavedToken] = useState("0");
  const ready = useRef(false);
  const savedJson = useRef("");
  const filtersRef = useRef(filters);
  const savedFiltersRef = useRef<FilterState | null>(null);
  const pageFiltersOwned = useRef(true);
  const pageFiltersJson = useRef("");

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    ready.current = false;
    if (source.kind !== "account") return undefined;

    const key = accountSourceKey(source);
    const client = browserAccountClient();
    let cancel = false;
    void (async () => {
      const [preferences, viewed, saved] = await Promise.all([
        readPreferences(client, source.userId),
        listViewedIds(client, source.userId),
        listSavedIds(client, source.userId)
      ]);
      if (cancel) return;
      const hideViewed = preferences?.hideViewed ?? false;
      const savedOnly = preferences?.savedOnly ?? false;
      putAccount(key, { hideViewed, savedOnly, viewedIds: new Set(viewed), savedIds: new Set(saved) });
      const pageFilters = filtersRef.current;
      const restore = Boolean(
        preferences && shouldRestoreSavedFilters(window.location.pathname, window.location.search)
      );
      savedFiltersRef.current = preferences?.filters ?? null;
      pageFiltersOwned.current = !preferences || restore;
      pageFiltersJson.current = JSON.stringify(pageFilters);
      const filtersToStore = filtersForPreferenceSave({
        pageFilters,
        savedFilters: savedFiltersRef.current,
        pageFiltersOwned: pageFiltersOwned.current
      });
      if (restore && preferences) dispatch({ type: "replace", value: preferences.filters });
      savedJson.current = JSON.stringify(encodePreferences({ filters: filtersToStore, hideViewed, savedOnly }));
      ready.current = true;
    })();

    return () => {
      cancel = true;
    };
  }, [dispatch, putAccount, source]);

  const { hideViewed, savedOnly } = account;
  useEffect(() => {
    if (source.kind !== "account" || !ready.current) return undefined;
    if (!pageFiltersOwned.current && JSON.stringify(filters) !== pageFiltersJson.current) {
      pageFiltersOwned.current = true;
      savedFiltersRef.current = filters;
    }
    const preferences: SavedPreferences = {
      filters: filtersForPreferenceSave({
        pageFilters: filters,
        savedFilters: savedFiltersRef.current,
        pageFiltersOwned: pageFiltersOwned.current
      }),
      hideViewed,
      savedOnly
    };
    const json = JSON.stringify(encodePreferences(preferences));
    if (json === savedJson.current) return undefined;
    const timer = window.setTimeout(() => {
      savedJson.current = json;
      void fetch("/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: json
      });
    }, saveDelayMs);
    return () => window.clearTimeout(timer);
  }, [filters, hideViewed, savedOnly, source.kind]);

  async function toggleSaved(job: BoardListing) {
    if (!userId) return;
    const wasSaved = account.savedIds.has(job.id);
    const flip = (state: AccountState) => ({ ...state, savedIds: toggleId(state.savedIds, job.id) });
    updateAccount(flip);
    if (source.kind === "fixture") return;
    const response = await fetch(wasSaved ? `/api/account/saved?jobId=${encodeURIComponent(job.id)}` : "/api/account/saved", {
      method: wasSaved ? "DELETE" : "POST",
      headers: wasSaved ? undefined : { "content-type": "application/json" },
      body: wasSaved ? undefined : JSON.stringify({ jobId: job.id })
    });
    if (!response.ok) {
      updateAccount(flip);
      return;
    }
    setSavedToken((token) => String(Number(token) + 1));
  }

  return {
    hideViewed,
    savedIds: account.savedIds,
    savedOnly,
    savedToken,
    signedIn: Boolean(userId),
    toggleHideViewed: () => updateAccount((state) => ({ ...state, hideViewed: !state.hideViewed })),
    toggleSaved,
    toggleSavedOnly: () => updateAccount((state) => ({ ...state, savedOnly: !state.savedOnly })),
    usingFixture: source.kind === "fixture",
    viewedIds: account.viewedIds
  };
}

export function useRecordJobView(jobId: string) {
  const { userId } = useSignInSession();

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    void recordJobView(browserAccountClient(), jobId);
  }, [jobId, userId]);
}

export function useSavedJob(jobId: string) {
  const { userId } = useSignInSession();
  const accountUserId = userId && isSupabaseConfigured() ? userId : null;
  const key = accountUserId ? `${accountUserId}:${jobId}` : "signed-out";
  const [saved, updateSaved, putSaved] = useKeyedState(key, false);

  useEffect(() => {
    if (!accountUserId) return;
    let cancel = false;
    void listSavedIds(browserAccountClient(), accountUserId).then((ids) => {
      if (!cancel) putSaved(key, ids.includes(jobId));
    });
    return () => {
      cancel = true;
    };
  }, [accountUserId, jobId, key, putSaved]);

  async function toggle() {
    if (!accountUserId) return;
    const next = !saved;
    updateSaved(() => next);
    const response = await fetch(next ? "/api/account/saved" : `/api/account/saved?jobId=${encodeURIComponent(jobId)}`, {
      method: next ? "POST" : "DELETE",
      headers: next ? { "content-type": "application/json" } : undefined,
      body: next ? JSON.stringify({ jobId }) : undefined
    });
    if (!response.ok) updateSaved(() => !next);
  }

  return { saved, signedIn: Boolean(userId), toggle };
}

function browserAccountClient() {
  return createClient() as unknown as AccountClient;
}

function toggleId(ids: ReadonlySet<string>, id: string) {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
