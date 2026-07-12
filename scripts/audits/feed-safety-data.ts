import { readFile } from "node:fs/promises";

import { shouldWriteFeed, validateFeed } from "../job-refresh/feed-safety";
import type { Job, JobsFeed } from "../../src/types/job";

type RunAudit = (
  id: string,
  detail: string,
  audit: () => Promise<void> | void
) => Promise<void>;

export async function auditFeedSafetyData(run: RunAudit) {
  await run("FEAT-073", "Feed validation and empty-write protection reject unsafe output", async () => {
    const validJob = makeValidJob();
    validateFeed(makeFeed([validJob]));

    assertThrows(
      () => validateFeed(makeFeed([validJob, { ...validJob }])),
      "Duplicate job id"
    );
    assertThrows(
      () => validateFeed(makeFeed([{ ...validJob, matchReasons: [] }])),
      "missing matchReasons"
    );
    assertThrows(
      () => validateFeed(makeFeed([{ ...validJob, mapLocation: { label: "Invalid", latitude: Number.NaN, longitude: 0 } }])),
      "invalid mapLocation coordinates"
    );
    assertThrows(
      () => validateFeed(makeFeed([{ ...validJob, mapLocation: { label: "Invalid", latitude: 91, longitude: 181 } }])),
      "invalid mapLocation coordinates"
    );

    const adzunaJob = makeValidJob({
      id: "adzuna-job",
      source: "Adzuna",
      sourceUrl: "https://www.adzuna.com/details/safe",
      applyUrl: "https://www.adzuna.com/details/safe",
      description: "Clipped provider snippet"
    });
    assertThrows(() => validateFeed(makeFeed([adzunaJob])), "stores a snippet as description");
    assertThrows(
      () => validateFeed(makeFeed([{ ...adzunaJob, description: undefined }]), [adzunaJob.sourceUrl]),
      "is still present in feed"
    );

    assertEqual(shouldWriteFeed(0, false), false, "empty feed should be preserved by default");
    assertEqual(shouldWriteFeed(0, true), true, "explicit empty-feed override should write");
    assertEqual(shouldWriteFeed(1, false), true, "non-empty feed should write");

    const refreshSource = await readFile("scripts/refresh-jobs.ts", "utf8");
    assertOrdered(refreshSource, [
      "validateFeed(feed, excludedSourceUrls)",
      "shouldWriteFeed(normalizedJobs.length",
      "writeFile(outputPath"
    ]);
  });
}

function assertOrdered(value: string, expected: string[]) {
  let previousIndex = -1;

  for (const text of expected) {
    const index = value.indexOf(text);
    if (index <= previousIndex) {
      throw new Error(`expected ${text} after the prior refresh safety step`);
    }
    previousIndex = index;
  }
}

function makeFeed(jobs: Job[]): JobsFeed {
  return {
    updatedAt: "2026-07-11T00:00:00.000Z",
    source: { name: "Audit", url: "https://example.com/feed" },
    jobs
  };
}

function makeValidJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "safe-job",
    title: "Endpoint Engineer",
    company: "Audit Company",
    location: "Remote",
    workplace: "Remote",
    postedAt: "2026-07-10T00:00:00.000Z",
    fetchedAt: "2026-07-11T00:00:00.000Z",
    staleAfter: "2026-08-10T00:00:00.000Z",
    source: "Audit",
    sourceUrl: "https://example.com/job",
    applyUrl: "https://example.com/job",
    attributionLabel: "Audit",
    termsProfile: "public-api",
    summary: "Endpoint engineering role.",
    tags: ["Endpoint"],
    matchReasons: ["Endpoint engineering"],
    tools: ["Intune"],
    platforms: ["Windows"],
    roleFamily: "Endpoint Engineering",
    seniority: "Mid",
    employmentType: "Full-time",
    ...overrides
  };
}

function assertThrows(action: () => void, expectedMessage: string) {
  try {
    action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(expectedMessage)) {
      return;
    }
    throw new Error(`expected error containing ${expectedMessage}, got ${message}`);
  }

  throw new Error(`expected error containing ${expectedMessage}`);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
