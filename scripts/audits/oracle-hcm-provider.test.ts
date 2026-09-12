import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { oracleHcmProvider } from "../job-refresh/providers/oracle-hcm";

const fetchedAt = new Date("2026-09-12T12:00:00Z");
const detail = {
  Id: "41900",
  Title: "IT Systems Engineer (macOS and iOS Management)",
  ExternalPostedStartDate: "2026-08-20T10:58:59+00:00",
  ExternalPostedEndDate: "2026-09-21T03:55:00+00:00",
  ExternalDescriptionStr: `<p>Manage macOS and iOS endpoints with Jamf Pro and Apple Business Manager.</p><p>${"Device enrollment and packaging. ".repeat(500)}Final employer requirement.</p>`,
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
  assert.ok(job.description!.length > 12000);
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
