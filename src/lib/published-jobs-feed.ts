import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";

import bundledFeedData from "@/data/jobs.json";
import {
  jobsFeedCacheTag,
  jobsFeedMemoryTtlMs,
  jobsFeedRetryBackoffMs,
  jobsFeedReadUrl,
  jobsFeedRevalidateSeconds,
  jobsFeedSnapshotUrl,
  jobsFeedVersionUrl
} from "@/lib/jobs-feed-config";
import type { JobsFeed } from "@/types/job";

const bundledFeed = bundledFeedData as JobsFeed;
const maximumFeedBytes = 20_000_000;

type RemoteFeed = { etag: string; feed: JobsFeed };
type FeedResponse = { body: string; etag: string | null; status: number };
type FeedTransport = (url: string, headers: Record<string, string>) => Promise<FeedResponse>;
type CachedFeed = {
  etag: string;
  feed: JobsFeed;
  freshUntil: number;
  remote: JobsFeed;
  version: string;
};

export type FeedEnv = {
  BLOB_READ_WRITE_TOKEN?: string;
  JOBS_FEED_MEMORY_MS?: string;
  JOBS_FEED_URL?: string;
};

type RevalidateFeedOptions = { attempts?: number; delayMs?: number };

let memory: CachedFeed | undefined;
let retryNotBefore = 0;
let blockedVersion: string | undefined;
let inflight: { key: string; promise: Promise<JobsFeed> } | undefined;
let transport: FeedTransport = requestFeed;
let nowFn: () => number = () => Date.now();
let sharedVersionReader: (() => Promise<string | undefined>) | undefined;

export function resetPublishedJobsFeedForTests(
  nextTransport?: FeedTransport,
  options?: { now?: () => number; sharedVersion?: () => Promise<string | undefined> }
) {
  memory = undefined;
  retryNotBefore = 0;
  blockedVersion = undefined;
  inflight = undefined;
  transport = nextTransport ?? requestFeed;
  nowFn = options?.now ?? (() => Date.now());
  sharedVersionReader = options?.sharedVersion;
}

/** Bundled snapshot, or the blob feed when publish credentials are configured. */
export async function getPublishedJobsFeed(env: FeedEnv = currentFeedEnv()): Promise<JobsFeed> {
  const url = jobsFeedReadUrl(env);
  if (!url) return bundledFeed;

  const now = nowFn();
  const sharedVersion = await currentSharedVersion(url);
  const versionAdvanced = sharedVersion !== undefined
    && snapshotTime(sharedVersion) > snapshotTime(memory?.version ?? "");
  const versionChanged = versionAdvanced && sharedVersion !== blockedVersion;

  if (!versionChanged && memory && now < memory.freshUntil) return memory.feed;
  if (!versionChanged && now < retryNotBefore) return fallbackFeed();

  const flightKey = `${url}\0${sharedVersion ?? ""}\0${versionAdvanced ? "next" : "same"}`;
  if (inflight?.key === flightKey) return inflight.promise;

  const promise = refreshPublishedFeed(url, env, now, sharedVersion, versionAdvanced);
  inflight = { key: flightKey, promise };
  try {
    return await promise;
  } finally {
    if (inflight?.promise === promise) inflight = undefined;
  }
}

async function refreshPublishedFeed(
  url: string,
  env: FeedEnv,
  now: number,
  sharedVersion: string | undefined,
  versionAdvanced: boolean
) {
  try {
    const readUrl = sharedVersion ? jobsFeedSnapshotUrl(url, sharedVersion) : url;
    const loaded = await readRemoteFeed(readUrl, versionAdvanced ? undefined : memory?.etag);
    if (!loaded) {
      noteFailure(now, sharedVersion);
      return fallbackFeed();
    }
    return rememberFeed(loaded, now, env);
  } catch (error) {
    console.error("Published jobs feed could not be read. Using the last good snapshot.", error);
    noteFailure(now, sharedVersion);
    return fallbackFeed();
  }
}

/**
 * Read the published snapshot, then run `revalidate`.
 * Pages stay cached when the expected snapshot is not readable yet.
 */
