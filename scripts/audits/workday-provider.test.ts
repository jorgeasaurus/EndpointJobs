import assert from "node:assert/strict";
import test from "node:test";
import type { Job } from "../../src/types/job";

import { companyAtsProviders, WorkdayDetailError, WorkdayIncompleteSnapshotError } from "../job-refresh/providers/company-ats";
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

const detailPosting = {
  title: "Endpoint Engineer",
  externalPath: "/job/Chicago/Endpoint-Engineer_R123",
  postedOn: "Posted Today"
};
const validDetail = { startDate: "2026-09-11", title: "Endpoint Engineer", jobDescription: "Manage Microsoft Intune devices." };

for (const failure of ["network", "429", "500", "invalid-json", "missing-detail", "invalid-date"] as const) {
  test(`Workday rejects the entire snapshot on ${failure} detail failures across sites and queries`, async () => {
    assert.ok(workdayProvider);
    const originalFetch = globalThis.fetch;
    const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = "First|https://first.example/wday/cxs/first/Careers/jobs|Endpoint;Intune|true;;Second|https://second.example/wday/cxs/second/Careers/jobs|Endpoint;Intune|true";
    let detailRequests = 0;
    let searchRequests = 0;
    globalThis.fetch = async (input, init) => {
      if (init?.method === "POST") {
        searchRequests += 1;
        return Response.json({ jobPostings: [{ ...detailPosting, externalPath: `${detailPosting.externalPath}-${searchRequests}` }] });
      }
      detailRequests += 1;
      if (String(input).includes("first.example")) return Response.json({ jobPostingInfo: validDetail });
      if (failure === "network") throw new TypeError("network failed");
      if (failure === "429" || failure === "500") return new Response(null, { status: Number(failure) });
      if (failure === "invalid-json") return new Response("invalid json");
      return Response.json(failure === "missing-detail" ? {} : { jobPostingInfo: { startDate: "invalid" } });
    };
    try {
      await assert.rejects(workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") }), WorkdayDetailError);
      assert.equal(searchRequests, 3, "Stops on the failed detail despite already completed queries and sites");
      assert.equal(detailRequests, 3);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    }
  });
}

test("Workday treats 404 and 410 details as closed postings and continues", async () => {
  assert.ok(workdayProvider);
  const originalFetch = globalThis.fetch;
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  globalThis.fetch = async (input, init) => {
    if (init?.method === "POST") return Response.json({ jobPostings: [404, 410, 200].map((status) => ({ ...detailPosting, externalPath: `${detailPosting.externalPath}-${status}` })) });
    const status = Number(String(input).split("-").at(-1));
    return status === 200 ? Response.json({ jobPostingInfo: validDetail }) : new Response(null, { status });
  };
  try {
    const jobs = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
    assert.equal(jobs.filter(Boolean).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  }
});

test("Workday bounds detail requests and propagates timeouts", async (t) => {
  assert.ok(workdayProvider);
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint;Intune|true";
  const controller = new AbortController();
  const timeoutError = new DOMException("Detail timed out", "TimeoutError");
  controller.abort(timeoutError);
  const timeout = t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    assert.ok(milliseconds > 0 && milliseconds <= 30_000);
    return controller.signal;
  });
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({ jobPostings: [detailPosting] });
    assert.equal(init?.signal, controller.signal);
    init?.signal?.throwIfAborted();
    return Response.json({ jobPostingInfo: validDetail });
  });
  try {
    await assert.rejects(workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") }), (error) => error instanceof WorkdayDetailError && error.cause === timeoutError);
    assert.equal(timeout.mock.callCount(), 2);
  } finally {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  }
});

test("Workday detail overrides honor explicit false and inherit defaults only when omitted", async () => {
  assert.ok(workdayProvider);
  const site = defaultWorkdaySites.find((site) => "fetchDetails" in site && site.fetchDetails);
  assert.ok(site);
  const originalFetch = globalThis.fetch;
  const originalSites = process.env.JOB_WORKDAY_SITES;
  let detailRequests = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "POST") return Response.json({ jobPostings: [detailPosting] });
    detailRequests += 1;
    return Response.json({ jobPostingInfo: validDetail });
  };
  try {
    for (const [override, expected] of [["|false", 0], ["", 1], ["|true", 2]] as const) {
      process.env.JOB_WORKDAY_SITES = `${site.name}|${site.url}|Endpoint${override}`;
      const jobs: Array<Job | null> = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
      assert.equal(jobs.filter(Boolean).length, 1);
      assert.equal(detailRequests, expected);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  }
});

