import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";

import feedData from "../../src/data/jobs.json";
import { jobsFeedReadUrl, jobsFeedRetryBackoffMs, jobsFeedRevalidateSeconds, jobsFeedSnapshotUrl, jobsFeedVersionUrl } from "../../src/lib/jobs-feed-config";
import {
  cachedPublishedJobsFeedUpdatedAt,
  collectFeedResponse,
  getPublishedJobsFeed,
  jobsFeedVersionCacheProfile,
  parsePublishedJobsFeed,
  selectSharedSnapshotVersion,
  resetPublishedJobsFeedForTests,
  revalidatePublishedFeed
} from "../../src/lib/published-jobs-feed";
import { isRevalidateAuthorized } from "../../src/lib/revalidate-auth";
import type { JobsFeed } from "../../src/types/job";

const bundled = feedData as JobsFeed;
const hour = 60 * 60 * 1000;

function atOffset(deltaMs: number) {
  return new Date(Date.parse(bundled.updatedAt) + deltaMs).toISOString();
}

function feedBody(updatedAt: string, url = "https://feeds.example/jobs.json") {
  return JSON.stringify({
    updatedAt,
    source: { name: "Blob", url },
    jobs: []
  });
}

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
  assert.equal(
    jobsFeedVersionUrl("https://store123.public.blob.vercel-storage.com/jobs/feed.json"),
    "https://store123.public.blob.vercel-storage.com/jobs/version"
  );
  assert.equal(jobsFeedVersionUrl("https://cdn.example/feed.json"), undefined);
  assert.equal(
    jobsFeedSnapshotUrl("https://store123.public.blob.vercel-storage.com/jobs/feed.json", "2026-11-06T00:00:00.000Z"),
    "https://store123.public.blob.vercel-storage.com/jobs/feed.json?v=2026-11-06T00%3A00%3A00.000Z"
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
      body: feedBody(atOffset(hour))
    };
  });
  try {
    const env = { JOBS_FEED_URL: "https://feeds.example/jobs.json", JOBS_FEED_MEMORY_MS: "60000" };
    const first = await getPublishedJobsFeed(env);
    const second = await getPublishedJobsFeed(env);
    assert.equal(first, second);
    assert.equal(first.updatedAt, atOffset(hour));
    assert.equal(requests, 1);
    assert.equal(parsePublishedJobsFeed("{"), undefined);
    assert.equal(parsePublishedJobsFeed("{}"), undefined);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("an unchanged published feed reuses the parsed object on 304", async () => {
  const body = feedBody(atOffset(hour));
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

test("failed and missing remote reads back off before trying the blob again", async () => {
  let now = 1_700_000_000_000;
  let status = 404;
  let requests = 0;
  resetPublishedJobsFeedForTests(async () => {
    requests += 1;
    if (status === 500) throw new Error("blob down");
    return { status, etag: null, body: "" };
  }, { now: () => now });
  const env = { JOBS_FEED_URL: "https://feeds.example/jobs.json", JOBS_FEED_MEMORY_MS: "0" };
  try {
    assert.equal((await getPublishedJobsFeed(env)).updatedAt, bundled.updatedAt);
    assert.equal((await getPublishedJobsFeed(env)).updatedAt, bundled.updatedAt);
    assert.equal(requests, 1);
    status = 500;
    now += jobsFeedRetryBackoffMs;
    assert.equal((await getPublishedJobsFeed(env)).updatedAt, bundled.updatedAt);
    assert.equal((await getPublishedJobsFeed(env)).updatedAt, bundled.updatedAt);
    assert.equal(requests, 2);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("a newer bundled snapshot wins until the remote snapshot catches up", async () => {
  let requests = 0;
  let updatedAt = "2020-01-01T00:00:00.000Z";
  resetPublishedJobsFeedForTests(async () => {
    requests += 1;
    return {
      status: 200,
      etag: `"${updatedAt}"`,
      body: JSON.stringify({
        updatedAt,
        source: { name: "Blob", url: "https://feeds.example/jobs.json" },
        jobs: []
      })
    };
  });
  const env = { JOBS_FEED_URL: "https://feeds.example/jobs.json", JOBS_FEED_MEMORY_MS: "60000" };
  try {
    const stale = await getPublishedJobsFeed(env);
    assert.equal(stale, bundled);
    assert.equal(await getPublishedJobsFeed(env), bundled);
    assert.equal(requests, 1);

    resetPublishedJobsFeedForTests(async () => {
      requests += 1;
      return {
        status: 200,
        etag: "\"same-time\"",
        body: JSON.stringify({
          updatedAt: bundled.updatedAt,
          source: { name: "Blob", url: "https://feeds.example/jobs.json" },
          jobs: []
        })
      };
    });
    const tie = await getPublishedJobsFeed(env);
    assert.equal(tie.updatedAt, bundled.updatedAt);
    assert.notEqual(tie.jobs, bundled.jobs);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("a shared snapshot version bypasses a fresh process cache", async () => {
  const feedUrl = "https://store123.public.blob.vercel-storage.com/jobs/feed.json";
  let version = atOffset(hour);
  let requests = 0;
  resetPublishedJobsFeedForTests(async (url) => {
    requests += 1;
    const snapshot = new URL(url).searchParams.get("v");
    assert.equal(snapshot, version);
    return {
      status: 200,
      etag: `"${version}"`,
      body: feedBody(version, feedUrl)
    };
  }, {
    now: () => 5_000,
    sharedVersion: async () => version
  });
  const env = { JOBS_FEED_URL: feedUrl, JOBS_FEED_MEMORY_MS: "60000" };
  try {
    const first = await getPublishedJobsFeed(env);
    version = atOffset(hour * 2);
    const second = await getPublishedJobsFeed(env);
    const third = await getPublishedJobsFeed(env);
    assert.equal(first.updatedAt, atOffset(hour));
    assert.equal(second.updatedAt, atOffset(hour * 2));
    assert.equal(third, second);
    assert.equal(requests, 2);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("revalidation waits until the published snapshot is readable", async () => {
  const feedUrl = "https://store123.public.blob.vercel-storage.com/jobs/feed.json";
  const previous = atOffset(hour);
  const expected = atOffset(hour * 2);
  let updatedAt = previous;
  let requests = 0;
  resetPublishedJobsFeedForTests(async (url) => {
    requests += 1;
    if (url.includes("/jobs/version")) return { status: 200, etag: null, body: updatedAt };
    return {
      status: 200,
      etag: `"${updatedAt}"`,
      body: feedBody(updatedAt, feedUrl)
    };
  }, { now: () => 5_000 });
  const env = { JOBS_FEED_URL: feedUrl, JOBS_FEED_MEMORY_MS: "60000" };
  try {
    const primed = await getPublishedJobsFeed(env);
    assert.equal(primed.updatedAt, previous);
    const primedRequests = requests;
    const events: string[] = [];
    const stale = await revalidatePublishedFeed(expected, () => {
      events.push(cachedPublishedJobsFeedUpdatedAt() ?? "empty");
    }, env, { attempts: 2, delayMs: 0 });
    assert.equal(stale.revalidated, false);
    assert.equal(events.length, 0);
    assert.equal(cachedPublishedJobsFeedUpdatedAt(), previous);
    assert.ok(requests > primedRequests);
    const afterStale = requests;
    assert.equal((await getPublishedJobsFeed(env)).updatedAt, previous);
    assert.equal(requests, afterStale);

    updatedAt = expected;
    const ready = await revalidatePublishedFeed(expected, () => {
      events.push(cachedPublishedJobsFeedUpdatedAt() ?? "empty");
    }, env, { attempts: 2, delayMs: 0 });
    assert.equal(ready.revalidated, true);
    assert.equal(ready.updatedAt, expected);
    assert.deepEqual([...events], [expected]);
    const afterReady = requests;
    assert.equal((await getPublishedJobsFeed(env)).updatedAt, expected);
    assert.equal(requests, afterReady);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("a current feed revalidates when the version pointer is missing, older, or absent", async () => {
  const feedUrl = "https://store123.public.blob.vercel-storage.com/jobs/feed.json";
  const previous = atOffset(hour);
  const expected = atOffset(hour * 2);
  let versionStatus = 404;
  let version = previous;
  let feedUpdatedAt = expected;
  resetPublishedJobsFeedForTests(async (url) => {
    if (url.includes("/jobs/version")) return { status: versionStatus, etag: null, body: version };
    return { status: 200, etag: "feed", body: feedBody(feedUpdatedAt, feedUrl) };
  }, { now: () => 5_000 });
  const env = { JOBS_FEED_URL: feedUrl, JOBS_FEED_MEMORY_MS: "60000" };
  try {
    const events: string[] = [];
    const missingPointer = await revalidatePublishedFeed(expected, () => {
      events.push("revalidate");
    }, env, { attempts: 1, delayMs: 0 });
    assert.equal(missingPointer.revalidated, true);
    versionStatus = 200;
    const stalePointer = await revalidatePublishedFeed(expected, () => {
      events.push("revalidate");
    }, env, { attempts: 1, delayMs: 0 });
    assert.equal(stalePointer.revalidated, true);
    const customFeed = await revalidatePublishedFeed(expected, () => {
      events.push("revalidate");
    }, { JOBS_FEED_URL: "https://cdn.example/feed.json" }, { attempts: 1, delayMs: 0 });
    assert.equal(customFeed.revalidated, true);
    feedUpdatedAt = previous;
    const staleFeed = await revalidatePublishedFeed(expected, () => {
      events.push("revalidate");
    }, env, { attempts: 1, delayMs: 0 });
    assert.equal(staleFeed.revalidated, false);
    assert.equal(events.length, 3);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("an older version pointer keeps the fresh feed cache and an unchanged pointer reuses the etag", async () => {
  const feedUrl = "https://store123.public.blob.vercel-storage.com/jobs/feed.json";
  let pointer = atOffset(hour * 2);
  let feedUpdatedAt = pointer;
  let requests = 0;
  resetPublishedJobsFeedForTests(async (_url, headers) => {
    requests += 1;
    if (requests === 1) assert.equal(headers["if-none-match"], undefined);
    return { status: 200, etag: `"${feedUpdatedAt}"`, body: feedBody(feedUpdatedAt, feedUrl) };
  }, {
    now: () => 5_000,
    sharedVersion: async () => pointer
  });
  const env = { JOBS_FEED_URL: feedUrl, JOBS_FEED_MEMORY_MS: "60000" };
  try {
    const first = await getPublishedJobsFeed(env);
    const afterFirst = requests;
    pointer = atOffset(hour);
    feedUpdatedAt = atOffset(hour * 3);
    const second = await getPublishedJobsFeed(env);
    assert.equal(second, first);
    assert.equal(requests, afterFirst);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("an unchanged shared version sends If-None-Match after the memory TTL", async () => {
  const feedUrl = "https://store123.public.blob.vercel-storage.com/jobs/feed.json";
  const version = atOffset(hour);
  const body = feedBody(version, feedUrl);
  let requests = 0;
  resetPublishedJobsFeedForTests(async (_url, headers) => {
    requests += 1;
    if (requests === 1) {
      assert.equal(headers["if-none-match"], undefined);
      return { status: 200, etag: "\"feed-1\"", body };
    }
    assert.equal(headers["if-none-match"], "\"feed-1\"");
    return { status: 304, etag: "\"feed-1\"", body: "" };
  }, {
    now: () => 5_000,
    sharedVersion: async () => version
  });
  try {
    const env = { JOBS_FEED_URL: feedUrl, JOBS_FEED_MEMORY_MS: "0" };
    const first = await getPublishedJobsFeed(env);
    const second = await getPublishedJobsFeed(env);
    assert.equal(second, first);
    assert.equal(requests, 2);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("a stale feed read does not replace a newer cached snapshot", async () => {
  const newer = atOffset(hour * 2);
  const older = atOffset(hour);
  let updatedAt = newer;
  resetPublishedJobsFeedForTests(async () => ({
    status: 200,
    etag: updatedAt,
    body: feedBody(updatedAt)
  }), { now: () => 5_000 });
  const env = { JOBS_FEED_URL: "https://cdn.example/feed.json", JOBS_FEED_MEMORY_MS: "0" };
  try {
    const first = await getPublishedJobsFeed(env);
    updatedAt = older;
    const second = await getPublishedJobsFeed(env);
    assert.equal(first.updatedAt, newer);
    assert.equal(second.updatedAt, newer);
    assert.equal(second, first);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("concurrent readers share one feed request until the snapshot version changes", async () => {
  const feedUrl = "https://cdn.example/feed.json";
  let version = atOffset(hour);
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let requests = 0;
  resetPublishedJobsFeedForTests(async () => {
    requests += 1;
    const snapshot = version;
    await firstGate;
    return { status: 200, etag: snapshot, body: feedBody(snapshot, feedUrl) };
  }, {
    now: () => 5_000,
    sharedVersion: async () => version
  });
  const env = { JOBS_FEED_URL: feedUrl, JOBS_FEED_MEMORY_MS: "0" };
  try {
    const first = getPublishedJobsFeed(env);
    const second = getPublishedJobsFeed(env);
    for (let attempt = 0; attempt < 20 && requests < 1; attempt += 1) await Promise.resolve();
    assert.equal(requests, 1);
    version = atOffset(hour * 2);
    const third = getPublishedJobsFeed(env);
    for (let attempt = 0; attempt < 20 && requests < 2; attempt += 1) await Promise.resolve();
    assert.equal(requests, 2);
    releaseFirst?.();
    const [firstFeed, secondFeed, thirdFeed] = await Promise.all([first, second, third]);
    assert.equal(firstFeed, secondFeed);
    assert.equal(firstFeed.updatedAt, atOffset(hour));
    assert.equal(thirdFeed.updatedAt, atOffset(hour * 2));
  } finally {
    releaseFirst?.();
    resetPublishedJobsFeedForTests();
  }
});

test("the tagged version cache uses the daily route lifetime", () => {
  const profile = jobsFeedVersionCacheProfile();
  assert.equal(profile.revalidate, jobsFeedRevalidateSeconds);
  assert.equal(profile.revalidate, 86_400);
  assert.deepEqual([...profile.tags], ["jobs-feed"]);
});

test("a lagging version pointer still publishes the newer feed timestamp", async () => {
  const previous = atOffset(-hour);
  const expected = atOffset(hour);
  assert.equal(selectSharedSnapshotVersion(undefined, expected), expected);
  assert.equal(selectSharedSnapshotVersion(previous, undefined), previous);
  assert.equal(selectSharedSnapshotVersion(undefined, undefined), undefined);
  assert.equal(selectSharedSnapshotVersion(previous, expected), expected);
  assert.equal(selectSharedSnapshotVersion(expected, previous), expected);
  assert.equal(selectSharedSnapshotVersion(expected, expected), expected);

  const feedUrl = "https://store123.public.blob.vercel-storage.com/jobs/feed.json";
  const cached = atOffset(hour);
  const published = atOffset(hour * 2);
  let shared = cached;
  let requests = 0;
  resetPublishedJobsFeedForTests(async (url) => {
    requests += 1;
    const snapshot = new URL(url).searchParams.get("v");
    return {
      status: 200,
      etag: `"${snapshot}"`,
      body: JSON.stringify({
        updatedAt: snapshot,
        source: { name: "Blob", url: feedUrl },
        jobs: []
      })
    };
  }, {
    now: () => 5_000,
    sharedVersion: async () => shared
  });
  const env = { JOBS_FEED_URL: feedUrl, JOBS_FEED_MEMORY_MS: "60000" };
  try {
    const first = await getPublishedJobsFeed(env);
    const afterFirst = requests;
    shared = selectSharedSnapshotVersion(cached, published) ?? published;
    const second = await getPublishedJobsFeed(env);
    assert.equal(first.updatedAt, cached);
    assert.equal(second.updatedAt, published);
    assert.equal(requests, afterFirst + 1);
    assert.notEqual(second, first);
  } finally {
    resetPublishedJobsFeedForTests();
  }
});

test("an aborted feed body rejects instead of hanging", async () => {
  const response = new EventEmitter() as unknown as IncomingMessage;
  Object.assign(response, { headers: {}, statusCode: 200, aborted: false, complete: false });
  let destroyed = false;
  const pending = collectFeedResponse(response, () => {
    destroyed = true;
  });
  response.emit("data", Buffer.from("{\"updatedAt\":"));
  response.aborted = true;
  response.emit("aborted");
  const outcome = await Promise.race([
    pending.then(() => "resolved", (error: unknown) => error),
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 500))
  ]);
  assert.equal(destroyed, true);
  assert.ok(outcome instanceof Error);
  assert.match(outcome.message, /aborted/);

  const errored = new EventEmitter() as unknown as IncomingMessage;
  Object.assign(errored, { headers: {}, statusCode: 200, aborted: false, complete: false });
  const errorPending = collectFeedResponse(errored, () => undefined);
  errored.emit("error", new Error("socket reset"));
  const errorOutcome = await Promise.race([
    errorPending.then(() => "resolved", (error: unknown) => error),
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 500))
  ]);
  assert.ok(errorOutcome instanceof Error);
  assert.match(errorOutcome.message, /socket reset/);
});

test("a dropped feed connection falls back instead of waiting for the inactivity timeout", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write("{\"updatedAt\":");
    response.destroy();
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  resetPublishedJobsFeedForTests();
  const started = Date.now();
  try {
    const feed = await Promise.race([
      getPublishedJobsFeed({
        JOBS_FEED_URL: `http://127.0.0.1:${port}/jobs/feed.json`,
        JOBS_FEED_MEMORY_MS: "60000"
      }),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error("feed read hung")), 2_000);
      })
    ]);
    assert.equal(feed, bundled);
    assert.ok(Date.now() - started < 2_000);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    resetPublishedJobsFeedForTests();
  }
});

test("a complete feed response is readable over HTTP", async () => {
  const updatedAt = atOffset(hour);
  const server = createServer((_request, response) => {
    const body = JSON.stringify({
      updatedAt,
      source: { name: "Blob", url: "http://127.0.0.1/jobs/feed.json" },
      jobs: []
    });
    response.writeHead(200, { "content-type": "application/json", etag: "\"ok\"" });
    response.end(body);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  resetPublishedJobsFeedForTests();
  try {
    const feed = await getPublishedJobsFeed({
      JOBS_FEED_URL: `http://127.0.0.1:${port}/jobs/feed.json`,
      JOBS_FEED_MEMORY_MS: "0"
    });
    assert.equal(feed.updatedAt, updatedAt);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
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
