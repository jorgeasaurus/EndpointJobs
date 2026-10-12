import assert from "node:assert/strict";
import { test } from "node:test";
import { curatedJobProvider } from "../job-refresh/providers/curated-jobs";
import { addDays, getJobStaleDays } from "../job-refresh/shared";

test("curated employer roles preserve publication dates and cap freshness at the application deadline", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    const body = url.includes("ropesgray")
      ? "Senior Desktop Engineer Ropes & Gray Intune"
      : url.includes("governmentjobs.com/jobs/5506606")
        ? "Information Technology Programmer Analyst 12 State of Michigan Endpoint"
        : "";
    return new Response(body, { status: body ? 200 : 404 });
  };
  try {
    const fetchedAt = new Date("2026-10-11T12:00:00.000Z");
    const jobs = await curatedJobProvider.fetchJobs({ url: curatedJobProvider.defaultUrl, fetchedAt });
    const ropes = jobs.find((job) => job?.company === "Ropes & Gray");
    const michigan = jobs.find((job) => job?.company === "State of Michigan");
    assert.ok(ropes);
    assert.ok(michigan);
    assert.equal(ropes.postedAt, "2026-08-07T04:00:00.000Z");
    assert.equal(ropes.staleAfter, addDays(fetchedAt, getJobStaleDays()).toISOString());
    assert.equal(ropes.expiresAt, "2027-08-07T04:00:00.000Z");
    assert.equal(michigan.postedAt, "2026-10-06T00:00:00.000Z");
    assert.equal(michigan.staleAfter, "2026-10-21T03:59:00.000Z");
    assert.equal(michigan.expiresAt, michigan.staleAfter);
    assert.equal(michigan.salary, undefined);
    assert.match(michigan.description ?? "", /\$34\.45-\$49\.53 per hour/);

    globalThis.fetch = async (input) => new Response("", {
      status: String(input).includes("ropesgray") ? 503 : 404
    });
    const unknownJobs = await curatedJobProvider.fetchJobs({ url: curatedJobProvider.defaultUrl, fetchedAt });
    const unknownRopes = unknownJobs.find((job) => job?.company === "Ropes & Gray");
    assert.equal(unknownRopes, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
