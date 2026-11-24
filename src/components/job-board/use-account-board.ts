"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BoardListing } from "@/lib/board-page";
import {
  listSavedIds,
  listViewedIds,
  readPreferences,
  type AccountClient
} from "@/lib/account/store";
import {
  encodePreferences,
  filtersForPreferenceSave,
  shouldRestoreSavedFilters,
  type SavedPreferences
} from "@/lib/account/preferences";
import { recordJobView, savePreferences, setJobSaved } from "@/lib/account/requests";
import type { DevAccountFixture } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/client";
import { useSignInSession } from "@/components/auth/sign-in-session";

import type { FilterAction, FilterState } from "./filter-model";

const saveDelayMs = 400;

/** Where the signed-in user's account data comes from. */
type AccountSource =
  | { kind: "none" }
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
  return source.kind === "none" ? source.kind : `${source.kind}:${source.userId}`;
}

// The session store sets a userId without a fixture only after Supabase reports
// one, so an "account" source always has Supabase configured.
function useAccountSource() {
  const session = useSignInSession();
  return useMemo((): AccountSource => {
    const { userId, fixtureAccount } = session;
    if (!userId) return { kind: "none" };
    if (fixtureAccount) return { kind: "fixture", userId, fixture: fixtureAccount };
    return { kind: "account", userId };
  }, [session]);
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
  const source = useAccountSource();
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
      void savePreferences(preferences);
    }, saveDelayMs);
    return () => window.clearTimeout(timer);
  }, [filters, hideViewed, savedOnly, source.kind]);

  async function toggleSaved(job: BoardListing) {
    if (source.kind === "none") return;
    const wasSaved = account.savedIds.has(job.id);
    const flip = (state: AccountState) => ({ ...state, savedIds: toggleId(state.savedIds, job.id) });
    updateAccount(flip);
    if (source.kind === "fixture") return;
    if (!(await setJobSaved(job.id, !wasSaved))) {
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
    signedIn: source.kind !== "none",
    toggleHideViewed: () => updateAccount((state) => ({ ...state, hideViewed: !state.hideViewed })),
    toggleSaved,
    toggleSavedOnly: () => updateAccount((state) => ({ ...state, savedOnly: !state.savedOnly })),
    usingFixture: source.kind === "fixture",
    viewedIds: account.viewedIds
  };
}

/** Records the view for a real account; the fixture and signed-out visitors record nothing. */
export function useRecordJobView(jobId: string) {
  const source = useAccountSource();
  const accountKey = source.kind === "account" ? accountSourceKey(source) : null;

  useEffect(() => {
    if (accountKey) void recordJobView(jobId);
  }, [accountKey, jobId]);
}

export function useSavedJob(jobId: string) {
  const source = useAccountSource();
  const key = `${accountSourceKey(source)}:${jobId}`;
  const [saved, updateSaved, putSaved] = useKeyedState(
    key,
    source.kind === "fixture" && source.fixture.savedIds.includes(jobId)
  );

  useEffect(() => {
    if (source.kind !== "account") return undefined;
    let cancel = false;
    void listSavedIds(browserAccountClient(), source.userId).then((ids) => {
      if (!cancel) putSaved(key, ids.includes(jobId));
    });
    return () => {
      cancel = true;
    };
  }, [jobId, key, putSaved, source]);

  async function toggle() {
    if (source.kind === "none") return;
    const next = !saved;
    updateSaved(() => next);
    if (source.kind === "fixture") return;
    if (!(await setJobSaved(jobId, next))) updateSaved(() => !next);
  }

  return { saved, signedIn: source.kind !== "none", toggle };
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
