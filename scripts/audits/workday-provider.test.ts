import assert from "node:assert/strict";
import test from "node:test";
import type { Job } from "../../src/types/job";

import { workdayProvider, WorkdayDetailError, WorkdayIncompleteSnapshotError } from "../job-refresh/providers/workday";
import { defaultWorkdaySites } from "../job-refresh/providers/workday-sites";

test("Workday details preserve original dates, qualify generic titles, and exclude closed or stale postings", async () => {
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
      return workdaySearchResponse(details.map((_, index) => ({ title: "Enterprise Systems Administrator", externalPath: `/job/Chicago/Administrator_${index}`, postedOn: "Posted 30+ Days Ago" })));
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
    assert.equal(jobs.length, 3);
    assert.equal(jobs[0].postedAt, "2026-09-11T00:00:00.000Z");
    assert.equal(jobs[0].expiresAt, "2026-09-12T23:59:59.999Z");
    assert.equal(jobs[0].staleAfter, jobs[0].expiresAt);
    assert.equal(jobs[0].employmentType, "Full-time");
    assert.equal(jobs[1].workplace, "Hybrid");
    assert.equal(jobs[2].workplace, "Hybrid");
    assert.match(jobs[0].description ?? "", /Microsoft Intune/);
    assert.ok(jobs[0].tools.includes("Intune"));
    assert.equal(jobs[0].location, "Chicago, IL");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  }
});

