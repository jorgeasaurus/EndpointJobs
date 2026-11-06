import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { serpApiJobSourceName } from "../../src/lib/job-sources";
import type { Job } from "../../src/types/job";
import {
  loadPublishedRetentionSnapshot,
  readPreviousFeedJobs,
  resolveRetentionFeedPath
} from "../job-refresh/retention-snapshot";

const feedUrl = "https://store123.public.blob.vercel-storage.com/jobs/feed.json";

test("retention loads the published snapshot and ignores a missing download", async () => {
  const directory = await mkdtemp(join(tmpdir(), "retention-snapshot-"));
  const committed = join(directory, "jobs.json");
  const published = join(directory, "published.json");
  const missing = join(directory, "missing.json");
  await writeFile(committed, feedBody("committed-job"), "utf8");
  try {
    const skipped = await loadPublishedRetentionSnapshot({
      env: { JOB_PREVIOUS_FEED_PATH: published }
    });
    assert.equal(skipped.status, "skipped");

    const missingFeed = await loadPublishedRetentionSnapshot({
      env: { JOB_PREVIOUS_FEED_PATH: published, JOBS_FEED_URL: feedUrl },
      read: async () => ({ status: 404, body: "" })
    });
    assert.equal(missingFeed.status, "missing");
    await assert.rejects(access(published));
    assert.equal(await resolveRetentionFeedPath(committed, { JOB_PREVIOUS_FEED_PATH: missing }), committed);

    const failed = await loadPublishedRetentionSnapshot({
      env: { JOB_PREVIOUS_FEED_PATH: published, JOBS_FEED_URL: feedUrl },
      read: async () => ({ status: 500, body: "" })
    });
    assert.equal(failed.status, "failed");
    await assert.rejects(access(published));

    const loaded = await loadPublishedRetentionSnapshot({
      env: { JOB_PREVIOUS_FEED_PATH: published, BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_store123_secret" },
      read: async (url) => {
        assert.equal(url, feedUrl);
        return { status: 200, body: feedBody("published-job") };
      }
    });
    assert.equal(loaded.status, "loaded");
    assert.equal(await readFile(published, "utf8"), feedBody("published-job"));
    assert.equal(
      await resolveRetentionFeedPath(committed, { JOB_PREVIOUS_FEED_PATH: published }),
      published
    );
    const jobs = await readPreviousFeedJobs(published);
    assert.deepEqual(jobs.map((job) => job.id), ["published-job"]);
    const committedJobs = await readPreviousFeedJobs(committed);
    assert.deepEqual(committedJobs.map((job) => job.id), ["committed-job"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("refresh workflow loads the published snapshot before SerpAPI retention", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const workflow = readFileSync(join(root, ".github/workflows/refresh-jobs.yml"), "utf8");
  const refresh = readFileSync(join(root, "scripts/refresh-jobs.ts"), "utf8");
  const loadAt = workflow.indexOf("jobs:load-retention");
  const refreshAt = workflow.indexOf("npm run jobs:refresh");
  assert.ok(loadAt > 0 && refreshAt > loadAt);
  assert.match(workflow, /JOB_PREVIOUS_FEED_PATH: \$\{\{ runner\.temp \}\}\/published-jobs\.json/);
  assert.match(refresh, /resolveRetentionFeedPath\(outputPath\)/);
});

function feedBody(id: string) {
  return JSON.stringify({
    updatedAt: "2026-11-06T00:00:00.000Z",
    source: { name: "Previous feed", url: "https://example.com/feed" },
    jobs: [makeJob(id)]
  });
}

function makeJob(id: string): Job {
  return {
    id,
    title: "Endpoint Engineer",
    company: "Example Company",
    location: "Remote",
    workplace: "Remote",
    postedAt: "2026-07-08T12:00:00.000Z",
    fetchedAt: "2026-07-10T12:00:00.000Z",
    staleAfter: "2026-08-20T12:00:00.000Z",
    source: serpApiJobSourceName,
    sourceUrl: `https://example.com/jobs/${id}`,
    applyUrl: `https://example.com/jobs/${id}`,
    attributionLabel: "Google Jobs via SerpAPI",
    termsProfile: "partner-terms",
    summary: "Manage Microsoft Intune and Windows endpoints.",
    tags: ["Endpoint", "Intune"],
    matchReasons: ["Endpoint engineering"],
    tools: ["Intune"],
    platforms: ["Windows"],
    roleFamily: "Endpoint Engineering",
    seniority: "Mid",
    employmentType: "Full-time"
  };
}
