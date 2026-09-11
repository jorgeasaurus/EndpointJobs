import assert from "node:assert/strict";
import test from "node:test";

import { aiDevBoardProvider } from "../job-refresh/providers/aidevboard";
import { rapidApiLinkedInProvider } from "../job-refresh/providers/rapidapi-linkedin";
import { normalizeSerpApiGoogleJob } from "../job-refresh/providers/serpapi";

const fetchedAt = new Date("2026-09-11T12:00:00.000Z");
const listings = [
  { title: "Systems Engineer", description: "Maintain business infrastructure and internal services." },
  { title: "Endpoint Engineer", description: "Manage Intune devices and automate deployment with PowerShell." },
  { title: "Accountant", description: "Prepare financial statements and tax returns." }
].map((listing, position) => ({
  ...listing,
  id: String(position),
  job_id: String(position),
  company_name: "Example",
  url: `https://example.test/jobs/${position}`,
  apply_url: `https://example.test/jobs/${position}`,
  share_link: `https://example.test/jobs/${position}`,
  tags: ["Listing Evidence"],
  via: "Listing Evidence",
  source: "Listing Evidence"
}));

for (const name of ["AI Dev Board", "SerpAPI", "RapidAPI LinkedIn"] as const) {
  test(`${name} preserves query admission without publishing query-derived metadata`, async () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = { ...process.env };
    globalThis.fetch = async () => Response.json({ jobs: listings });
    process.env.JOB_AIDEVBOARD_REQUIRE_API_KEY = "false";
    process.env.JOB_AIDEVBOARD_MAX_PAGES = "1";
    process.env.RAPIDAPI_LINKEDIN_JOBS_KEY = "fixture";
    process.env.JOB_RAPIDAPI_LINKEDIN_MAX_PAGES = "1";
    process.env.JOB_RAPIDAPI_LINKEDIN_LOCATION_FILTER = "United States";
    delete process.env.JOB_RAPIDAPI_LINKEDIN_SPAIN_LOCATION_FILTER;
    delete process.env.JOB_RAPIDAPI_LINKEDIN_LATAM_LOCATION_FILTER;
    const fetchJobs = async (query: string) => {
      if (name === "SerpAPI") {
        return listings.map((listing) => normalizeSerpApiGoogleJob(listing, query, fetchedAt));
      }
      process.env.JOB_AIDEVBOARD_QUERIES = query;
      process.env.JOB_RAPIDAPI_LINKEDIN_TITLE_FILTERS = query;
      const provider = name === "AI Dev Board" ? aiDevBoardProvider : rapidApiLinkedInProvider;
      return provider.fetchJobs({ url: provider.defaultUrl, fetchedAt });
    };
    try {
      const initial = await fetchJobs("Intune");
      const changedQuery = await fetchJobs("Jamf Android senior contract remote security");
      assert.equal(initial.length, 3);
      assert.ok(initial[0], "generic technical listing remains admitted by search evidence");
      assert.deepEqual(changedQuery, initial, "search query cannot alter any published job field");
      assert.deepEqual(initial[0].tools, []);
      assert.ok(initial[0].tags.includes("Listing Evidence"), "real source tags remain intact");
      assert.ok(initial[1]?.tools.includes("Intune"));
      assert.ok(initial[1]?.tools.includes("PowerShell"));
      assert.equal(initial[2], null, "query evidence must not admit an unrelated accountant");
    } finally {
      globalThis.fetch = originalFetch;
      process.env = originalEnv;
    }
  });
}
