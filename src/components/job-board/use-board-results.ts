"use client";

import { useEffect, useRef, useState } from "react";

import type { BoardMapJob, BoardPage } from "@/lib/board-page";
import type { FilterState } from "./filter-model";
import { filterStateToBoardSearchParams } from "./filter-url";

type BoardStatus = "ready" | "loading" | "error";

const boardFilterDebounceMs = 200;

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
  initialFilterKey: string
) {
  const filterKey = JSON.stringify(filters);
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState(initialPage);
  const [status, setStatus] = useState<BoardStatus>("ready");
  const isInitial = filterKey === initialFilterKey && page === 1 && attempt === 0;

  useEffect(() => {
    if (isInitial) return undefined;

    const controller = new AbortController();
    const params = filterStateToBoardSearchParams(filters, page);
    const timer = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setStatus("loading");

      fetch(`/api/board?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Board query failed (${response.status})`);
          return response.json() as Promise<unknown>;
        })
        .then((body) => {
          if (controller.signal.aborted) return;
          if (!isBoardPage(body)) throw new Error("Board query returned an unexpected payload");
          setSnapshot(body);
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || isAbortError(error)) return;
          setStatus("error");
        });
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [attempt, filterKey, filters, isInitial, page]);

  return {
    page: isInitial ? initialPage : snapshot,
    retry: () => setAttempt((current) => current + 1),
    status: isInitial ? "ready" : status
  };
}

export function useBoardMap(filters: FilterState, enabled: boolean) {
  const filterKey = JSON.stringify(filters);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${filterKey}:${attempt}`;
  const [state, setState] = useState<{
    jobs: BoardMapJob[];
    key: string;
    status: "ready" | "error";
  } | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    const params = filterStateToBoardSearchParams(filters, 1);
    params.delete("page");

    fetch(`/api/board/map?${params.toString()}`, { signal: controller.signal })
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
  }, [enabled, filters, requestKey]);

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
