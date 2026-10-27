import feedData from "@/data/jobs.json";
import { getActiveBoardFeed } from "@/lib/board-page";
import type { JobsFeed } from "@/types/job";

const source = feedData as JobsFeed;
const hourMs = 3_600_000;

let cached: { feed: JobsFeed; key: string } | undefined;

/**
 * Prepares the active feed once per isolate. The key changes when the feed
 * file changes or the hour changes, so listing expiry still moves.
 */
export function getMemoizedActiveBoardFeed(now = new Date()): JobsFeed {
  const bucket = Math.floor(now.getTime() / hourMs);
  const key = `${source.updatedAt}:${bucket}`;

  if (cached?.key === key) return cached.feed;

  const feed = getActiveBoardFeed(source, new Date(bucket * hourMs));
  cached = { feed, key };
  return feed;
}
