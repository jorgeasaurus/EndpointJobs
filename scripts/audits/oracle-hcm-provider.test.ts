import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { normalizeDescription, stripHtml } from "../job-refresh/shared";
import { OracleHcmIncompleteSnapshotError, oracleHcmProvider } from "../job-refresh/providers/oracle-hcm";

const fetchedAt = new Date("2026-09-12T12:00:00Z");
const detail = {
  Id: "41900",
  Title: "IT Systems Engineer (macOS and iOS Management)",
  ExternalPostedStartDate: "2026-08-20T10:58:59+00:00",
  ExternalPostedEndDate: "2026-09-21T03:55:00+00:00",
  ExternalDescriptionStr: `<p>Manage macOS and iOS endpoints with Jamf Pro and Apple Business Manager.</p><p>${"Device enrollment and packaging. ".repeat(100)}Final employer requirement.</p>`,
  ExternalResponsibilitiesStr: "<p>Configure MDM enrollment.</p>",
  ExternalQualificationsStr: "<p>PowerShell and Bash.</p>",
  PrimaryLocation: "Jacksonville, FL, United States",
  WorkplaceType: "Hybrid",
  JobSchedule: "Full time"
};

function installFetch(t: TestContext, records: unknown[], total = records.length) {
  const requests: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname.endsWith("recruitingCEJobRequisitions")) {
      return Response.json({ items: [{ TotalJobsCount: total, requisitionList: records }] });
    }
    const id = url.searchParams.get("finder")?.split("=")[1];
    return Response.json({ items: records.filter((r) => r && typeof r === "object" && "Id" in r && r.Id === id) });
  });
  return requests;
}

const fetchJobs = () => oracleHcmProvider.fetchJobs({ url: oracleHcmProvider.defaultUrl, fetchedAt });

test("Oracle HCM deduplicates searches and preserves employer dates, full text, identity, location and links", async (t) => {
  const requests = installFetch(t, [detail]);
  const jobs = await fetchJobs();
  assert.equal(jobs.length, 1);
  const job = jobs[0]!;
  assert.equal(job.company, "Florida Blue");
  assert.equal(job.postedAt, "2026-08-20T10:58:59.000Z");
  assert.equal(job.expiresAt, "2026-09-21T03:55:00.000Z");
  assert.equal(job.staleAfter, job.expiresAt);
  assert.equal(job.workplace, "Hybrid");
  assert.equal(job.location, detail.PrimaryLocation);
  assert.equal(job.employmentType, "Full-time");
  assert.ok(job.description!.length <= 12000);
  assert.ok(job.description!.includes("Final employer requirement."));
  assert.ok(job.description!.includes("Configure MDM enrollment."));
  assert.ok(job.description!.includes("PowerShell and Bash."));
  assert.equal(job.sourceUrl, "https://fa-etum-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/floridablue/job/41900");
  assert.equal(job.applyUrl, job.sourceUrl);
  assert.equal(requests.filter((url) => url.pathname.endsWith("RequisitionDetails")).length, 1);
  assert.ok(requests[0].searchParams.get("finder")?.includes("siteNumber=floridablue"));
});

test("Oracle HCM excludes expired, future and unrelated roles", async (t) => {
  installFetch(t, [
    { ...detail, Id: "1", ExternalPostedEndDate: "2026-09-11T00:00:00Z" },
    { ...detail, Id: "3", ExternalPostedStartDate: "2026-09-13T00:00:00Z" },
    { ...detail, Id: "4", Title: "Nurse", ExternalDescriptionStr: "Patient care", ExternalResponsibilitiesStr: "", ExternalQualificationsStr: "" }
  ]);
  assert.deepEqual(await fetchJobs(), []);
});

test("Oracle HCM caps searches instead of silently truncating a source", async (t) => {
  const requests = installFetch(t, Array.from({ length: 25 }, (_, index) => ({ ...detail, Id: String(index) })), 100);
  await assert.rejects(fetchJobs, /exceeded the 75 result bound/);
  assert.equal(requests.length, 3);
  assert.ok(requests[2].searchParams.get("finder")?.includes("offset=50"));
});

test("Oracle HCM rejects malformed search responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ items: [{}] }));
  await assert.rejects(fetchJobs, /requisitionList/);
});


