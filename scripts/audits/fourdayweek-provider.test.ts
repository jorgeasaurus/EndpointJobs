import assert from "node:assert/strict";
import test from "node:test";

import { fourdayweekProvider } from "../job-refresh/providers/fourdayweek";

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

test("4 Day Week keeps jobs whose tools include Intune", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const requests: string[] = [];

  process.env.JOB_FOURDAYWEEK_QUERIES = "intune";
  process.env.JOB_FOURDAYWEEK_MAX_PAGES = "1";
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json({
      page: 1,
      limit: 25,
      total: 53,
      has_more: true,
      data: [{
        id: "fourdayweek-intune-1",
        title: "Systems Engineer",
        description: "Join our IT team supporting corporate systems.",
        url: "https://4dayweek.io/job/systems-engineer-example",
        category: "engineering",
        role: "Systems Engineer",
        work_arrangement: "remote",
        locations: [{
          country: "United States",
          continent: "North America",
          work_arrangement: "remote",
          is_primary: true
        }],
        salary_min: 12000000,
        salary_max: 15000000,
        salary_currency: "USD",
        salary_period: "year",
        tools: [{ name: "Intune" }],
        skills: [],
        stack: [],
        posted_at: "2026-08-20T00:00:00Z",
        company: { name: "Example Co" }
      }]
    });
  };

  let jobs;
  try {
    jobs = await fourdayweekProvider.fetchJobs({
      url: fourdayweekProvider.defaultUrl,
      fetchedAt: new Date("2026-09-01T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0]);
  assert.equal(requestUrl.searchParams.get("q"), "intune");
  assert.equal(requestUrl.searchParams.get("page"), "1");
  assert.equal(jobs.length, 1);
  const job = jobs[0];
  assert.ok(job);
  assert.equal(job.title, "Systems Engineer");
  assert.equal(job.source, "4 Day Week");
  assert.equal(job.attributionLabel, "4dayweek.io");
  assert.equal(job.termsProfile, "attribution-required");
  assert.equal(job.workplace, "Remote");
  assert.ok(job.tools.includes("Intune"));
  assert.deepEqual(job.salary, {
    min: 120000,
    max: 150000,
    currency: "USD",
    label: "$120k-$150k"
  });
});

test("4 Day Week skips 429 responses without paging further", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const requests: string[] = [];

  process.env.JOB_FOURDAYWEEK_QUERIES = "intune,jamf";
  process.env.JOB_FOURDAYWEEK_MAX_PAGES = "2";
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return new Response("Too Many Requests", {
      status: 429,
      statusText: "Too Many Requests"
    });
  };

  try {
    await assert.rejects(
      fourdayweekProvider.fetchJobs({
        url: fourdayweekProvider.defaultUrl,
        fetchedAt: new Date("2026-09-01T12:00:00.000Z")
      }),
      /429 Too Many Requests/
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(requests.length, 1);
});
