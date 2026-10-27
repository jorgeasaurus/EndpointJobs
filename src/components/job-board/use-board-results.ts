"use client";

import { useEffect, useRef, useState } from "react";

import type { BoardMapJob, BoardPage } from "@/lib/board-page";
import type { FilterState } from "./filter-model";
import { filterStateToBoardSearchParams } from "./filter-url";

type BoardStatus = "ready" | "loading" | "error";
type BoardScope = "public" | "saved";

const boardFilterDebounceMs = 200;

export type BoardSavedQuery =
  | { kind: "off" }
  | { kind: "session"; token: string }
  | { kind: "fixture"; ids: readonly string[] };

export function savedBoardQuery(account: {
  savedIds: ReadonlySet<string>;
  savedOnly: boolean;
  savedToken: string;
  signedIn: boolean;
  usingFixture: boolean;
}): BoardSavedQuery {
  if (!account.signedIn || !account.savedOnly) return { kind: "off" };
  if (account.usingFixture) return { kind: "fixture", ids: [...account.savedIds] };
  return { kind: "session", token: account.savedToken };
}

export function boardResultsRequest(filters: FilterState, page: number, saved: BoardSavedQuery) {
  const params = filterStateToBoardSearchParams(filters, page);
  if (saved.kind === "off") return { path: "/api/board", params };
  params.set("saved", "1");
  if (saved.kind === "fixture") params.set("e2e-saved", saved.ids.join(","));
  return { path: "/api/board/saved", params };
}

export function boardMapRequest(filters: FilterState, saved: BoardSavedQuery) {
  const request = boardResultsRequest(filters, 1, saved);
  request.params.delete("page");
  return {
    path: saved.kind === "off" ? "/api/board/map" : "/api/board/saved/map",
    params: request.params
  };
}

function savedRequestKey(saved: BoardSavedQuery) {
  if (saved.kind === "off") return "off";
  if (saved.kind === "session") return `session:${saved.token}`;
  return `fixture:${[...saved.ids].sort().join(",")}`;
}

export function useDebouncedFilters(filters: FilterState) {
  const [debounced, setDebounced] = useState(filters);
  const previousFilters = useRef(filters);

  useEffect(() => {
    const delay = shouldDebounceFilters(previousFilters.current, filters) ? boardFilterDebounceMs : 0;
    previousFilters.current = filters;
    const timer = window.setTimeout(() => setDebounced(filters), delay);
    return () => window.clearTimeout(timer);
  }, [filters]);

  return debounced;
}

export function useBoardPage(
  initialPage: BoardPage,
  filters: FilterState,
  page: number,
  initialFilterKey: string,
  saved: BoardSavedQuery = { kind: "off" }
) {
  const filterKey = JSON.stringify(filters);
  const savedKey = savedRequestKey(saved);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${filterKey}|${page}|${savedKey}|${attempt}`;
  const [state, setState] = useState<{
    key: string;
    page: BoardPage;
    scope: BoardScope;
    status: BoardStatus;
  }>({ key: "", page: initialPage, scope: "public", status: "ready" });
  const isInitial = filterKey === initialFilterKey && page === 1 && attempt === 0 && saved.kind === "off";
  const desiredScope: BoardScope = saved.kind === "off" ? "public" : "saved";
  const matches = state.key === requestKey;
  const pendingScope = !isInitial && state.scope !== desiredScope;

  useEffect(() => {
    if (isInitial) return undefined;

    const controller = new AbortController();
    const request = boardResultsRequest(filters, page, saved);
    const timer = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setState((current) => ({ ...current, status: "loading" }));

      fetch(`${request.path}?${request.params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Board query failed (${response.status})`);
          return response.json() as Promise<unknown>;
        })
        .then((body) => {
          if (controller.signal.aborted) return;
          if (!isBoardPage(body)) throw new Error("Board query returned an unexpected payload");
          setState({ key: requestKey, page: body, scope: desiredScope, status: "ready" });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || isAbortError(error)) return;
          setState((current) => ({ ...current, key: requestKey, status: "error" }));
        });
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [desiredScope, filters, isInitial, page, requestKey, saved]);

  return {
    page: isInitial ? initialPage : state.page,
    pendingScope,
    retry: () => setAttempt((current) => current + 1),
    status: isInitial ? "ready" : matches ? state.status : "loading"
  };
}

export function useBoardMap(filters: FilterState, enabled: boolean, saved: BoardSavedQuery = { kind: "off" }) {
  const filterKey = JSON.stringify(filters);
  const savedKey = savedRequestKey(saved);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${filterKey}:${savedKey}:${attempt}`;
  const [state, setState] = useState<{
    jobs: BoardMapJob[];
    key: string;
    status: "ready" | "error";
  } | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    const request = boardMapRequest(filters, saved);

    fetch(`${request.path}?${request.params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Map query failed (${response.status})`);
        return response.json() as Promise<unknown>;
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        if (!isMapPayload(body)) throw new Error("Map query returned an unexpected payload");
        setState({ key: requestKey, jobs: body.jobs, status: "ready" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState({ key: requestKey, jobs: [], status: "error" });
      });

    return () => controller.abort();
  }, [enabled, filters, requestKey, saved]);

  const current = state?.key === requestKey ? state : null;

  return {
    jobs: current?.status === "ready" ? current.jobs : [],
    retry: () => setAttempt((currentAttempt) => currentAttempt + 1),
    status: !enabled ? "idle" : current?.status ?? "loading"
  };
}

function shouldDebounceFilters(previous: FilterState, next: FilterState) {
  return previous.query !== next.query || previous.locationQuery !== next.locationQuery;
}

function isBoardPage(value: unknown): value is BoardPage {
  if (!value || typeof value !== "object") return false;
  const page = value as Partial<BoardPage>;
  return Array.isArray(page.jobs)
    && typeof page.total === "number"
    && typeof page.page === "number"
    && typeof page.pageSize === "number"
    && typeof page.trackedJobsCount === "number"
    && page.metrics !== undefined
    && page.workplaceCounts !== undefined;
}

function isMapPayload(value: unknown): value is { jobs: BoardMapJob[] } {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as { jobs?: unknown }).jobs);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