test("Oracle HCM rejects descriptions containing only empty markup", async (t) => {
  installFetch(t, [
    { ...detail, ExternalDescriptionStr: "<p> </p>", ExternalResponsibilitiesStr: "<div>&nbsp;</div>", ExternalQualificationsStr: "<br/>" }
  ]);
  await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /missing description/.test(error.message));
});

test("Oracle HCM applies shared description normalization and length limits", async (t) => {
  const longDetail = { ...detail, ExternalDescriptionStr: `<p>${"Manage macOS endpoints with Jamf Pro. ".repeat(500)}</p>` };
  installFetch(t, [longDetail]);
  const [job] = await fetchJobs();
  assert.ok(job);
  const expected = normalizeDescription([
    longDetail.ExternalDescriptionStr, longDetail.ExternalResponsibilitiesStr, longDetail.ExternalQualificationsStr
  ].map((value) => stripHtml(value).trim()).join("\n\n"));
  assert.equal(job.description, expected);
  assert.ok(job.description!.length <= 12000);
  assert.ok(job.description!.endsWith("..."));
});

test("Oracle HCM uses shared positive-integer freshness configuration", async (t) => {
  installFetch(t, [{ ...detail, ExternalPostedEndDate: "2027-01-01T00:00:00Z" }]);
  const original = process.env.JOB_STALE_DAYS;
  try {
    for (const invalid of ["1.5", "1e2", "-1", "0", "Infinity", "NaN", ""]) {
      process.env.JOB_STALE_DAYS = invalid;
      const [job] = await fetchJobs();
      assert.equal(job?.staleAfter, "2026-10-04T10:58:59.000Z", invalid);
      assert.equal(job?.expiresAt, "2027-01-01T00:00:00.000Z", invalid);
    }
    process.env.JOB_STALE_DAYS = " 30 ";
    assert.equal((await fetchJobs())[0]?.staleAfter, "2026-09-19T10:58:59.000Z");
    process.env.JOB_STALE_DAYS = "10";
    assert.deepEqual(await fetchJobs(), []);
  } finally {
    if (original === undefined) delete process.env.JOB_STALE_DAYS;
    else process.env.JOB_STALE_DAYS = original;
  }
});


test("Oracle HCM API overrides preserve public application URLs and stable IDs", async (t) => {
  const requests = installFetch(t, [detail]);
  const [directJob] = await fetchJobs();
  const [proxyJob] = await oracleHcmProvider.fetchJobs({ url: "https://proxy.example.test/oracle", fetchedAt });
  assert.ok(directJob && proxyJob);
  assert.equal(proxyJob.sourceUrl, directJob.sourceUrl);
  assert.equal(proxyJob.applyUrl, directJob.applyUrl);
  assert.equal(proxyJob.id, directJob.id);
  assert.ok(requests.some((url) => url.origin === "https://proxy.example.test"));
});

test("Oracle HCM caps unique detail requests across all keyword searches", async (t) => {
  let searches = 0;
  let details = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("recruitingCEJobRequisitions")) {
      const requisitionList = Array.from({ length: 20 }, (_, index) => ({ ...detail, Id: String(searches * 20 + index) }));
      searches += 1;
      return Response.json({ items: [{ TotalJobsCount: 20, requisitionList }] });
    }
    details += 1;
    return Response.json({ items: [detail] });
  });
  await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /50 detail result bound/.test(error.message));
  assert.equal(searches, 3);
  assert.equal(details, 0);
});

test("Oracle HCM stops the provider when cumulative request time exceeds its deadline", async (t) => {
  let now = 0;
  let requests = 0;
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async () => {
    requests += 1;
    now += 16_000;
    return Response.json({ items: [{ TotalJobsCount: 1, requisitionList: [detail] }] });
  });
  await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /provider deadline/.test(error.message));
  assert.equal(requests, 4);
});

test("Oracle HCM deadline spans detail retrieval and discards a partial result", async (t) => {
  let now = 0;
  let detailRequests = 0;
  const records = [detail, { ...detail, Id: "41901" }];
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("recruitingCEJobRequisitions")) {
      now += 10_000;
      return Response.json({ items: [{ TotalJobsCount: 2, requisitionList: records }] });
    }
    now += 11_000;
    return Response.json({ items: [records[detailRequests++]] });
  });
  await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /provider deadline/.test(error.message));
  assert.equal(detailRequests, 2);
});


