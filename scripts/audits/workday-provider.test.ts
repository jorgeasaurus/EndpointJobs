import assert from "node:assert/strict";
import test from "node:test";

import { companyAtsProviders } from "../job-refresh/providers/company-ats";
import { defaultWorkdaySites } from "../job-refresh/providers/workday-sites";

const workdayProvider = companyAtsProviders.find((provider) => provider.id === "workday");

test("Workday defaults include GEICO's focused endpoint searches", () => {
  assert.deepEqual(
    defaultWorkdaySites.find((site) => site.name === "GEICO"),
    {
      name: "GEICO",
      url: "https://geico.wd1.myworkdayjobs.com/wday/cxs/geico/External/jobs",
      queries: ["Endpoint", "Intune"]
    }
  );
});

test("Workday normalizes GEICO roles and sends its required language header", async () => {
  assert.ok(workdayProvider);

  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  process.env.JOB_WORKDAY_SITES =
    "GEICO|https://geico.wd1.myworkdayjobs.com/wday/cxs/geico/External/jobs|Intune";
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);

    if (headers.get("accept-language") !== "en-US,en;q=0.9") {
      return new Response(null, { status: 500 });
    }

    return Response.json({
      jobPostings: [
        {
          title: "Endpoint Automation Staff Engineer",
          externalPath: "/job/Palo-Alto-CA/Endpoint-Automation-Staff-Engineer_R0064292",
          postedOn: "Posted 30+ Days Ago",
          bulletFields: ["R0064292"]
        }
      ]
    });
  };

  try {
    const jobs = await workdayProvider.fetchJobs({
      url: workdayProvider.defaultUrl,
      fetchedAt: new Date("2026-07-15T12:00:00.000Z")
    });

    assert.equal(jobs.filter(Boolean).length, 1);
    assert.equal(jobs[0]?.company, "GEICO");
    assert.equal(jobs[0]?.title, "Endpoint Automation Staff Engineer");
    assert.equal(
      jobs[0]?.sourceUrl,
      "https://geico.wd1.myworkdayjobs.com/External/job/Palo-Alto-CA/Endpoint-Automation-Staff-Engineer_R0064292"
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  }
});
