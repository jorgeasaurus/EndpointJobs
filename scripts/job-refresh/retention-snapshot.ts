import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { jobsFeedReadUrl } from "../../src/lib/jobs-feed-config";
import { parsePublishedJobsFeed } from "../../src/lib/published-jobs-feed";
import type { Job, JobsFeed } from "../../src/types/job";
import { getValidatedPreviousSerpApiJobs } from "./retained-jobs";

export type RetentionLoadResult =
  | { status: "skipped"; detail: string }
  | { status: "missing"; detail: string }
  | { status: "loaded"; path: string; detail: string }
  | { status: "failed"; detail: string };

type RetentionEnv = {
  BLOB_READ_WRITE_TOKEN?: string;
  JOB_PREVIOUS_FEED_PATH?: string;
  JOBS_FEED_URL?: string;
  [key: string]: string | undefined;
};

type SnapshotRead = (url: string) => Promise<{ status: number; body: string }>;

/**
 * Use the downloaded blob when it is current, and the committed file when that
 * commit is newer. A failed blob upload can leave an older public object behind.
 */
export async function resolveRetentionFeedPath(outputPath: string, env: RetentionEnv = process.env) {
  const override = env.JOB_PREVIOUS_FEED_PATH?.trim();
  if (!override) return outputPath;

  const downloadedAt = await readSnapshotUpdatedAt(override);
  if (downloadedAt === undefined) return outputPath;

  const committedAt = await readSnapshotUpdatedAt(outputPath);
  if (committedAt !== undefined && committedAt > downloadedAt) {
    console.log("Committed jobs feed is newer than the published blob. SerpAPI retention will use the committed snapshot.");
    return outputPath;
  }
  return override;
}

export async function readPreviousFeedJobs(path: string): Promise<Job[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));

    if (!isJobsFeed(parsed)) {
      console.warn(`Skipping SerpAPI retention because ${path} is not a jobs feed`);
      return [];
    }

    return getValidatedPreviousSerpApiJobs(parsed);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    console.warn(
      `Skipping SerpAPI retention because the previous feed could not be loaded as a valid jobs feed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }
}

export async function loadPublishedRetentionSnapshot(options?: {
  env?: RetentionEnv;
  read?: SnapshotRead;
}): Promise<RetentionLoadResult> {
  const env = options?.env ?? process.env;
  const destination = env.JOB_PREVIOUS_FEED_PATH?.trim();
  if (!destination) {
    return {
      status: "skipped",
      detail: "JOB_PREVIOUS_FEED_PATH is unset. SerpAPI retention will use the committed snapshot."
    };
  }

  const url = jobsFeedReadUrl({
    BLOB_READ_WRITE_TOKEN: env.BLOB_READ_WRITE_TOKEN,
    JOBS_FEED_URL: env.JOBS_FEED_URL
  });
  if (!url) {
    return {
      status: "skipped",
      detail: "No published jobs feed is configured. SerpAPI retention will use the committed snapshot."
    };
  }

  try {
    const response = await (options?.read ?? readPublishedSnapshot)(url);
    if (response.status === 404) {
      return {
        status: "missing",
        detail: "Published jobs feed is not on the blob store yet. SerpAPI retention will use the committed snapshot."
      };
    }
    if (response.status !== 200) {
      return {
        status: "failed",
        detail: `Published jobs feed request failed with status ${response.status}. SerpAPI retention will use the committed snapshot.`
      };
    }
    if (!parsePublishedJobsFeed(response.body)) {
      return {
        status: "failed",
        detail: "Published jobs feed payload is not a jobs snapshot. SerpAPI retention will use the committed snapshot."
      };
    }

    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, response.body, "utf8");
    return {
      status: "loaded",
      path: destination,
      detail: `Loaded published jobs feed into ${destination} for SerpAPI retention.`
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      detail: `Could not load the published jobs feed (${reason}). SerpAPI retention will use the committed snapshot.`
    };
  }
}

async function readPublishedSnapshot(url: string) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "accept-encoding": "identity", "cache-control": "no-cache" },
    signal: AbortSignal.timeout(15_000)
  });
  return { status: response.status, body: await response.text() };
}

async function readSnapshotUpdatedAt(path: string) {
  try {
    const parsed = parsePublishedJobsFeed(await readFile(path, "utf8"));
    if (!parsed) return undefined;
    const time = Date.parse(parsed.updatedAt);
    return Number.isFinite(time) ? time : undefined;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    return undefined;
  }
}

function isJobsFeed(value: unknown): value is JobsFeed {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JobsFeed>;
  return typeof candidate.updatedAt === "string" && Boolean(candidate.source) && Array.isArray(candidate.jobs);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
