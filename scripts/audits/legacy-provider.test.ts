import assert from "node:assert/strict";
import test from "node:test";

import { publicJobBoardProviders } from "../job-refresh/providers/public-job-boards";
import { atsBoardProviders } from "../job-refresh/providers/ats-boards";
import { companyAtsProviders } from "../job-refresh/providers/company-ats";
import type { ProviderAdapter } from "../job-refresh/provider";

const fetchedAt = new Date("2026-07-15T12:00:00.000Z");
const postedAt = "2026-07-10T12:00:00.000Z";
const title = "Senior Intune Endpoint Engineer";
const sourceUrl = "https://example.com/jobs/123";
const description = "Manage Intune and Windows endpoint deployment. ".repeat(15);
const onsiteDescription = `${description} This position requires full-time onsite support. This is not a remote or hybrid position.`;

const fixtures = [
  { id: "remoteok", payload: [{ id: 123, position: title, company: "Example", url: sourceUrl, location: "Remote", date: postedAt, description }] },
  { id: "remotive", payload: { jobs: [{ id: 123, title, company_name: "Example", url: sourceUrl, publication_date: postedAt, description: onsiteDescription }] } },
  { id: "arbeitnow", payload: { data: [{ slug: "123", title, company_name: "Example", url: sourceUrl, remote: true, created_at: Date.parse(postedAt) / 1000, description }] } },
  { id: "jobicy", payload: { jobs: [{ id: 123, jobTitle: title, companyName: "Example", url: sourceUrl, pubDate: postedAt, jobDescription: description }] } },
  { id: "muse", env: { JOB_MUSE_PAGES: "1" }, payload: { results: [{ id: 123, name: title, company: { name: "Example" }, refs: { landing_page: sourceUrl }, publication_date: postedAt, contents: description }] } },
  { id: "adzuna", env: { ADZUNA_APP_ID: "fixture", ADZUNA_APP_KEY: "fixture", JOB_ADZUNA_QUERIES: "endpoint" }, payload: { results: [{ id: 123, title, company: { display_name: "Example" }, redirect_url: sourceUrl, created: postedAt, description }] } },
  { id: "greenhouse", env: { JOB_GREENHOUSE_BOARDS: "example" }, payload: { jobs: [{ id: 123, title, absolute_url: sourceUrl, updated_at: postedAt, content: description }] } },
  { id: "lever", env: { JOB_LEVER_COMPANIES: "example" }, payload: [{ id: 123, text: title, hostedUrl: sourceUrl, createdAt: Date.parse(postedAt), descriptionPlain: description }] },
  { id: "ashby", env: { JOB_ASHBY_BOARDS: "example" }, payload: { jobs: [{ id: 123, title, jobUrl: sourceUrl, publishedAt: postedAt, descriptionPlain: description, isRemote: true }] } },
  { id: "workable", env: { JOB_WORKABLE_ACCOUNTS: "Example|example", JOB_WORKABLE_FETCH_DETAILS: "false" }, payload: { results: [{ id: 123, shortcode: "123", title, url: sourceUrl, published: postedAt, description }] } },
  { id: "amazon", env: { JOB_AMAZON_QUERIES: "endpoint" }, payload: { jobs: [{ id: 123, title, company_name: "Example", job_path: "/jobs/123", posted_date: postedAt, description }] } }
];
const providers: readonly ProviderAdapter[] = [...publicJobBoardProviders, ...atsBoardProviders, ...companyAtsProviders];

for (const fixture of fixtures) {
  test(`${fixture.id} uses canonical classification while preserving provider metadata`, async () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = { ...process.env };
    Object.assign(process.env, fixture.env);
    globalThis.fetch = async () => Response.json(fixture.payload);
    try {
      const provider = providers.find((candidate) => candidate.id === fixture.id)!;
      const jobs = await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt });
      assert.equal(jobs.length, 1);
      const job = jobs[0];
      assert.ok(job);
      assert.equal(job.title, title);
      assert.equal(job.postedAt, postedAt);
      assert.equal(job.fetchedAt, fetchedAt.toISOString());
      assert.ok(job.tools.includes("Intune"));
      assert.equal(job.seniority, "Senior");
      assert.equal(job.expiresAt, job.staleAfter);
      assert.equal(job.source, provider.displayName);
      if (fixture.id === "adzuna") {
        assert.equal(job.description, undefined);
        assert.match(job.summary, /^Adzuna listing preview/);
      } else {
        assert.ok(job.description?.includes(description.trim()));
      }
      if (fixture.id === "remotive") assert.equal(job.workplace, "On-site");
    } finally {
      globalThis.fetch = originalFetch;
      process.env = originalEnv;
    }
  });
}

test("missing publication dates use the refresh clock instead of pretending to be known dates", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ jobs: [{ id: 123, title, company_name: "Example", url: sourceUrl, description }] });
  try {
    const provider = publicJobBoardProviders.find((candidate) => candidate.id === "remotive")!;
    const [job] = await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt });
    assert.ok(job);
    assert.equal(job.postedAt, job.fetchedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid pagination options fall back to the provider default instead of skipping ingestion", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  process.env.JOB_MUSE_PAGES = "not-a-number";
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({ results: [] });
  };
  try {
    const provider = publicJobBoardProviders.find((candidate) => candidate.id === "muse")!;
    assert.deepEqual(await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt }), []);
    assert.equal(requests, 5);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("Activate search terms do not qualify or classify unrelated listings", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  process.env.JOB_ACTIVATE_SITES = "Example|https://example.com/search|Intune";
  const listing = (id: string, jobTitle: string, summary: string) => `
    <li class="job-item" data-record-key="${id}">
      <h3>${jobTitle}</h3><p>${summary}</p>
      <a href="/jobs/${id}" class="view-details-link">View details</a>
    </li>`;
  globalThis.fetch = async () => Response.json({
    jobsHtml: listing("unrelated", "Accountant", "Prepare financial statements and tax returns.")
      + listing("endpoint", "Windows Endpoint Engineer", "Manage Windows device deployment and endpoint operations.")
  });
  try {
    const provider = companyAtsProviders.find((candidate) => candidate.id === "activate")!;
    const jobs = await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt });
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0], null);
    const endpointJob = jobs[1];
    assert.ok(endpointJob);
    assert.ok(endpointJob.platforms.includes("Windows"));
    assert.ok(!endpointJob.tools.includes("Intune"));
    assert.ok(!endpointJob.description?.includes("Intune"));
    assert.ok(!endpointJob.tags.includes("Intune"));
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("Activate search evidence admits technical listings without changing published metadata", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  globalThis.fetch = async () => Response.json({
    jobsHtml: `<li class="job-item" data-record-key="technical">
      <h3>Systems Engineer</h3><p>Maintain business infrastructure and support internal services.</p>
      <a href="/jobs/technical" class="view-details-link">View details</a>
    </li>`
  });
  try {
    const provider = companyAtsProviders.find((candidate) => candidate.id === "activate")!;
    process.env.JOB_ACTIVATE_SITES = "Example|https://example.com/search|Intune";
    const [intuneJob] = await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt });
    assert.ok(intuneJob, "query-backed technical listing is admitted");
    assert.deepEqual(intuneJob.tools, []);
    process.env.JOB_ACTIVATE_SITES = "Example|https://example.com/search|Jamf Android senior contract remote security";
    const [jamfJob] = await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt });
    assert.deepEqual(jamfJob, intuneJob, "query-only evidence must not alter published fields");
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});