test("Workday detail text falls back when cleaned fields are empty", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/External/jobs|Endpoint|true";
  globalThis.fetch = async (_input, init) => init?.method === "POST"
    ? workdaySearchResponse([{ title: "Endpoint Administrator", externalPath: "/job/Example/Search-title", postedOn: "Posted Today", bulletFields: ["Manage enterprise endpoints with Intune and Jamf. ".repeat(12)] }])
    : Response.json({ jobPostingInfo: { title: "   ", jobDescription: "   ", startDate: "2026-09-11", canApply: true } });
  try {
    const [job] = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
    assert.equal(job?.title, "Endpoint Administrator");
    assert.match(job?.description ?? "", /Manage enterprise endpoints/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("Workday detail locations ignore blanks and fall back to search metadata", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/External/jobs|Endpoint|true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  const postings = [
    { ...detailPosting, externalPath: `${detailPosting.externalPath}-additional`, locationsText: "Chicago, IL" },
    { ...detailPosting, externalPath: `${detailPosting.externalPath}-fallback`, locationsText: "Chicago, IL" },
  ];
  t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
    if (init?.method === "POST") return workdaySearchResponse(postings);
    const additionalLocations = String(input).endsWith("-additional")
      ? [" New York, NY "]
      : ["   "];
    return Response.json({
      jobPostingInfo: {
        ...validDetail,
        location: "   ",
        additionalLocations,
      },
    });
  });

  const jobs = await workdayProvider.fetchJobs({
    url: workdayProvider.defaultUrl,
    fetchedAt: new Date("2026-09-12T12:00:00Z"),
  });

  assert.deepEqual(jobs.map((job) => job?.location), ["New York, NY", "Chicago, IL"]);
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

function workdaySearchResponse(jobPostings: unknown[]) {
  return Response.json({ jobPostings, total: jobPostings.length });
}

for (const failure of ["network", "429", "500", "invalid-json", "missing-detail", "invalid-date", "impossible-date"] as const) {
  test(`Workday rejects the entire snapshot on ${failure} detail failures across sites and queries`, async () => {
      const originalFetch = globalThis.fetch;
    const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = "First|https://first.example/wday/cxs/first/Careers/jobs|Endpoint;Intune|true;;Second|https://second.example/wday/cxs/second/Careers/jobs|Endpoint;Intune|true";
    let detailRequests = 0;
    let searchRequests = 0;
    globalThis.fetch = async (input, init) => {
      if (init?.method === "POST") {
        searchRequests += 1;
        return workdaySearchResponse([{ ...detailPosting, externalPath: `${detailPosting.externalPath}-${searchRequests}` }]);
      }
      detailRequests += 1;
      if (String(input).includes("first.example")) return Response.json({ jobPostingInfo: validDetail });
      if (failure === "network") throw new TypeError("network failed");
      if (failure === "429" || failure === "500") return new Response(null, { status: Number(failure) });
      if (failure === "invalid-json") return new Response("invalid json");
      return Response.json(failure === "missing-detail" ? {} : { jobPostingInfo: { startDate: failure === "impossible-date" ? "2026-02-30" : "invalid" } });
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
  const originalFetch = globalThis.fetch;
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  globalThis.fetch = async (input, init) => {
    if (init?.method === "POST") return workdaySearchResponse([404, 410, 200].map((status) => ({ ...detailPosting, externalPath: `${detailPosting.externalPath}-${status}` })));
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
    if (init?.method === "POST") return workdaySearchResponse([detailPosting]);
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
  const site = defaultWorkdaySites.find((site) => "fetchDetails" in site && site.fetchDetails);
  assert.ok(site);
  const originalFetch = globalThis.fetch;
  const originalSites = process.env.JOB_WORKDAY_SITES;
  let detailRequests = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "POST") return workdaySearchResponse([detailPosting]);
    detailRequests += 1;
    return Response.json({ jobPostingInfo: validDetail });
  };
  try {
    for (const [override, expected] of [["|false", 0], ["", 1], ["|true", 2], ["|TRUE", 3]] as const) {
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

test("Workday detail overrides reject invalid boolean flags", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|treu";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  await assert.rejects(
    workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") }),
    (error) => error instanceof WorkdayIncompleteSnapshotError
      && error.cause instanceof Error
      && /Invalid JOB_WORKDAY_SITES fetchDetails flag/.test(error.cause.message)
  );
});

test("Workday rejects configured sites without normalized queries", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs| ; |true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });

  await assert.rejects(
    workdayProvider.fetchJobs({
      url: workdayProvider.defaultUrl,
      fetchedAt: new Date("2026-09-12T12:00:00Z"),
    }),
    (error) => error instanceof WorkdayIncompleteSnapshotError
      && error.cause instanceof Error
      && /Invalid JOB_WORKDAY_SITES entry/.test(error.cause.message),
  );
});

test("Workday page limits use strict positive integer configuration", async (t) => {
  const originalEnv = { ...process.env };
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  t.after(() => {
    process.env = originalEnv;
  });
  const seenLimits: number[] = [];
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    if (init?.method !== "POST") throw new Error("Detail fetch should not run");
    seenLimits.push((JSON.parse(String(init.body)) as { limit: number }).limit);
    return Response.json({ jobPostings: [], total: 0 });
  });

  for (const configured of ["0.5", "1e2", "100", " 2 "]) {
    process.env.JOB_WORKDAY_RESULTS_PER_QUERY = configured;
    await workdayProvider.fetchJobs({
      url: workdayProvider.defaultUrl,
      fetchedAt: new Date("2026-09-12T12:00:00Z"),
    });
  }

  assert.deepEqual(seenLimits, [10, 10, 100, 2]);
});

for (const fetchDetails of [true, false]) {
  test(`Workday ${fetchDetails ? "rejects" : "tolerates"} search failures for ${fetchDetails ? "detail-enabled" : "legacy search-only"} sites`, async (t) => {
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
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  let title = "Endpoint Engineer";
  let externalPath = detailPosting.externalPath;
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    if (init?.method === "POST") return workdaySearchResponse([{ ...detailPosting, title, externalPath }]);
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
      const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = `Example|https://example.com/wday/cxs/example/Careers${suffix}|Endpoint|true`;
    t.after(() => {
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    });
    let detailUrl: string | undefined;
    t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return workdaySearchResponse([detailPosting]);
      detailUrl = String(input);
      return Response.json({ jobPostingInfo: validDetail });
    });
    await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
    assert.equal(detailUrl, "https://example.com/wday/cxs/example/Careers/job/Chicago/Endpoint-Engineer_R123");
  });
}