test("Oracle HCM normalizes trailing slashes on its API override", async (t) => {
  const requests = installFetch(t, [detail]);
  for (const suffix of ["/", "///"]) {
    const jobs = await oracleHcmProvider.fetchJobs({ url: `https://proxy.example.test/oracle${suffix}`, fetchedAt });
    assert.equal(jobs.length, 1);
  }
  assert.ok(requests.some((url) => url.pathname === "/oracle/recruitingCEJobRequisitions"));
  assert.ok(requests.some((url) => url.pathname === "/oracle/recruitingCEJobRequisitionDetails"));
  assert.ok(requests.every((url) => !url.pathname.includes("//")));
});

test("Oracle HCM skips details closed with 404 or 410 while retaining active jobs", async (t) => {
  const records = [{ ...detail, Id: "404" }, { ...detail, Id: "410" }, detail];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("recruitingCEJobRequisitions")) {
      return Response.json({ items: [{ TotalJobsCount: records.length, requisitionList: records }] });
    }
    const id = url.searchParams.get("finder")?.split("=")[1];
    if (id === "404" || id === "410") return new Response(null, { status: Number(id) });
    return Response.json({ items: [detail] });
  });
  const jobs = await fetchJobs();
  assert.equal(jobs.length, 1);
  assert.ok(jobs[0]?.sourceUrl?.endsWith(`/job/${detail.Id}`));
});

for (const status of [404, 410, 500]) {
  test(`Oracle HCM search HTTP ${status} fails closed`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status }));
    await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && error.message.includes(`request failed: ${status}`));
  });
}

for (const status of [401, 403, 429, 500]) {
  test(`Oracle HCM detail HTTP ${status} fails closed`, async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("recruitingCEJobRequisitions")) {
        return Response.json({ items: [{ TotalJobsCount: 1, requisitionList: [detail] }] });
      }
      return new Response(null, { status });
    });
    await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && error.message.includes(`request failed: ${status}`));
  });
}


for (const [label, records] of [
  ["all malformed", [null, { placeholder: true }]],
  ["mixed valid and malformed", [detail, { ...detail, Id: 41901 }]],
  ["missing title", [{ Id: "41900" }]],
  ["empty title", [{ Id: "41900", Title: "  " }]]
] as const) {
  test(`Oracle HCM rejects ${label} search records without returning a partial snapshot`, async (t) => {
    const requests = installFetch(t, [...records]);
    await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /malformed requisition/.test(error.message));
    assert.equal(requests.length, 1);
    assert.ok(requests[0].pathname.endsWith("recruitingCEJobRequisitions"));
  });
}

test("Oracle HCM accepts a valid empty search snapshot", async (t) => {
  const requests = installFetch(t, []);
  assert.deepEqual(await fetchJobs(), []);
  assert.equal(requests.length, 4);
});


test("Oracle HCM rejects successful detail responses without the requested requisition", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("recruitingCEJobRequisitions")) {
      return Response.json({ items: [{ TotalJobsCount: 1, requisitionList: [detail] }] });
    }
    return Response.json({ items: [] });
  });
  await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /missing detail for 41900/.test(error.message));
});

for (const invalidDate of ["not-a-date", "2026-99-99", 1790000000000]) {
  test(`Oracle HCM rejects invalid employer closing date ${invalidDate}`, async (t) => {
    installFetch(t, [detail, { ...detail, Id: "41901", ExternalPostedEndDate: invalidDate }]);
    await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /invalid closing date for 41901/.test(error.message));
  });
}

test("Oracle HCM permits absent employer closing dates and retains the freshness cutoff", async (t) => {
  installFetch(t, [undefined, null, "", "  "].map((ExternalPostedEndDate, index) => ({ ...detail, Id: String(index), ExternalPostedEndDate })));
  const jobs = await fetchJobs();
  assert.equal(jobs.length, 4);
  assert.ok(jobs.every((job) => job?.staleAfter === "2026-10-04T10:58:59.000Z"));
});


for (const total of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
  test(`Oracle HCM rejects invalid search total ${total}`, async (t) => {
    const requests = installFetch(t, [], total);
    await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /TotalJobsCount/.test(error.message));
    assert.equal(requests.length, 1);
  });
}

