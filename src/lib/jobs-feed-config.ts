/** Stable pathname of the published feed inside the Vercel Blob store. */
export const jobsFeedPathname = "jobs/feed.json";

/** Tiny pointer rewritten after each blob publish. Readers cache-bust it. */
export const jobsFeedVersionPathname = "jobs/version";

/** Next.js data-cache tag for the published snapshot version. */
export const jobsFeedCacheTag = "jobs-feed";

/** In-process reuse window for a parsed remote feed. */
export const jobsFeedMemoryTtlMs = 60_000;

/**
 * After a missing or failed remote read, skip the network until this passes.
 * Independent of a successful snapshot's freshness window.
 */
export const jobsFeedRetryBackoffMs = 60_000;

/** Daily ISR backstop when the publish webhook does not reach the deployment. */
export const jobsFeedRevalidateSeconds = 86_400;

export const defaultJobsFeedRevalidateUrl = "https://endpointjobs.dev/api/internal/revalidate";

/**
 * Public blob URL for the published feed.
 * `JOBS_FEED_URL` wins. Otherwise the store id is the fourth `_` segment of
 * `BLOB_READ_WRITE_TOKEN`, matching `@vercel/blob` token parsing.
 */
export function jobsFeedReadUrl(env: {
  BLOB_READ_WRITE_TOKEN?: string;
  JOBS_FEED_URL?: string;
}): string | undefined {
  const explicit = env.JOBS_FEED_URL?.trim();
  if (explicit) return explicit;

  const token = env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return undefined;

  const storeId = token.split("_")[3] ?? "";
  if (!storeId) return undefined;
  return `https://${storeId}.public.blob.vercel-storage.com/${jobsFeedPathname}`;
}

/** Version pointer next to a `jobs/feed.json` blob URL. Custom feed URLs have none. */
export function jobsFeedVersionUrl(feedUrl: string): string | undefined {
  let url: URL;
  try {
    url = new URL(feedUrl);
  } catch {
    return undefined;
  }

  const suffix = `/${jobsFeedPathname}`;
  if (!url.pathname.endsWith(suffix)) return undefined;
  url.pathname = `${url.pathname.slice(0, -jobsFeedPathname.length)}${jobsFeedVersionPathname}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** Cache-busted feed URL. Each snapshot id is its own CDN entry. */
export function jobsFeedSnapshotUrl(feedUrl: string, snapshot: string): string {
  const url = new URL(feedUrl);
  url.searchParams.set("v", snapshot);
  return url.toString();
}
