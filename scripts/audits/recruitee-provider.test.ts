import assert from "node:assert/strict";
import test from "node:test";

import { recruiteeProvider } from "../job-refresh/providers/recruitee";

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

test("Recruitee keeps jobs with well-formed three-letter currency codes", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  process.env.JOB_RECRUITEE_ACCOUNTS = "example";
  globalThis.fetch = async () => Response.json({
    offers: [{
      id: 123,
      title: "Endpoint Engineer",
      company_name: "Example Company",
      status: "published",
      published_at: "2026-07-10T00:00:00.000Z",
      location: "Berlin, Germany",
      description: "Manage Microsoft Intune endpoints and Windows devices.",
      careers_url: "https://example.recruitee.com/o/endpoint-engineer",
      careers_apply_url: "https://example.recruitee.com/o/endpoint-engineer/apply",
      salary: {
        min: 1000,
        max: 2000,
        currency: "ZZZ",
        period: "year"
      }
    }]
  });

  let jobs;
  try {
    jobs = await recruiteeProvider.fetchJobs({
      url: recruiteeProvider.defaultUrl,
      fetchedAt: new Date("2026-07-14T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(jobs.length, 1);
  assert.deepEqual(jobs[0]?.salary && {
    min: jobs[0].salary.min,
    max: jobs[0].salary.max,
    currency: jobs[0].salary.currency
  }, {
    min: 1000,
    max: 2000,
    currency: "ZZZ"
  });
  assert.match(jobs[0]?.salary?.label ?? "", /ZZZ/);
});
