import feedData from "@/data/jobs.json";
import { getActiveBoardFeed } from "@/lib/board-page";
import type { JobsFeed } from "@/types/job";

const bundledFeed = feedData as JobsFeed;
const hourMs = 3_600_000;

let cached: { feed: JobsFeed; key: string; source: JobsFeed } | undefined;

/**
 * Prepares the active feed once per isolate. The key changes when the feed
 * snapshot changes or the hour changes, so listing expiry still moves.
 */
export function getMemoizedActiveBoardFeed(now = new Date(), source: JobsFeed = bundledFeed): JobsFeed {
  const bucket = Math.floor(now.getTime() / hourMs);
  const key = `${source.updatedAt}:${bucket}`;

  if (cached?.key === key && cached.source === source) return cached.feed;

  const feed = getActiveBoardFeed(source, new Date(bucket * hourMs));
  cached = { feed, key, source };
  return feed;
}
