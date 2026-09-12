import assert from "node:assert/strict";
import test from "node:test";

import { companyAtsProviders } from "../job-refresh/providers/company-ats";
import { defaultWorkdaySites } from "../job-refresh/providers/workday-sites";

const workdayProvider = companyAtsProviders.find((provider) => provider.id === "workday");

test("Workday details preserve original dates, qualify generic titles, and exclude closed postings", async () => {
  assert.ok(workdayProvider);
  const originalFetch = globalThis.fetch;
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.wd1.myworkdayjobs.com/wday/cxs/example/Careers/jobs|Endpoint;Intune|true";
  const details = [
    { startDate: "2026-04-13", endDate: "2026-09-21", canApply: true },
    { startDate: "2026-09-11", endDate: "2026-09-11", canApply: true },
    { startDate: "2026-09-11", canApply: false },
    { startDate: "2026-09-11", posted: false },
    { startDate: "2026-09-11", endDate: "2026-09-12", canApply: true },
    { startDate: "2026-09-13", canApply: true },
    { startDate: "2026-09-11", remoteType: undefined, jobDescription: "Manage enterprise endpoints using Intune and Jamf. Remote work available once a week after 90-day onboarding period." },
    { startDate: "2026-09-11", remoteType: "Hybrid", jobDescription: "Manage enterprise endpoints using Intune and Jamf. Support remote users across offices." },
    { startDate: "2026-09-11", jobDescription: "Develop clinical trial endpoints for pharmaceutical research." }
  ];
  let detailRequests = 0;
  globalThis.fetch = async (input, init) => {
    if (init?.method === "POST") {
      return Response.json({ jobPostings: details.map((_, index) => ({ title: "Enterprise Systems Administrator", externalPath: `/job/Chicago/Administrator_${index}`, postedOn: "Posted 30+ Days Ago" })) });
    }
    detailRequests += 1;
    const index = Number(String(input).split("_").at(-1));
    return Response.json({ jobPostingInfo: {
      title: "Enterprise Systems Administrator", jobDescription: "<p>Manage enterprise endpoints with Microsoft Intune, Jamf and Windows Autopilot. Own device lifecycle provisioning, policy configuration, patch deployment, application packaging, compliance monitoring, automation, and technical escalations for the company workstation fleet. Work with security and infrastructure teams to improve employee computing experiences, manage software updates, document operational standards, and develop reliable deployment workflows for Windows and macOS devices across all corporate offices.</p>",
      location: "Chicago, IL", remoteType: "Hybrid", timeType: "Full time", ...details[index]
    } });
  };
  try {
    const jobs = (await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") })).filter((job) => job !== null);
    assert.equal(detailRequests, details.length, "Details are fetched once across overlapping queries");
    assert.equal(jobs.length, 4);
    assert.equal(jobs[0].postedAt, "2026-04-13T00:00:00.000Z");
    assert.equal(jobs[0].expiresAt, "2026-09-21T23:59:59.999Z");
    assert.equal(jobs[1].expiresAt, "2026-09-12T23:59:59.999Z");
    assert.equal(jobs[0].staleAfter, jobs[0].expiresAt);
    assert.equal(jobs[1].staleAfter, jobs[1].expiresAt);
    assert.equal(jobs[0].employmentType, "Full-time");
    assert.equal(jobs[2].workplace, "Hybrid");
    assert.equal(jobs[3].workplace, "Hybrid");
    assert.match(jobs[0].description ?? "", /Microsoft Intune/);
    assert.ok(jobs[0].tools.includes("Intune"));
    assert.equal(jobs[0].location, "Chicago, IL");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  }
});

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

test("Workday search queries keep endpoint-relevant listings without publishing the query", async () => {
  assert.ok(workdayProvider);
  const fetchedAt = new Date("2026-07-15T12:00:00.000Z");
  const posting = {
    title: "Systems Engineer",
    externalPath: "/job/Example/Systems-Engineer_R123",
    postedOn: "Posted Today",
    bulletFields: ["R123"]
  };

  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  globalThis.fetch = async () => Response.json({ jobPostings: [posting] });

  try {
    process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/External/jobs|Intune";
    const [admitted] = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt });
    assert.ok(admitted);
    assert.equal(admitted.title, "Systems Engineer");
    assert.deepEqual(admitted.tools, []);
    process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/External/jobs|Jamf Android senior contract remote security";
    const [otherQuery] = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt });
    assert.deepEqual(otherQuery, admitted, "Search evidence must not change any published field");
    assert.doesNotMatch(`${admitted.summary}\n${admitted.description ?? ""}`, /Intune/i);

    process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/External/jobs|Payroll";
    const rejected = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt });
    assert.deepEqual(rejected, [null]);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("Workday publishes genuine bullet evidence without the search term", async () => {
  assert.ok(workdayProvider);
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/External/jobs|Intune";
  globalThis.fetch = async () => Response.json({
    jobPostings: [{
      title: "Windows Endpoint Engineer",
      externalPath: "/job/Example/Windows-Endpoint-Engineer_R123",
      postedOn: "Posted Today",
      bulletFields: ["R123", "PowerShell automation", "Manage Windows devices and endpoint deployments across the enterprise. ".repeat(8)]
    }]
  });
  try {
    const [job] = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-07-15T12:00:00.000Z") });
    assert.ok(job);
    assert.deepEqual(job.tools, ["PowerShell"]);
    assert.deepEqual(job.platforms, ["Windows"]);
    assert.ok(!job.tags.includes("Intune"));
    assert.ok(job.tags.includes("PowerShell automation"));
    assert.match(job.summary, /PowerShell automation/);
    assert.match(job.description ?? "", /PowerShell automation/);
    assert.doesNotMatch(`${job.summary}\n${job.description ?? ""}`, /Intune/i);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});
