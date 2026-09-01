import assert from "node:assert/strict";
import test from "node:test";

import { himalayasProvider } from "../job-refresh/providers/himalayas";

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

test("Himalayas keeps Intune listings and drops marketing rows without endpoint haystack", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const requests: string[] = [];

  process.env.JOB_HIMALAYAS_QUERIES = "intune";
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json({
      updatedAt: 1788224346000,
      offset: 0,
      limit: 20,
      totalCount: 302,
      jobs: [
        {
          title: "VP Marketing",
          companyName: "Nerdio",
          description: "<p>Lead demand generation, product marketing, and sales enablement for a growing SaaS company.</p>",
          excerpt: "Own the marketing pipeline.",
          applicationLink: "https://himalayas.app/companies/nerdio/jobs/vp-marketing",
          guid: "https://himalayas.app/companies/nerdio/jobs/vp-marketing",
          pubDate: 1788224346,
          expiryDate: 1793408345,
          employmentType: "Full Time",
          locationRestrictions: [],
          categories: ["Demand-Generation"],
          parentCategories: ["Marketing", "Sales"]
        },
        {
          title: "Intune Endpoint Engineer",
          companyName: "Example Corp",
          description: "<p>Manage Microsoft Intune, Autopilot, and Windows endpoints for a global device fleet.</p>",
          excerpt: "Endpoint engineering for Windows devices.",
          applicationLink: "https://himalayas.app/companies/example-corp/jobs/intune-endpoint-engineer",
          guid: "https://himalayas.app/companies/example-corp/jobs/intune-endpoint-engineer",
          pubDate: 1788224346,
          expiryDate: 1793408345,
          employmentType: "Full Time",
          minSalary: 120000,
          maxSalary: 150000,
          currency: "USD",
          salaryPeriod: "annual",
          locationRestrictions: ["United States"],
          categories: ["Intune", "Endpoint"],
          parentCategories: ["Engineering"]
        }
      ]
    });
  };

  let jobs;
  try {
    jobs = await himalayasProvider.fetchJobs({
      url: himalayasProvider.defaultUrl,
      fetchedAt: new Date("2026-09-01T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0]);
  assert.equal(requestUrl.searchParams.get("q"), "intune");
  assert.equal(requestUrl.searchParams.get("sort"), "recent");
  assert.equal(requestUrl.searchParams.get("limit"), "20");
  assert.equal(requestUrl.searchParams.get("page"), "1");
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0], null);
  const job = jobs[1];
  assert.ok(job);
  assert.equal(job.title, "Intune Endpoint Engineer");
  assert.equal(job.source, "Himalayas");
  assert.equal(job.attributionLabel, "Himalayas");
  assert.equal(job.termsProfile, "attribution-required");
  assert.equal(job.workplace, "Remote");
  assert.equal(job.location, "United States");
  assert.ok(job.tools.includes("Intune"));
  assert.match(job.attributionLabel, /Himalayas/);
});

test("Himalayas skips 429 responses without crashing later queries", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const requests: string[] = [];

  process.env.JOB_HIMALAYAS_QUERIES = "intune,jamf";
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ ok: false, errors: "Too many requests" }), {
      status: 429,
      statusText: "Too Many Requests",
      headers: { "content-type": "application/json" }
    });
  };

  try {
    await assert.rejects(
      himalayasProvider.fetchJobs({
        url: himalayasProvider.defaultUrl,
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