export async function revalidatePublishedFeed(
  expectedUpdatedAt: string | undefined,
  revalidate: () => void,
  env: FeedEnv = currentFeedEnv(),
  options: RevalidateFeedOptions = {}
): Promise<{ revalidated: boolean; updatedAt?: string }> {
  const preserved = memory;
  memory = undefined;
  retryNotBefore = 0;
  blockedVersion = undefined;

  const url = jobsFeedReadUrl(env);
  if (!url) {
    const ready = !expectedUpdatedAt || isSnapshotCurrent(bundledFeed.updatedAt, expectedUpdatedAt);
    if (!ready) {
      memory = preserved;
      return { revalidated: false, updatedAt: bundledFeed.updatedAt };
    }
    revalidate();
    return { revalidated: true, updatedAt: bundledFeed.updatedAt };
  }

  const attempts = options.attempts ?? 4;
  const delayMs = options.delayMs ?? 200;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const loaded = await readReadySnapshot(url, expectedUpdatedAt);
    if (loaded) {
      const selected = rememberFeed(loaded, nowFn(), env);
      revalidate();
      return { revalidated: true, updatedAt: selected.updatedAt };
    }
    if (attempt < attempts - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  memory = preserved;
  return { revalidated: false, updatedAt: preserved?.feed.updatedAt };
}

export function parsePublishedJobsFeed(body: string): JobsFeed | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const feed = parsed as JobsFeed;
  if (typeof feed.updatedAt !== "string" || !Array.isArray(feed.jobs)) return undefined;
  return feed;
}

export function cachedPublishedJobsFeedUpdatedAt() {
  return memory?.feed.updatedAt;
}

/** Daily lifetime so this tagged read does not shorten route ISR below 86400. */
export function jobsFeedVersionCacheProfile() {
  return { revalidate: jobsFeedRevalidateSeconds, tags: [jobsFeedCacheTag] };
}

/** Resolve a feed body, and reject when the socket aborts or errors mid-body. */
export function collectFeedResponse(
  response: IncomingMessage,
  destroyRequest: (error?: Error) => void
): Promise<FeedResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishResolve = (value: FeedResponse) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const finishReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      const reason = error instanceof Error ? error : new Error("Jobs feed response failed");
      reject(reason);
    };

    const chunks: Buffer[] = [];
    let received = 0;
    response.on("data", (chunk: Buffer | string) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += buffer.length;
      if (received > maximumFeedBytes) {
        const error = new Error("Jobs feed is larger than 20MB");
        destroyRequest(error);
        finishReject(error);
        return;
      }
      chunks.push(buffer);
    });
    response.on("error", (error: Error) => {
      destroyRequest(error);
      finishReject(error);
    });
    response.on("aborted", () => {
      const error = new Error("Jobs feed response aborted");
      destroyRequest(error);
      finishReject(error);
    });
    response.on("end", () => {
      if (response.aborted || response.complete === false) {
        finishReject(new Error("Jobs feed response aborted"));
        return;
      }
      const header = response.headers.etag;
      finishResolve({
        status: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
        etag: typeof header === "string" ? header : null
      });
    });
  });
}

async function readReadySnapshot(url: string, expectedUpdatedAt: string | undefined): Promise<RemoteFeed | null> {
  try {
    // The feed body is the readiness check. revalidateTag then refills the shared
    // version from the newer of the pointer and this timestamp, including custom
    // feed URLs, so warm instances bypass their in-memory snapshot.
    const readUrl = expectedUpdatedAt ? jobsFeedSnapshotUrl(url, expectedUpdatedAt) : url;
    const loaded = await readRemoteFeed(readUrl, undefined);
    if (!loaded) return null;
    if (expectedUpdatedAt && !isSnapshotCurrent(loaded.feed.updatedAt, expectedUpdatedAt)) return null;
    return loaded;
  } catch (error) {
    console.error("Published jobs snapshot was not readable for revalidation.", error);
    return null;
  }
}

async function readRemoteFeed(url: string, etag: string | undefined): Promise<RemoteFeed | null> {
  const headers: Record<string, string> = { "accept-encoding": "identity" };
  if (etag) headers["if-none-match"] = etag;

  const response = await transport(url, headers);
  if (response.status === 304 && memory) return { etag: memory.etag, feed: memory.remote };
  if (response.status === 404) return null;
  if (response.status !== 200) {
    throw new Error(`Jobs feed request failed with status ${response.status}`);
  }

  const feed = parsePublishedJobsFeed(response.body);
  if (!feed) throw new Error("Jobs feed payload is not a jobs snapshot");
  return { etag: response.etag ?? feed.updatedAt, feed };
}

async function currentSharedVersion(feedUrl: string): Promise<string | undefined> {
  try {
    if (sharedVersionReader) return await sharedVersionReader();
    if (!process.env.NEXT_RUNTIME) return undefined;
    return await readTaggedSnapshotVersion(feedUrl);
  } catch (error) {
    console.error("Jobs feed version could not be read. Using the last cached snapshot.", error);
    return undefined;
  }
}

