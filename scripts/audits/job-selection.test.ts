import assert from "node:assert/strict";
import test from "node:test";

import { selectFeedJobs } from "../job-refresh/job-selection";
import type { Job } from "../../src/types/job";

test("canonical source URL collapses title punctuation variants", () => {
  const jobs = selectFeedJobs([
    makeJob({
      id: "punctuated",
      title: "Senior Endpoint Engineer (Intune)",
      sourceUrl: "https://jobs.example.com/endpoint-123/#overview"
    }),
    makeJob({
      id: "plain",
      title: "Senior Endpoint Engineer - Intune",
      sourceUrl: "https://jobs.example.com/endpoint-123"
    })
  ]);

  assert.equal(jobs.length, 1);
});

test("known publication dates rank ahead of fetched-time fallback dates", () => {
  const jobs = selectFeedJobs([
    makeJob({
      id: "fallback-date",
      title: "Endpoint Architect",
      postedAt: "2026-07-14T00:00:00.000Z",
      fetchedAt: "2026-07-14T00:00:00.000Z",
      sourceUrl: "https://jobs.example.com/architect"
    }),
    makeJob({
      id: "known-date",
      postedAt: "2026-07-10T00:00:00.000Z",
      fetchedAt: "2026-07-14T00:00:00.000Z"
    })
  ]);

  assert.deepEqual(jobs.map((job) => job.id), ["known-date", "fallback-date"]);
});

test("direct ATS job beats an equivalent aggregator listing", () => {
  const jobs = selectFeedJobs([
    makeJob({
      id: "aggregator",
      postedAt: "2026-07-13T00:00:00.000Z",
      source: "SerpAPI Google Jobs",
      sourceUrl: "https://aggregator.example/jobs/endpoint-123",
      attributionLabel: "Google Jobs via SerpAPI",
      termsProfile: "partner-terms"
    }),
    makeJob({
      id: "direct-ats",
      source: "USAJOBS",
      sourceUrl: "https://www.usajobs.gov/job/123456789",
      attributionLabel: "USAJOBS"
    })
  ]);

  assert.deepEqual(jobs.map((job) => job.id), ["direct-ats"]);
});

test("same role remains available in multiple legitimate locations", () => {
  const jobs = selectFeedJobs([
    makeJob({ id: "berlin" }),
    makeJob({
      id: "munich",
      location: "Munich, Germany",
      sourceUrl: "https://jobs.example.com/endpoint-123-munich"
    })
  ]);

  assert.deepEqual(new Set(jobs.map((job) => job.id)), new Set(["berlin", "munich"]));
});

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job",
    title: "Endpoint Engineer",
    company: "Example Company",
    location: "Berlin, Germany",
    workplace: "Hybrid",
    postedAt: "2026-07-10T00:00:00.000Z",
    fetchedAt: "2026-07-14T00:00:00.000Z",
    staleAfter: "2026-08-24T00:00:00.000Z",
    source: "Greenhouse",
    sourceUrl: "https://jobs.example.com/endpoint-123",
    applyUrl: "https://jobs.example.com/endpoint-123/apply",
    attributionLabel: "Greenhouse / Example Company",
    termsProfile: "public-api",
    summary: "Own endpoint management with Intune.",
    tags: ["Endpoint", "Intune"],
    matchReasons: ["Endpoint engineering"],
    tools: ["Intune"],
    platforms: ["Windows"],
    roleFamily: "Endpoint Engineering",
    seniority: "Senior",
    employmentType: "Full-time",
    ...overrides
  };
}
