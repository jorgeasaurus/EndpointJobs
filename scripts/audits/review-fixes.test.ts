import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getMemoizedActiveBoardFeed } from "../../src/lib/active-board-feed";

const hourMs = 3_600_000;

test("the active feed is shared for an hour and recomputed on the next hour", () => {
  const now = new Date("2026-10-26T11:10:00.000Z");
  const later = new Date("2026-10-26T11:59:00.000Z");
  const nextHour = new Date(now.getTime() + hourMs);

  const first = getMemoizedActiveBoardFeed(now);
  const second = getMemoizedActiveBoardFeed(later);
  const third = getMemoizedActiveBoardFeed(nextHour);

  assert.equal(first, second);
  assert.notEqual(second, third);
  assert.ok(first.jobs.length > 0);
  assert.ok(third.jobs.length > 0);
});

test("board, map, and listing routes share the memoized feed", () => {
  const routes = [
    "src/app/api/board/route.ts",
    "src/app/api/board/map/route.ts",
    "src/app/api/board/listings/[id]/route.ts",
    "src/app/api/board/saved/route.ts",
    "src/app/api/board/saved/map/route.ts"
  ];

  for (const route of routes) {
    const source = readFileSync(new URL(`../../${route}`, import.meta.url), "utf8");
    assert.match(source, /from "@\/lib\/active-board-feed"/);
    assert.match(source, /getMemoizedActiveBoardFeed\(/);
    assert.doesNotMatch(source, /getActiveBoardFeed\(/);
    assert.doesNotMatch(source, /jobs\.json/);
  }
});

test("the map fetch uses the same debounced filters as the page", () => {
  const board = readFileSync(new URL("../../src/components/job-board.tsx", import.meta.url), "utf8");
  const results = readFileSync(new URL("../../src/components/job-board/use-board-results.ts", import.meta.url), "utf8");
  const pageHook = results.slice(
    results.indexOf("export function useBoardPage"),
    results.indexOf("export function useBoardMap")
  );
  const mapHook = results.slice(results.indexOf("export function useBoardMap"));

  assert.match(board, /const debouncedFilters = useDebouncedFilters\(filters\)/);
  assert.match(board, /useBoardPage\(initialPage, debouncedFilters, requestedPage, initialFilterKey, savedQuery\)/);
  assert.match(board, /useBoardMap\(debouncedFilters, mapExpanded, savedQuery\)/);
  assert.match(board, /setPagination\(\{ filterKey: debouncedFilterKey, page: nextPage \}\)/);
  assert.match(results, /export function useDebouncedFilters/);
  assert.match(results, /boardFilterDebounceMs = 200/);
  assert.doesNotMatch(pageHook, /boardFilterDebounceMs/);
  assert.doesNotMatch(mapHook, /setTimeout/);
  assert.doesNotMatch(mapHook, /boardFilterDebounceMs/);
});

test("the footer job board link is above the prefetch note and does not prefetch", () => {
  const topbar = readFileSync(new URL("../../src/components/job-board/topbar.tsx", import.meta.url), "utf8");
  const link = topbar.indexOf("href={getBoardPath()} prefetch={false}");
  const comment = topbar.indexOf("Disable speculative prefetch");

  assert.ok(link > -1);
  assert.ok(comment > link);
});

test("job cards expand from hasDescription instead of the fetch flag", () => {
  const card = readFileSync(new URL("../../src/components/job-board/job-card.tsx", import.meta.url), "utf8");

  assert.match(card, /boardListingHasMore\(job, descriptionBlocks\.length\)/);
  assert.match(card, /if \(!job\.hasDescription/);
  assert.doesNotMatch(card, /hasFetchedDescription/);
});