for (const malformed of [{ additionalLocations: 42, location: "Chicago" }, { additionalLocations: "New York", location: "Chicago" }, { additionalLocations: ["New York", 42], location: "Chicago" }, { jobDescription: { text: "Intune" } }]) {
  test(`Workday malformed detail ${Object.keys(malformed)[0]} rejects as an incomplete snapshot`, async (t) => {
      const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
    t.after(() => {
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    });
    t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return workdaySearchResponse([detailPosting]);
      return Response.json({ jobPostingInfo: { ...validDetail, ...malformed } });
    });
    await assert.rejects(workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") }), (error) => error instanceof WorkdayDetailError && error.cause instanceof TypeError);
  });
}

for (const suffix of ["/", "///"]) {
  test(`Workday inherits detail-enabled defaults for URL suffix ${suffix}`, async (t) => {
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
      if (init?.method === "POST") return workdaySearchResponse([detailPosting]);
      detailRequests += 1;
      return Response.json({ jobPostingInfo: validDetail });
    });
    await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
    assert.equal(detailRequests, 1);
  });
}

for (const postings of [
  [{ unexpected: true }],
  [detailPosting, { title: 42, externalPath: "/job/bad" }],
  [{ ...detailPosting, externalPath: "job/without-leading-slash" }],
  [{ ...detailPosting, externalPath: " /job/leading-space" }],
  [{ ...detailPosting, externalPath: "/job/" }],
  [{ ...detailPosting, externalPath: "/job//title" }],
  [{ ...detailPosting, externalPath: "/job/location/" }],
  [{ ...detailPosting, externalPath: "/job/../traversal" }],
  [{ ...detailPosting, externalPath: "/job/%2e%2e/encoded-traversal" }],
  [{ ...detailPosting, externalPath: "/job/..%2fencoded-separator" }],
  [{ ...detailPosting, externalPath: "/job/%zz-malformed-escape" }],
  [{ ...detailPosting, locationsText: {} }],
  [{ ...detailPosting, postedOn: 42 }],
  [{ ...detailPosting, bulletFields: ["Endpoint", 42] }]
]) {
  test("Workday rejects malformed search entries for detail-enabled sites", async (t) => {
      const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
    t.after(() => {
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    });
    let detailRequests = 0;
    t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return workdaySearchResponse(postings);
      detailRequests += 1;
      return Response.json({ jobPostingInfo: validDetail });
    });
    await assert.rejects(
      workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") }),
      (error) => error instanceof WorkdayIncompleteSnapshotError
        && error.cause instanceof Error
        && error.cause.message === "Workday search included an invalid job posting"
    );
    assert.equal(detailRequests, 0);
  });
}

for (const endDate of ["invalid", "2026-02-30", 42, "", "   ", null]) {
  test(`Workday validates a present closing date: ${JSON.stringify(endDate)}`, async (t) => {
      const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
    t.after(() => {
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    });
    t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => init?.method === "POST"
      ? workdaySearchResponse([detailPosting])
      : Response.json({ jobPostingInfo: { ...validDetail, endDate } }));
    const result = workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
    if ((typeof endDate === "string" && !endDate.trim()) || endDate === null) assert.equal((await result).filter(Boolean).length, 1);
    else await assert.rejects(result, WorkdayDetailError);
  });
}

test("Workday detail freshness is anchored to the employer publication date", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => init?.method === "POST"
    ? workdaySearchResponse([detailPosting])
    : Response.json({ jobPostingInfo: { ...validDetail, startDate: "2026-07-01" } }));
  const jobs = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
  assert.equal(jobs.filter(Boolean).length, 0);
});

test("Workday shares one deadline across searches and details and caps the final request", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint;Intune|true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  let elapsed = 0;
  let requests = 0;
  const timeouts: number[] = [];
  t.mock.method(Date, "now", () => elapsed);
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    requests += 1;
    elapsed += requests <= 8 ? 14_000 : 8_000;
    if (init?.method === "POST") return workdaySearchResponse(Array.from({ length: 20 }, (_, index) => ({ ...detailPosting, externalPath: `${detailPosting.externalPath}-${index}` })));
    return Response.json({ jobPostingInfo: validDetail });
  });
  await assert.rejects(workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") }), WorkdayIncompleteSnapshotError);
  assert.equal(requests, 9, "Includes the search request in the shared budget and stops remaining detail work");
  assert.deepEqual(timeouts, [15_000, 15_000, 15_000, 15_000, 15_000, 15_000, 15_000, 15_000, 8_000]);
});