for (const fetchDetails of [true, false]) {
  test(`Workday ${fetchDetails ? "rejects" : "tolerates"} search failures for ${fetchDetails ? "detail-enabled" : "legacy search-only"} sites`, async (t) => {
    assert.ok(workdayProvider);
    const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = `First|https://first.example/wday/cxs/first/Careers/jobs|Endpoint|false;;Second|https://second.example/wday/cxs/second/Careers/jobs|Endpoint;Intune|${fetchDetails}`;
    t.after(() => {
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    });
    t.mock.method(globalThis, "fetch", async (input: unknown) => {
      if (String(input).includes("first.example")) return Response.json({ jobPostings: [detailPosting] });
      return new Response(null, { status: 503 });
    });
    const result = workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
    if (fetchDetails) await assert.rejects(result, WorkdayIncompleteSnapshotError);
    else assert.equal((await result).filter(Boolean).length, 1);
  });
}

test("Workday detail-enabled identities survive title edits at the same native path", async (t) => {
  assert.ok(workdayProvider);
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  let title = "Endpoint Engineer";
  let externalPath = detailPosting.externalPath;
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({ jobPostings: [{ ...detailPosting, title, externalPath }] });
    return Response.json({ jobPostingInfo: { ...validDetail, title } });
  });
  const context = { url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") };
  const [original] = await workdayProvider.fetchJobs(context);
  title = "Senior Endpoint Engineer";
  const [renamed] = await workdayProvider.fetchJobs(context);
  assert.ok(original && renamed);
  assert.notEqual(original.title, renamed.title);
  assert.equal(original.id, renamed.id);
  externalPath += "-different";
  const [other] = await workdayProvider.fetchJobs(context);
  assert.ok(other);
  assert.notEqual(original.id, other.id);
});

for (const suffix of ["/jobs", "/jobs/", "/jobs///"]) {
  test(`Workday detail URLs normalize the configured ${suffix} suffix`, async (t) => {
    assert.ok(workdayProvider);
    const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = `Example|https://example.com/wday/cxs/example/Careers${suffix}|Endpoint|true`;
    t.after(() => {
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    });
    let detailUrl: string | undefined;
    t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return Response.json({ jobPostings: [detailPosting] });
      detailUrl = String(input);
      return Response.json({ jobPostingInfo: validDetail });
    });
    await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
    assert.equal(detailUrl, "https://example.com/wday/cxs/example/Careers/job/Chicago/Endpoint-Engineer_R123");
  });
}

for (const malformed of [{ additionalLocations: 42, location: "Chicago" }, { jobDescription: { text: "Intune" } }]) {
  test(`Workday malformed detail ${Object.keys(malformed)[0]} rejects as an incomplete snapshot`, async (t) => {
    assert.ok(workdayProvider);
    const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
    t.after(() => {
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    });
    t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return Response.json({ jobPostings: [detailPosting] });
      return Response.json({ jobPostingInfo: { ...validDetail, ...malformed } });
    });
    await assert.rejects(workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") }), (error) => error instanceof WorkdayDetailError && error.cause instanceof TypeError);
  });
}

for (const suffix of ["/", "///"]) {
  test(`Workday inherits detail-enabled defaults for URL suffix ${suffix}`, async (t) => {
    assert.ok(workdayProvider);
    const site = defaultWorkdaySites.find((site) => "fetchDetails" in site && site.fetchDetails);
    assert.ok(site);
    const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = `${site.name}|${site.url}${suffix}|Endpoint`;
    t.after(() => {
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    });
    let detailRequests = 0;
    t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return Response.json({ jobPostings: [detailPosting] });
      detailRequests += 1;
      return Response.json({ jobPostingInfo: validDetail });
    });
    await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
    assert.equal(detailRequests, 1);
  });
}
