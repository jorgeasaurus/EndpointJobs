/** Stable pathname of the published feed inside the Vercel Blob store. */
export const jobsFeedPathname = "jobs/feed.json";

/** In-process reuse window for a parsed remote feed. */
export const jobsFeedMemoryTtlMs = 60_000;

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