test("Workday starts the detail deadline after legacy sites finish", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Legacy|https://legacy.example/wday/cxs/legacy/Careers/jobs|Endpoint|false;;Direct|https://direct.example/wday/cxs/direct/Careers/jobs|Endpoint|true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  let elapsed = 0;
  t.mock.method(Date, "now", () => elapsed);
  t.mock.method(AbortSignal, "timeout", () => new AbortController().signal);
  t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      if (String(input).includes("legacy.example")) {
        elapsed += 119_000;
        return Response.json({ jobPostings: [detailPosting] });
      }
      elapsed += 1_000;
      return workdaySearchResponse([detailPosting]);
    }
    elapsed += 1_000;
    return Response.json({ jobPostingInfo: validDetail });
  });

  const jobs = await workdayProvider.fetchJobs({
    url: workdayProvider.defaultUrl,
    fetchedAt: new Date("2026-09-12T12:00:00Z"),
  });

  assert.equal(jobs.filter(Boolean).length, 2);
});

test("Workday paginates detail-enabled searches through the reported total", async (t) => {
  const originalEnv = { ...process.env };
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  process.env.JOB_WORKDAY_RESULTS_PER_QUERY = "2";
  t.after(() => {
    process.env = originalEnv;
  });
  const offsets: number[] = [];
  let detailRequests = 0;
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { offset: number };
      offsets.push(body.offset);
      const page = body.offset === 0
        ? [detailPosting, { ...detailPosting, externalPath: `${detailPosting.externalPath}-2` }]
        : [{ ...detailPosting, externalPath: `${detailPosting.externalPath}-3` }];
      return Response.json({ jobPostings: page, total: 3 });
    }
    detailRequests += 1;
    return Response.json({ jobPostingInfo: validDetail });
  });

  const jobs = await workdayProvider.fetchJobs({
    url: workdayProvider.defaultUrl,
    fetchedAt: new Date("2026-09-12T12:00:00Z"),
  });

  assert.deepEqual(offsets, [0, 2]);
  assert.equal(detailRequests, 3);
  assert.equal(jobs.filter(Boolean).length, 3);
});

test("Workday rejects duplicate paths within a paginated detail query", async (t) => {
  const originalEnv = { ...process.env };
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  process.env.JOB_WORKDAY_RESULTS_PER_QUERY = "2";
  t.after(() => {
    process.env = originalEnv;
  });
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    if (init?.method !== "POST") throw new Error("Detail fetch should not run");
    const { offset } = JSON.parse(String(init.body)) as { offset: number };
    return Response.json({
      jobPostings: offset === 0
        ? [detailPosting, { ...detailPosting, externalPath: `${detailPosting.externalPath}-2` }]
        : [detailPosting],
      total: 3,
    });
  });

  await assert.rejects(
    workdayProvider.fetchJobs({
      url: workdayProvider.defaultUrl,
      fetchedAt: new Date("2026-09-12T12:00:00Z"),
    }),
    (error) => error instanceof WorkdayIncompleteSnapshotError
      && error.cause instanceof Error
      && /repeated job path/.test(error.cause.message),
  );
});

for (const total of [undefined, -1, 0.5, 0, "1"] as const) {
  test(`Workday rejects an invalid detail-search total: ${String(total)}`, async (t) => {
    const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
    t.after(() => {
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    });
    t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
      if (init?.method !== "POST") throw new Error("Detail fetch should not run");
      return Response.json({
        jobPostings: [detailPosting],
        ...(total === undefined ? {} : { total }),
      });
    });

    await assert.rejects(
      workdayProvider.fetchJobs({
        url: workdayProvider.defaultUrl,
        fetchedAt: new Date("2026-09-12T12:00:00Z"),
      }),
      (error) => error instanceof WorkdayIncompleteSnapshotError
        && error.cause instanceof Error
        && error.cause.message === "Workday response included an invalid total",
    );
  });
}

