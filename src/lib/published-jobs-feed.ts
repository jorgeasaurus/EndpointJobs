import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import bundledFeedData from "@/data/jobs.json";
import { jobsFeedMemoryTtlMs, jobsFeedReadUrl } from "@/lib/jobs-feed-config";
import type { JobsFeed } from "@/types/job";

const bundledFeed = bundledFeedData as JobsFeed;
const maximumFeedBytes = 20_000_000;

type RemoteFeed = { etag: string; feed: JobsFeed };
type FeedResponse = { body: string; etag: string | null; status: number };
type FeedTransport = (url: string, headers: Record<string, string>) => Promise<FeedResponse>;

let memory: { etag: string; feed: JobsFeed; freshUntil: number } | undefined;
let transport: FeedTransport = requestFeed;

export function resetPublishedJobsFeedForTests(nextTransport?: FeedTransport) {
  memory = undefined;
  transport = nextTransport ?? requestFeed;
}

type FeedEnv = {
  BLOB_READ_WRITE_TOKEN?: string;
  JOBS_FEED_MEMORY_MS?: string;
  JOBS_FEED_URL?: string;
};

/** Bundled snapshot, or the blob feed when publish credentials are configured. */
export async function getPublishedJobsFeed(env: FeedEnv = currentFeedEnv()): Promise<JobsFeed> {
  const url = jobsFeedReadUrl(env);
  if (!url) return bundledFeed;

  const now = Date.now();
  if (memory && now < memory.freshUntil) return memory.feed;

  try {
    const loaded = await readRemoteFeed(url, memory?.etag);
    if (!loaded) return memory?.feed ?? bundledFeed;
    memory = { ...loaded, freshUntil: now + memoryTtlMs(env) };
    return loaded.feed;
  } catch (error) {
    console.error("Published jobs feed could not be read. Using the last good snapshot.", error);
    return memory?.feed ?? bundledFeed;
  }
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

async function readRemoteFeed(url: string, etag: string | undefined): Promise<RemoteFeed | null> {
  const headers: Record<string, string> = { "accept-encoding": "identity" };
  if (etag) headers["if-none-match"] = etag;

  const response = await transport(url, headers);
  if (response.status === 304 && memory) return { etag: memory.etag, feed: memory.feed };
  if (response.status === 404) return null;
  if (response.status !== 200) {
    throw new Error(`Jobs feed request failed with status ${response.status}`);
  }

  const feed = parsePublishedJobsFeed(response.body);
  if (!feed) throw new Error("Jobs feed payload is not a jobs snapshot");
  return { etag: response.etag ?? feed.updatedAt, feed };
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

function requestFeed(url: string, headers: Record<string, string>): Promise<FeedResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = (target.protocol === "http:" ? httpRequest : httpsRequest)(
      target,
      { headers, method: "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        let received = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          received += buffer.length;
          if (received > maximumFeedBytes) {
            request.destroy(new Error("Jobs feed is larger than 20MB"));
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          const header = response.headers.etag;
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            etag: typeof header === "string" ? header : null
          });
        });
      }
    );
    request.setTimeout(15_000, () => {
      request.destroy(new Error("Jobs feed request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}
