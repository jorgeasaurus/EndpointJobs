import assert from "node:assert/strict";
import test from "node:test";

import { serpApiProvider } from "../job-refresh/providers/serpapi";

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

test("SerpAPI preserves successful query results when a later query fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  let requestCount = 0;

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_QUERIES = "endpoint engineer,intune engineer";
  process.env.JOB_SERPAPI_MAX_PAGES = "1";
  globalThis.fetch = async () => {
    requestCount += 1;

    if (requestCount === 1) {
      return Response.json({
        jobs_results: [
          {
            job_id: "endpoint-123",
            title: "Endpoint Engineer",
            company_name: "Example Company",
            location: "Remote",
            description: "Manage Microsoft Intune, Windows endpoints, and device automation.",
            apply_options: [{
              title: "Example Company",
              link: "https://example.com/jobs/endpoint-123"
            }]
          },
          {
            job_id: "unrelated-456",
            title: "Account Executive",
            company_name: "Example Company",
            location: "Remote",
            description: "Sell enterprise software subscriptions.",
            apply_options: [{
              title: "Example Company",
              link: "https://example.com/jobs/unrelated-456"
            }]
          }
        ]
      });
    }

    return new Response('{"error":"Your account has run out of searches."}', {
      status: 429,
      statusText: "Too Many Requests"
    });
  };

  let jobs;
  try {
    jobs = await serpApiProvider.fetchJobs({
      url: serpApiProvider.defaultUrl,
      fetchedAt: new Date("2026-07-15T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(requestCount, 2);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.title, "Endpoint Engineer");
});

test("SerpAPI still fails when no query returns successfully", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_QUERIES = "endpoint engineer";
  process.env.JOB_SERPAPI_MAX_PAGES = "1";
  globalThis.fetch = async () => new Response('{"error":"Your account has run out of searches."}', {
    status: 429,
    statusText: "Too Many Requests"
  });

  try {
    await assert.rejects(
      serpApiProvider.fetchJobs({
        url: serpApiProvider.defaultUrl,
        fetchedAt: new Date("2026-07-15T12:00:00.000Z")
      }),
      /429 Too Many Requests.*run out of searches/
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }
});
