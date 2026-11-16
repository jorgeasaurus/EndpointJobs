import assert from "node:assert/strict";
import test from "node:test";

import { publicJobBoardProviders } from "../job-refresh/providers/public-job-boards";
import { serpApiProvider } from "../job-refresh/providers/serpapi";

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

const adzunaProvider = publicJobBoardProviders.find((provider) => provider.id === "adzuna");

test("Adzuna applies per-country queries and a London where filter", async () => {
  assert.ok(adzunaProvider);
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const requestUrls: URL[] = [];

  process.env.ADZUNA_APP_ID = "test-id";
  process.env.ADZUNA_APP_KEY = "test-key";
  process.env.JOB_ADZUNA_COUNTRIES = "us,gb";
  process.env.JOB_ADZUNA_QUERIES = "endpoint engineer";
  process.env.JOB_ADZUNA_GB_QUERIES = "intune engineer,jamf engineer";
  process.env.JOB_ADZUNA_GB_WHERE = "London";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestUrls.push(url);

    return Response.json({ results: [] });
  };

  try {
    await adzunaProvider.fetchJobs({
      url: adzunaProvider.defaultUrl,
      fetchedAt: new Date("2026-11-15T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.deepEqual(
    requestUrls.map((url) => ({
      country: url.pathname.split("/")[4],
      what: url.searchParams.get("what"),
      where: url.searchParams.get("where")
    })),
    [
      { country: "us", what: "endpoint engineer", where: null },
      { country: "gb", what: "intune engineer", where: "London" },
      { country: "gb", what: "jamf engineer", where: "London" }
    ]
  );
});

test("SerpAPI gb market searches London on google.co.uk and keeps GBP salaries", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const requestUrls: URL[] = [];

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_COUNTRIES = "gb";
  process.env.JOB_SERPAPI_GB_QUERIES = "endpoint engineer";
  process.env.JOB_SERPAPI_GB_LOCATIONS = "London, England, United Kingdom";
  process.env.JOB_SERPAPI_MAX_PAGES = "1";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestUrls.push(url);

    return Response.json({
      jobs_results: [{
        job_id: "endpoint-london",
        title: "Endpoint Engineer",
        company_name: "Example Company",
        location: "London, UK",
        description: "Manage Microsoft Intune and Windows endpoints.",
        detected_extensions: { salary: "£60K–£75K a year" },
        apply_options: [{ title: "Example Company", link: "https://example.com/jobs/endpoint-london" }]
      }]
    });
  };

  let jobs;
  try {
    jobs = await serpApiProvider.fetchJobs({
      url: serpApiProvider.defaultUrl,
      fetchedAt: new Date("2026-11-15T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.deepEqual(requestUrls.map((url) => ({
    domain: url.searchParams.get("google_domain"),
    gl: url.searchParams.get("gl"),
    location: url.searchParams.get("location")
  })), [{ domain: "google.co.uk", gl: "uk", location: "London, England, United Kingdom" }]);
  assert.equal(jobs.length, 1);
  assert.deepEqual(
    { currency: jobs[0]?.salary?.currency, min: jobs[0]?.salary?.min, max: jobs[0]?.salary?.max },
    { currency: "GBP", min: 60_000, max: 75_000 }
  );
});
