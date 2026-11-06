import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import feedData from "../../src/data/jobs.json";
import { getExcludedJobSourceUrlSet, isExcludedJobSourceUrl, normalizeJobSourceUrl } from "../../src/lib/job-exclusions";
import { queryJobs } from "../../src/lib/jobs-api";
import type { JobsFeed } from "../../src/types/job";

test("the default exclusion set is reused and extra URLs stay excluded", () => {
  const first = getExcludedJobSourceUrlSet();
  const second = getExcludedJobSourceUrlSet([]);
  assert.equal(first, second);

  const extra = ["https://example.com/closed-role?utm_source=test"];
  const withExtra = getExcludedJobSourceUrlSet(extra);
  assert.equal(getExcludedJobSourceUrlSet(extra), withExtra);
  assert.notEqual(withExtra, first);
  assert.equal(
    withExtra.has(normalizeJobSourceUrl("https://example.com/closed-role") ?? ""),
    true
  );
  assert.equal(isExcludedJobSourceUrl("https://example.com/closed-role?utm_source=test", extra), true);
  assert.equal(isExcludedJobSourceUrl("https://www.adzuna.com/details/5763079616"), true);
  assert.equal(isExcludedJobSourceUrl("https://example.com/still-open"), false);
});

test("querying the published feed stays cheap after the exclusion set is cached", () => {
  const feed = feedData as JobsFeed;
  queryJobs(feed, new URLSearchParams());
  const started = performance.now();
  for (let index = 0; index < 20; index += 1) queryJobs(feed, new URLSearchParams("q=intune"));
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 2_000, `20 feed queries took ${elapsed.toFixed(0)}ms`);
});