for (const [field, value] of [
  ["ExternalPostedStartDate", fetchedAt.getTime()],
  ["ExternalDescriptionStr", 123],
  ["ExternalResponsibilitiesStr", {}],
  ["ExternalQualificationsStr", []],
  ["PrimaryLocation", 42],
  ["WorkplaceType", true],
  ["JobSchedule", false]
] as const) {
  test(`Oracle HCM rejects a nonstring ${field} instead of coercing provider metadata`, async (t) => {
    installFetch(t, [{ ...detail, [field]: value }]);
    await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && error.message.includes(`invalid ${field}`));
  });
}

test("Oracle HCM rejects a malformed nonempty posting date", async (t) => {
  installFetch(t, [{ ...detail, ExternalPostedStartDate: "not-a-date" }]);
  await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /invalid posting date/.test(error.message));
});

for (const [field, message] of [["ExternalPostedStartDate", "posting date"], ["ExternalPostedEndDate", "closing date"]] as const) {
  test(`Oracle HCM rejects an impossible ${message}`, async (t) => {
    installFetch(t, [{ ...detail, [field]: "2026-02-30" }]);
    await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && error.message.includes(`invalid ${message}`));
  });
}

test("Oracle HCM permits null optional metadata without coercion", async (t) => {
  installFetch(t, [{ ...detail, ExternalResponsibilitiesStr: null, ExternalQualificationsStr: null, PrimaryLocation: null, WorkplaceType: null, JobSchedule: null }]);
  const jobs = await fetchJobs();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.location, "Unknown");
});


for (const [label, records, total] of [
  ["nonempty zero-count page", [detail], 0],
  ["missing page records", [], 1],
  ["partially missing page records", [detail], 2]
] as const) {
  test(`Oracle HCM rejects ${label}`, async (t) => {
    installFetch(t, [...records], total);
    await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /count did not match/.test(error.message));
  });
}


for (const date of [undefined, null, "", "  "]) {
  test(`Oracle HCM rejects missing publication date ${String(date)}`, async (t) => {
    installFetch(t, [{ ...detail, ExternalPostedStartDate: date }]);
    await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /invalid posting date/.test(error.message));
  });
}

test("Oracle HCM rejects a successful detail payload with no employer description", async (t) => {
  installFetch(t, [{ ...detail, ExternalDescriptionStr: undefined, ExternalResponsibilitiesStr: null, ExternalQualificationsStr: "" }]);
  await assert.rejects(fetchJobs, (error: unknown) => error instanceof OracleHcmIncompleteSnapshotError && /missing description/.test(error.message));
});

test("Oracle HCM keeps date-only deadlines open through their closing day", async (t) => {
  installFetch(t, [{ ...detail, ExternalPostedEndDate: " 2026-09-12 " }]);
  for (const now of ["2026-09-12T00:00:00.000Z", "2026-09-12T23:59:59.998Z"]) {
    const [job] = await oracleHcmProvider.fetchJobs({ url: oracleHcmProvider.defaultUrl, fetchedAt: new Date(now) });
    assert.ok(job);
    assert.equal(job.expiresAt, "2026-09-12T23:59:59.999Z");
    assert.equal(job.staleAfter, job.expiresAt);
  }
  for (const now of ["2026-09-12T23:59:59.999Z", "2026-09-13T00:00:00.000Z"]) {
    assert.deepEqual(await oracleHcmProvider.fetchJobs({ url: oracleHcmProvider.defaultUrl, fetchedAt: new Date(now) }), []);
  }
});

test("Oracle HCM preserves timestamp closing deadlines and exact expiration boundaries", async (t) => {
  installFetch(t, [{ ...detail, ExternalPostedEndDate: "2026-09-12T08:30:00-04:00" }]);
  const [job] = await oracleHcmProvider.fetchJobs({ url: oracleHcmProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:29:59.999Z") });
  assert.ok(job);
  assert.equal(job.expiresAt, "2026-09-12T12:30:00.000Z");
  assert.equal(job.staleAfter, job.expiresAt);
  assert.deepEqual(await oracleHcmProvider.fetchJobs({ url: oracleHcmProvider.defaultUrl, fetchedAt: new Date("2026-09-12T12:30:00.000Z") }), []);
});