test("Workday legacy search-only sites continue filtering malformed entries", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|false";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  t.mock.method(globalThis, "fetch", async () => Response.json({
    jobPostings: [
      detailPosting,
      { unexpected: true },
      { ...detailPosting, externalPath: "/job/%zz" },
      { ...detailPosting, externalPath: "/job/" }
    ]
  }));
  const jobs = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
  assert.equal(jobs.filter(Boolean).length, 1);
});

test("Workday preserves literal encoded placeholders through detail normalization", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  const jobDescription = "<p>Manage Intune endpoints using &#60;device&#62; placeholders in PowerShell automation. Build secure endpoint onboarding workflows and maintain deployment documentation for enterprise devices.</p>".repeat(3);
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => init?.method === "POST"
    ? workdaySearchResponse([detailPosting])
    : Response.json({ jobPostingInfo: { ...validDetail, jobDescription } }));
  const [job] = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
  assert.ok(job);
  assert.match(job.description ?? "", /<device>/);
  assert.doesNotMatch(job.description ?? "", /<p>/);
});

for (const malformed of [
  { title: 42 }, { title: {} }, { jobDescription: 42 }, { jobDescription: {} },
  { location: 42 }, { location: {} }, { remoteType: 42 }, { remoteType: {} },
  { timeType: 42 }, { timeType: {} }, { endDate: 42 }, { endDate: {} },
  { canApply: "false" }, { canApply: 0 }, { canApply: {} },
  { posted: "false" }, { posted: 0 }, { posted: {} }
]) {
  test(`Workday rejects wrongly typed optional detail ${JSON.stringify(malformed)}`, async (t) => {
      const originalSites = process.env.JOB_WORKDAY_SITES;
    process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
    t.after(() => {
      if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
      else process.env.JOB_WORKDAY_SITES = originalSites;
    });
    t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => init?.method === "POST"
      ? workdaySearchResponse([detailPosting])
      : Response.json({ jobPostingInfo: { ...validDetail, ...malformed } }));
    await assert.rejects(workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") }), (error) => error instanceof WorkdayDetailError && error.cause instanceof TypeError);
  });
}

test("Workday permits null optional detail fields", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => init?.method === "POST"
    ? workdaySearchResponse([detailPosting])
    : Response.json({ jobPostingInfo: { startDate: "2026-09-11", title: null, jobDescription: null, location: null, remoteType: null, timeType: null, endDate: null, additionalLocations: null, canApply: null, posted: null } }));
  const jobs = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
  assert.equal(jobs.filter(Boolean).length, 1);
});

test("Workday trims a date-only closing date before expanding its deadline", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => init?.method === "POST"
    ? workdaySearchResponse([detailPosting])
    : Response.json({ jobPostingInfo: { ...validDetail, endDate: " 2026-09-12 " } }));
  const jobs = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00Z") });
  assert.equal(jobs[0]?.expiresAt, "2026-09-12T23:59:59.999Z");
});

test("Workday closes a posting at its exact expiry instant", async (t) => {
  const originalSites = process.env.JOB_WORKDAY_SITES;
  process.env.JOB_WORKDAY_SITES = "Example|https://example.com/wday/cxs/example/Careers/jobs|Endpoint|true";
  t.after(() => {
    if (originalSites === undefined) delete process.env.JOB_WORKDAY_SITES;
    else process.env.JOB_WORKDAY_SITES = originalSites;
  });
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => init?.method === "POST"
    ? workdaySearchResponse([detailPosting])
    : Response.json({ jobPostingInfo: { ...validDetail, endDate: "2026-09-12T12:00:00.000Z" } }));
  const before = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T11:59:59.999Z") });
  assert.equal(before.filter(Boolean).length, 1);
  const atExpiry = await workdayProvider.fetchJobs({ url: workdayProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:00:00.000Z") });
  assert.equal(atExpiry.filter(Boolean).length, 0);
});
