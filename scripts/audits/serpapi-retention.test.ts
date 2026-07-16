import assert from "node:assert/strict";
import test from "node:test";

import {
  getValidatedPreviousSerpApiJobs,
  mergeRetainedSerpApiJobs
} from "../job-refresh/retained-jobs";
import { serpApiJobSourceName } from "../../src/lib/job-sources";
import type { Job } from "../../src/types/job";

test("refresh retains only recent SerpAPI jobs without changing their timestamps", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");
  const current = makeJob({
    id: "rediscovered",
    fetchedAt: now.toISOString(),
    sourceUrl: "https://example.com/jobs/rediscovered"
  });
  const jobs = mergeRetainedSerpApiJobs([
    current
  ], [
    makeJob({
      id: "rediscovered",
      fetchedAt: "2026-07-15T12:00:00.000Z",
      sourceUrl: "https://example.com/jobs/rediscovered"
    }),
    makeJob({
      id: "carried",
      fetchedAt: "2026-07-09T12:00:00.000Z",
      sourceUrl: "https://example.com/jobs/carried"
    }),
    makeJob({
      id: "too-old",
      fetchedAt: "2026-07-09T11:59:59.999Z",
      sourceUrl: "https://example.com/jobs/too-old"
    }),
    makeJob({
      id: "invalid-date",
      fetchedAt: "not-a-date",
      sourceUrl: "https://example.com/jobs/invalid-date"
    }),
    makeJob({
      id: "other-source",
      fetchedAt: "2026-07-15T12:00:00.000Z",
      source: "Adzuna",
      sourceUrl: "https://example.com/jobs/other-source"
    })
  ], now);

  assert.deepEqual(jobs.map((job) => job.id), ["rediscovered", "carried"]);
  assert.equal(jobs[0], current);
  assert.equal(jobs[1]?.fetchedAt, "2026-07-09T12:00:00.000Z");
});

test("retention validation ignores invalid jobs from unrelated providers", () => {
  const serpApiJob = makeJob({ id: "retained" });
  const previousJobs = getValidatedPreviousSerpApiJobs({
    updatedAt: "2026-07-16T12:00:00.000Z",
    source: { name: "Previous feed", url: "https://example.com/feed" },
    jobs: [
      serpApiJob,
      makeJob({
        id: "invalid-adzuna",
        source: "Adzuna",
        description: "Provider snippet that is invalid for Adzuna",
        sourceUrl: "https://example.com/jobs/invalid-adzuna"
      })
    ]
  });

  assert.deepEqual(previousJobs, [serpApiJob]);
});

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "serpapi-job",
    title: "Endpoint Engineer",
    company: "Example Company",
    location: "Remote",
    workplace: "Remote",
    postedAt: "2026-07-08T12:00:00.000Z",
    fetchedAt: "2026-07-10T12:00:00.000Z",
    staleAfter: "2026-08-20T12:00:00.000Z",
    source: serpApiJobSourceName,
    sourceUrl: "https://example.com/jobs/serpapi-job",
    applyUrl: "https://example.com/jobs/serpapi-job",
    attributionLabel: "Google Jobs via SerpAPI",
    termsProfile: "partner-terms",
    summary: "Manage Microsoft Intune and Windows endpoints.",
    tags: ["Endpoint", "Intune"],
    matchReasons: ["Endpoint engineering"],
    tools: ["Intune"],
    platforms: ["Windows"],
    roleFamily: "Endpoint Engineering",
    seniority: "Mid",
    employmentType: "Full-time",
    ...overrides
  };
}
