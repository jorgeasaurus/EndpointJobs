import assert from "node:assert/strict";
import test from "node:test";

import { initialFilterState, withInitialTools } from "../../src/components/job-board/filter-model";
import {
  filterStateFromSearchParams,
  filterStateToBoardSearchParams
} from "../../src/components/job-board/filter-url";
import feedData from "../../src/data/jobs.json";
import { filterJobs } from "../../src/lib/job-filters";
import { dedupeJobs, dedupeWorkplaceJobs } from "../../src/lib/job-trust";
import {
  boardListingOmittedFields,
  boardPageSize,
  getActiveBoardFeed,
  queryBoardMap,
  queryBoardPage
} from "../../src/lib/board-page";
import type { JobsFeed } from "../../src/types/job";

const feed = getActiveBoardFeed(feedData as JobsFeed);

test("home board page serializes one trimmed page instead of the full feed", () => {
  const page = queryBoardPage(feed, initialFilterState, 1);
  const bytes = Buffer.byteLength(JSON.stringify(page));
  const feedBytes = Buffer.byteLength(JSON.stringify(feed));

  assert.equal(page.page, 1);
  assert.equal(page.pageSize, boardPageSize);
  assert.equal(page.jobs.length, boardPageSize);
  assert.ok(page.total > boardPageSize);
  assert.ok(page.trackedJobsCount > 0);
  assert.equal(page.trackedJobsCount, dedupeJobs(feed.jobs).length);
  assert.ok(bytes < 80_000, `board page JSON is ${bytes} bytes`);
  assert.ok(bytes * 10 < feedBytes, `page ${bytes} is not far enough below feed ${feedBytes}`);

  for (const job of page.jobs) {
    for (const field of boardListingOmittedFields) {
      assert.equal(Object.hasOwn(job, field), false, field);
    }
    assert.ok(job.title);
    assert.ok(job.company);
    assert.ok(job.summary);
  }
});

test("board pages do not repeat listings and clamp past the end", () => {
  const first = queryBoardPage(feed, initialFilterState, 1);
  const second = queryBoardPage(feed, initialFilterState, 2);
  const overflow = queryBoardPage(feed, initialFilterState, 9999);
  const firstIds = new Set(first.jobs.map((job) => job.id));

  assert.equal(second.jobs.some((job) => firstIds.has(job.id)), false);
  assert.equal(first.total, second.total);
  assert.equal(second.page, 2);
  assert.equal(overflow.page, overflow.totalPages);
  assert.notEqual(overflow.page, 1);
  assert.notEqual(overflow.jobs[0]?.id, first.jobs[0]?.id);
});

test("an unmatched board search returns an empty first page", () => {
  const page = queryBoardPage(
    feed,
    { ...initialFilterState, query: "zzzz-no-such-endpoint-role" },
    9
  );

  assert.equal(page.total, 0);
  assert.deepEqual(page.jobs, []);
  assert.equal(page.page, 1);
  assert.equal(page.totalPages, 1);
  assert.equal(page.metrics.mappedJobsCount, 0);
});

test("board totals follow the deduped workplace filter", () => {
  const filters = { ...initialFilterState, workplace: "Remote" as const, sort: "company" as const };
  const page = queryBoardPage(feed, filters, 1);
  const matched = filterJobs(feed.jobs, { ...filters, workplace: "Any" });
  const visible = dedupeWorkplaceJobs(matched, "Remote");

  assert.equal(page.total, visible.length);
  assert.deepEqual(
    page.jobs.map((job) => job.id),
    visible.slice(0, boardPageSize).map((job) => job.id)
  );
  assert.equal(page.workplaceCounts.Remote, visible.length);
});

test("map payload keeps coordinates and omits listing prose", () => {
  const jobs = queryBoardMap(feed, initialFilterState);
  const bytes = Buffer.byteLength(JSON.stringify(jobs));

  assert.ok(jobs.length > 0);
  assert.ok(jobs.length <= feed.jobs.length);
  assert.ok(bytes < 500_000, `map JSON is ${bytes} bytes`);

  for (const job of jobs) {
    assert.ok(job.mapLocation);
    assert.equal("description" in job, false);
    assert.equal("summary" in job, false);
    assert.equal("sourceUrl" in job, false);
  }
});

test("board queries keep a single selected tool and the requested page", () => {
  const filters = withInitialTools(["Intune"]);
  const params = filterStateToBoardSearchParams(filters, 2);
  const parsed = filterStateFromSearchParams(params);

  assert.deepEqual(parsed.selectedTools, ["Intune"]);
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("tools"), "Intune");
});
