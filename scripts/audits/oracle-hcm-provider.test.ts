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
  const requests = installFetch(t, [null, { placeholder: true }, detail]);
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

test("Oracle HCM excludes expired, undated, future and unrelated roles", async (t) => {
  installFetch(t, [
    { ...detail, Id: "1", ExternalPostedEndDate: "2026-09-11T00:00:00Z" },
    { ...detail, Id: "2", ExternalPostedStartDate: undefined },
    { ...detail, Id: "3", ExternalPostedStartDate: "2026-09-13T00:00:00Z" },
    { ...detail, Id: "4", Title: "Nurse", ExternalDescriptionStr: "Patient care", ExternalResponsibilitiesStr: "", ExternalQualificationsStr: "" }
  ]);
  assert.deepEqual(await fetchJobs(), []);
});

test("Oracle HCM caps searches instead of silently truncating a source", async (t) => {
  const requests = installFetch(t, [detail], 100);
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
  assert.deepEqual(await fetchJobs(), []);
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