// Tagged with jobs-feed so revalidateTag drops the version on every instance.
// The value is the newer of the pointer and the feed body, including custom
// feed URLs that have no pointer. A newer value bypasses process-local memory.
async function readTaggedSnapshotVersion(feedUrl: string): Promise<string | undefined> {
  const { unstable_cache } = await import("next/cache");
  const readVersion = unstable_cache(
    async () => {
      const pointer = jobsFeedVersionUrl(feedUrl) ? await readSnapshotVersionDirect(feedUrl) : undefined;
      const feedUpdatedAt = await readFeedUpdatedAtDirect(feedUrl);
      return selectSharedSnapshotVersion(pointer, feedUpdatedAt) ?? "";
    },
    ["jobs-feed-version", feedUrl],
    jobsFeedVersionCacheProfile()
  );
  const version = await readVersion();
  return version || undefined;
}

/** Prefer the feed timestamp when the version pointer is missing or older. */
export function selectSharedSnapshotVersion(pointer: string | undefined, feedUpdatedAt: string | undefined) {
  if (!pointer) return feedUpdatedAt;
  if (!feedUpdatedAt) return pointer;
  return snapshotTime(feedUpdatedAt) >= snapshotTime(pointer) ? feedUpdatedAt : pointer;
}

async function readFeedUpdatedAtDirect(feedUrl: string): Promise<string | undefined> {
  try {
    const loaded = await readRemoteFeed(jobsFeedSnapshotUrl(feedUrl, `validated-${nowFn()}`), undefined);
    return loaded?.feed.updatedAt;
  } catch (error) {
    console.error("Published jobs feed timestamp could not be read.", error);
    return undefined;
  }
}

async function readSnapshotVersionDirect(feedUrl: string): Promise<string | undefined> {
  const versionUrl = jobsFeedVersionUrl(feedUrl);
  if (!versionUrl) return undefined;
  const probe = new URL(versionUrl);
  probe.searchParams.set("t", String(nowFn()));
  try {
    const response = await transport(probe.toString(), {
      accept: "text/plain",
      "accept-encoding": "identity",
      "cache-control": "no-cache"
    });
    if (response.status !== 200) return undefined;
    const version = response.body.trim();
    if (!Number.isFinite(Date.parse(version))) return undefined;
    return version;
  } catch (error) {
    console.error("Published jobs feed version could not be read.", error);
    return undefined;
  }
}

function currentFeedEnv(): FeedEnv {
  return {
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    JOBS_FEED_URL: process.env.JOBS_FEED_URL,
    JOBS_FEED_MEMORY_MS: process.env.JOBS_FEED_MEMORY_MS
  };
}

function memoryTtlMs(env: FeedEnv) {
  const configured = Number(env.JOBS_FEED_MEMORY_MS);
  if (Number.isFinite(configured) && configured >= 0) return configured;
  return jobsFeedMemoryTtlMs;
}

function rememberFeed(loaded: RemoteFeed, now: number, env: FeedEnv) {
  if (memory && snapshotTime(loaded.feed.updatedAt) < snapshotTime(memory.version)) {
    memory = { ...memory, freshUntil: now + memoryTtlMs(env) };
    return memory.feed;
  }

  const selected = selectPublishedFeed(loaded.feed);
  memory = {
    etag: loaded.etag,
    feed: selected,
    freshUntil: now + memoryTtlMs(env),
    remote: loaded.feed,
    version: loaded.feed.updatedAt
  };
  retryNotBefore = 0;
  blockedVersion = undefined;
  return selected;
}

function noteFailure(now: number, sharedVersion: string | undefined) {
  retryNotBefore = now + jobsFeedRetryBackoffMs;
  if (sharedVersion) blockedVersion = sharedVersion;
}

function fallbackFeed() {
  return memory ? selectPublishedFeed(memory.feed) : bundledFeed;
}

function selectPublishedFeed(remote: JobsFeed) {
  return snapshotTime(bundledFeed.updatedAt) > snapshotTime(remote.updatedAt) ? bundledFeed : remote;
}

function isSnapshotCurrent(actual: string, expected: string) {
  return snapshotTime(actual) >= snapshotTime(expected);
}

function snapshotTime(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function requestFeed(url: string, headers: Record<string, string>): Promise<FeedResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = (target.protocol === "http:" ? httpRequest : httpsRequest)(
      target,
      { headers, method: "GET" },
      (response: IncomingMessage) => {
        collectFeedResponse(response, (error) => {
          request.destroy(error);
        }).then(resolve, reject);
      }
    );
    request.setTimeout(15_000, () => {
      request.destroy(new Error("Jobs feed request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}
