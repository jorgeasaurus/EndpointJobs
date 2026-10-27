"use client";

import { useEffect, useRef, useState } from "react";

import type { BoardListing } from "@/lib/board-page";
import {
  listSavedIds,
  listViewedIds,
  readPreferences,
  recordJobView,
  upsertPreferences,
  type AccountClient
} from "@/lib/account/store";
import { encodePreferences, shouldRestoreSavedFilters } from "@/lib/account/preferences";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useSignInSession } from "@/components/auth/sign-in-session";

import type { FilterAction, FilterState } from "./filter-model";

const saveDelayMs = 400;

export function useAccountBoard(
  filters: FilterState,
  dispatch: (action: FilterAction) => void
) {
  const { userId } = useSignInSession();
  const [hideViewed, setHideViewed] = useState(false);
  const [viewedIds, setViewedIds] = useState<ReadonlySet<string>>(new Set());
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(new Set());
  const ready = useRef(false);
  const savedJson = useRef("");
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    ready.current = false;
    if (!userId || !isSupabaseConfigured()) {
      setHideViewed(false);
      setViewedIds(new Set());
      setSavedIds(new Set());
      return undefined;
    }

    const client = browserAccountClient();
    let cancel = false;
    void (async () => {
      const [preferences, viewed, saved] = await Promise.all([
        readPreferences(client, userId),
        listViewedIds(client, userId),
        listSavedIds(client, userId)
      ]);
      if (cancel) return;
      setViewedIds(new Set(viewed));
      setSavedIds(new Set(saved));
      const hide = preferences?.hideViewed ?? false;
      setHideViewed(hide);
      const restore = preferences && shouldRestoreSavedFilters(window.location.pathname, window.location.search);
      const nextFilters = restore ? preferences.filters : filtersRef.current;
      if (restore) dispatch({ type: "replace", value: preferences.filters });
      savedJson.current = JSON.stringify(encodePreferences(nextFilters, hide));
      ready.current = true;
    })();

    return () => {
      cancel = true;
    };
  }, [dispatch, userId]);

  useEffect(() => {
    if (!userId || !ready.current) return undefined;
    const payload = encodePreferences(filters, hideViewed);
    const json = JSON.stringify(payload);
    if (json === savedJson.current) return undefined;
    const timer = window.setTimeout(() => {
      savedJson.current = json;
      void upsertPreferences(browserAccountClient(), userId, filters, hideViewed, new Date().toISOString());
    }, saveDelayMs);
    return () => window.clearTimeout(timer);
  }, [filters, hideViewed, userId]);

  async function toggleSaved(job: BoardListing) {
    if (!userId) return;
    const wasSaved = savedIds.has(job.id);
    setSavedIds((current) => toggleId(current, job.id));
    const response = await fetch(wasSaved ? `/api/account/saved?jobId=${encodeURIComponent(job.id)}` : "/api/account/saved", {
      method: wasSaved ? "DELETE" : "POST",
      headers: wasSaved ? undefined : { "content-type": "application/json" },
      body: wasSaved ? undefined : JSON.stringify({ jobId: job.id })
    });
    if (!response.ok) setSavedIds((current) => toggleId(current, job.id));
  }

  return {
    hideViewed,
    savedIds,
    signedIn: Boolean(userId),
    toggleHideViewed: () => setHideViewed((current) => !current),
    toggleSaved,
    viewedIds
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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) {
      setSaved(false);
      return;
    }
    let cancel = false;
    void listSavedIds(browserAccountClient(), userId).then((ids) => {
      if (!cancel) setSaved(ids.includes(jobId));
    });
    return () => {
      cancel = true;
    };
  }, [jobId, userId]);

  async function toggle() {
    if (!userId) return;
    const next = !saved;
    setSaved(next);
    const response = await fetch(next ? "/api/account/saved" : `/api/account/saved?jobId=${encodeURIComponent(jobId)}`, {
      method: next ? "POST" : "DELETE",
      headers: next ? { "content-type": "application/json" } : undefined,
      body: next ? JSON.stringify({ jobId }) : undefined
    });
    if (!response.ok) setSaved(!next);
  }

  return { saved, signedIn: Boolean(userId), toggle };
}

export async function clearViewHistory() {
  const response = await fetch("/api/account/views", { method: "DELETE" });
  return response.ok;
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
