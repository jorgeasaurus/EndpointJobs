import assert from "node:assert/strict";
import test from "node:test";

import { usaJobsProvider } from "../job-refresh/providers/usajobs";

test("USAJOBS search sends registered credentials and endpoint search filters", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  process.env.USAJOBS_API_KEY = "test-api-key";
  process.env.USAJOBS_USER_AGENT_EMAIL = "jobs@example.com";
  process.env.JOB_USAJOBS_QUERIES = "endpoint management";
  process.env.JOB_USAJOBS_DATE_POSTED_DAYS = "21";
  process.env.JOB_USAJOBS_RESULTS_PER_PAGE = "50";
  process.env.JOB_USAJOBS_MAX_PAGES = "2";
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return Response.json({
      SearchResult: {
        SearchResultItems: [],
        UserArea: { NumberOfPages: "1" }
      }
    });
  };

  try {
    await usaJobsProvider.fetchJobs({
      url: usaJobsProvider.defaultUrl,
      fetchedAt: new Date("2026-07-14T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.searchParams.get("Keyword"), "endpoint management");
  assert.equal(requestUrl.searchParams.get("JobCategoryCode"), "2210");
  assert.equal(requestUrl.searchParams.get("DatePosted"), "21");
  assert.equal(requestUrl.searchParams.get("ResultsPerPage"), "50");
  assert.equal(requestUrl.searchParams.get("Page"), "1");
  assert.equal(requestUrl.searchParams.get("Fields"), "Full");
  assert.equal(requestUrl.searchParams.get("SortField"), "opendate");
  assert.equal(requestUrl.searchParams.get("SortDirection"), "desc");
  const headers = new Headers(requests[0].init?.headers);
  assert.equal(headers.get("Authorization-Key"), "test-api-key");
  assert.equal(headers.get("User-Agent"), "jobs@example.com");
});

test("USAJOBS result preserves structured federal job details", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  process.env.USAJOBS_API_KEY = "test-api-key";
  process.env.USAJOBS_USER_AGENT_EMAIL = "jobs@example.com";
  process.env.JOB_USAJOBS_QUERIES = "endpoint management";
  globalThis.fetch = async () => Response.json({
    SearchResult: {
      SearchResultItems: [{
        MatchedObjectId: "123456789",
        MatchedObjectDescriptor: {
          PositionID: "OPM-2210-123",
          PositionTitle: "Endpoint Engineer",
          PositionURI: "https://www.usajobs.gov/job/123456789",
          ApplyURI: ["https://www.usajobs.gov/job/123456789/apply"],
          PositionLocationDisplay: "Location Negotiable After Selection, United States",
          PositionLocation: [{
            LocationName: "Location Negotiable After Selection, United States",
            CountryCode: "United States"
          }],
          OrganizationName: "Office of Personnel Management",
          DepartmentName: "Office of Personnel Management",
          JobCategory: [{ Name: "Information Technology Management", Code: "2210" }],
          JobGrade: [{ Code: "GS" }],
          PositionSchedule: [{ Name: "Full-time", Code: "1" }],
          PositionOfferingType: [{ Name: "Permanent", Code: "15317" }],
          QualificationSummary: "Experience administering enterprise endpoint platforms.",
          PositionRemuneration: [{
            MinimumRange: "98496",
            MaximumRange: "153354",
            RateIntervalCode: "PA",
            Description: "Per Year"
          }],
          PublicationStartDate: "2026-07-10T00:00:00Z",
          PositionStartDate: "2026-07-10T00:00:00Z",
          ApplicationCloseDate: "2026-07-31T23:59:59Z",
          PositionFormattedDescription: [{
            Label: "Dynamic Teaser",
            Content: "Manage Windows endpoints with Intune and PowerShell automation."
          }],
          UserArea: {
            Details: {
              JobSummary: "Lead endpoint management for a federal device fleet.",
              MajorDuties: "Engineer Microsoft Intune, Autopilot, and endpoint compliance controls.",
              Requirements: "Maintain secure Windows workstation configuration baselines.",
              KeyRequirements: ["U.S. citizenship required"],
              WhoMayApply: { Name: "The public", Code: "15514" },
              LowGrade: "12",
              HighGrade: "13",
              RemoteIndicator: true
            }
          }
        }
      }],
      UserArea: { NumberOfPages: "1" }
    }
  });

  let jobs;
  try {
    jobs = await usaJobsProvider.fetchJobs({
      url: usaJobsProvider.defaultUrl,
      fetchedAt: new Date("2026-07-14T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }

  assert.equal(jobs.length, 1);
  const job = jobs[0];
  assert.ok(job);
  assert.equal(job.source, "USAJOBS");
  assert.equal(job.sourceUrl, "https://www.usajobs.gov/job/123456789");
  assert.equal(job.applyUrl, "https://www.usajobs.gov/job/123456789/apply");
  assert.equal(job.location, "Location Negotiable After Selection, United States");
  assert.equal(job.workplace, "Remote");
  assert.equal(job.postedAt, "2026-07-10T00:00:00.000Z");
  assert.equal(job.staleAfter, "2026-07-31T23:59:59.000Z");
  assert.deepEqual(job.salary, {
    min: 98496,
    max: 153354,
    currency: "USD",
    label: "$98k-$153k"
  });
  assert.equal(job.employmentType, "Full-time");
  assert.match(job.summary, /endpoint management/i);
  assert.ok(job.tools.includes("Intune"));
  assert.ok(job.tools.includes("PowerShell"));
});

test("USAJOBS search follows response paging within the configured cap", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const requestedPages: string[] = [];

  process.env.USAJOBS_API_KEY = "test-api-key";
  process.env.USAJOBS_USER_AGENT_EMAIL = "jobs@example.com";
  process.env.JOB_USAJOBS_QUERIES = "endpoint management";
  process.env.JOB_USAJOBS_MAX_PAGES = "3";
  globalThis.fetch = async (input) => {
    requestedPages.push(new URL(String(input)).searchParams.get("Page") ?? "");
    return Response.json({
      SearchResult: {
        SearchResultItems: [],
        UserArea: { NumberOfPages: "2" }
      }
    });
  };

  try {
    await usaJobsProvider.fetchJobs({
      url: usaJobsProvider.defaultUrl,
      fetchedAt: new Date("2026-07-14T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }

  assert.deepEqual(requestedPages, ["1", "2"]);
});
