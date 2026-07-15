import assert from "node:assert/strict";
import test from "node:test";

import { smartRecruitersProvider } from "../job-refresh/providers/smartrecruiters";

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

test("SmartRecruiters skips malformed list entries without dropping the page", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  process.env.JOB_SMARTRECRUITERS_COMPANIES = "ExampleCompany";
  process.env.JOB_SMARTRECRUITERS_QUERIES = "endpoint";
  process.env.JOB_SMARTRECRUITERS_MAX_PAGES = "1";
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.endsWith("/postings/endpoint-123")) {
      return Response.json({
        id: "endpoint-123",
        name: "Endpoint Engineer",
        releasedDate: "2026-07-10T00:00:00.000Z",
        location: { fullLocation: "Berlin, Germany" }
      });
    }

    return Response.json({
      content: [
        { placeholder: true },
        {
          id: "endpoint-123",
          name: "Endpoint Engineer",
          releasedDate: "2026-07-10T00:00:00.000Z",
          location: { fullLocation: "Berlin, Germany" }
        }
      ],
      limit: 100,
      offset: 0,
      totalFound: 2
    });
  };

  let jobs;
  try {
    jobs = await smartRecruitersProvider.fetchJobs({
      url: smartRecruitersProvider.defaultUrl,
      fetchedAt: new Date("2026-07-14T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.title, "Endpoint Engineer");
});
