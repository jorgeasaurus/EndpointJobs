import assert from "node:assert/strict";
import { describe, test } from "node:test";

import feedData from "../../src/data/jobs.json";
import { jobsFeedReadUrl } from "../../src/lib/jobs-feed-config";
import {
  getPublishedJobsFeed,
  parsePublishedJobsFeed,
  resetPublishedJobsFeedForTests
} from "../../src/lib/published-jobs-feed";
import { isRevalidateAuthorized } from "../../src/lib/revalidate-auth";
import type { JobsFeed } from "../../src/types/job";

const bundled = feedData as JobsFeed;

test("jobs feed URL prefers JOBS_FEED_URL and otherwise uses the blob store id", () => {
  assert.equal(jobsFeedReadUrl({}), undefined);
  assert.equal(jobsFeedReadUrl({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_" }), undefined);
  assert.equal(
    jobsFeedReadUrl({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_store123_secret" }),
    "https://store123.public.blob.vercel-storage.com/jobs/feed.json"
  );
  assert.equal(
    jobsFeedReadUrl({
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_store123_secret",
      JOBS_FEED_URL: " https://cdn.example/feed.json "
    }),
    "https://cdn.example/feed.json"
  );
});

describe("published feed reads", { concurrency: 1 }, () => {
test("a missing remote feed config returns the bundled snapshot object", async () => {
  resetPublishedJobsFeedForTests();
  const feed = await getPublishedJobsFeed({});
  assert.equal(feed.jobs, bundled.jobs);
  assert.equal(feed.updatedAt, bundled.updatedAt);
  resetPublishedJobsFeedForTests();
});

test("the published feed parses once and reuses that object until the TTL expires", async () => {
  let requests = 0;
  resetPublishedJobsFeedForTests(async () => {
    requests += 1;
    return {
      status: 200,
      etag: "\"feed-1\"",
      body: JSON.stringify({
        updatedAt: "2026-11-06T00:00:00.000Z",
        source: { name: "Blob", url: "https://feeds.example/jobs.json" },
        jobs: []
      })
    };
  });
  try {
    const env = { JOBS_FEED_URL: "https://feeds.example/jobs.json", JOBS_FEED_MEMORY_MS: "60000" };
    const first = await getPublishedJobsFeed(env);
    const second = await getPublishedJobsFeed(env);
    assert.equal(first, second);
    assert.equal(first.updatedAt, "2026-11-06T00:00:00.000Z");
    assert.equal(requests, 1);
    assert.equal(parsePublishedJobsFeed("{"), undefined);
    assert.equal(parsePublishedJobsFeed("{}"), undefined);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("an unchanged published feed reuses the parsed object on 304", async () => {
  const body = JSON.stringify({
    updatedAt: "2026-11-06T00:00:00.000Z",
    source: { name: "Blob", url: "https://feeds.example/jobs.json" },
    jobs: []
  });
  let requests = 0;
  resetPublishedJobsFeedForTests(async (_url, headers) => {
    requests += 1;
    if (requests === 1) return { status: 200, etag: "\"feed-1\"", body };
    assert.equal(headers["if-none-match"], "\"feed-1\"");
    return { status: 304, etag: "\"feed-1\"", body: "" };
  });
  try {
    const env = { JOBS_FEED_URL: "https://feeds.example/jobs.json", JOBS_FEED_MEMORY_MS: "0" };
    const first = await getPublishedJobsFeed(env);
    const second = await getPublishedJobsFeed(env);
    assert.equal(second, first);
    assert.equal(requests, 2);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});
});

test("revalidate authorization requires the full bearer secret", () => {
  assert.equal(isRevalidateAuthorized("Bearer secret", undefined), false);
  assert.equal(isRevalidateAuthorized(null, "secret"), false);
  assert.equal(isRevalidateAuthorized("Bearer secret", "secret"), true);
  assert.equal(isRevalidateAuthorized("Bearer secret", "secret-other"), false);
  assert.equal(isRevalidateAuthorized("bearer secret", "secret"), false);
});
