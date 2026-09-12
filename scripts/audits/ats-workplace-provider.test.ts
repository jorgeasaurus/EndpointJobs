import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { atsBoardProviders } from "../job-refresh/providers/ats-boards";

const fetchedAt = new Date("2026-09-12T12:00:00Z");
const description = "Manage Intune and Jamf endpoints. Support remote sites and hybrid infrastructure.";

const previousEnv = new Map<string, string | undefined>();
beforeEach(() => {
  for (const name of ["JOB_GREENHOUSE_BOARDS", "JOB_ASHBY_BOARDS"]) {
    previousEnv.set(name, process.env[name]);
    process.env[name] = "test";
  }
});
afterEach(() => {
  for (const [name, previous] of previousEnv) {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
});

test("Ashby workplace metadata overrides incidental description text and normalizes employment labels", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ jobs: [
    { id: "onsite", workplaceType: "OnSite", isRemote: false, employmentType: "FullTime" },
    { id: "hybrid", workplaceType: "Hybrid", isRemote: true, employmentType: "PartTime" },
    { id: "remote", workplaceType: "Remote", isRemote: false, employmentType: "Contract" }
  ].map((job) => ({ ...job, title: "Endpoint Engineer", location: "El Segundo, CA",
    publishedAt: "2026-09-12T00:00:00Z", jobUrl: `https://jobs.ashbyhq.com/test/${job.id}`,
    descriptionPlain: description })) }));
  const provider = atsBoardProviders.find((provider) => provider.id === "ashby")!;
  const jobs = (await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt })).filter(Boolean);
  for (const [id, workplace, employmentType] of [
    ["onsite", "On-site", "Full-time"], ["hybrid", "Hybrid", "Part-time"], ["remote", "Remote", "Contract"]
  ]) {
    const job = jobs.find((job) => job!.sourceUrl.endsWith(`/${id}`))!;
    assert.equal(job.workplace, workplace);
    assert.equal(job.employmentType, employmentType);
  }
});

test("Greenhouse employer workplace tags override generic company remote hiring text", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ jobs: ["Hybrid", "Remote", "Onsite"].map((tag, index) => ({
    id: index + 1, title: "Endpoint Engineer", location: { name: "Boston, MA" },
    absolute_url: `https://job-boards.greenhouse.io/test/jobs/${tag}`,
    updated_at: "2026-09-11T00:00:00Z", content: `${description} <p>#LI-${tag}</p> For select positions, we hire fully remote candidates.`
  })) }));
  const provider = atsBoardProviders.find((provider) => provider.id === "greenhouse")!;
  const jobs = (await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt })).filter(Boolean);
  for (const [tag, expected] of [["Hybrid", "Hybrid"], ["Remote", "Remote"], ["Onsite", "On-site"]]) {
    assert.equal(jobs.find((job) => job!.sourceUrl.endsWith(`/${tag}`))!.workplace, expected);
  }
});

test("Greenhouse preserves original publication dates and falls back for unavailable or invalid dates", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ jobs: [
    { id: 1, first_published: "2026-06-03T09:50:05-04:00" },
    { id: 2 },
    { id: 3, first_published: "invalid" }
  ].map((job) => ({ ...job, title: "Endpoint Engineer", content: description,
    absolute_url: `https://job-boards.greenhouse.io/test/jobs/${job.id}`,
    updated_at: "2026-09-11T20:37:10Z" })) }));
  const provider = atsBoardProviders.find((provider) => provider.id === "greenhouse")!;
  const jobs = (await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt })).filter(Boolean);
  assert.equal(jobs.find((job) => job!.sourceUrl.endsWith("/1"))!.postedAt, "2026-06-03T13:50:05.000Z");
  for (const id of [2, 3]) {
    assert.equal(jobs.find((job) => job!.sourceUrl.endsWith(`/${id}`))!.postedAt, "2026-09-11T20:37:10.000Z");
  }
});
