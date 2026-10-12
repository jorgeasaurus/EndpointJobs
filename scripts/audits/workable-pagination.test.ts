import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { atsBoardProviders } from "../job-refresh/providers/ats-boards";

const provider = atsBoardProviders.find((entry) => entry.id === "workable")!;
const fetchedAt = new Date("2026-10-11T12:00:00Z");
const envNames = ["JOB_WORKABLE_ACCOUNTS", "JOB_WORKABLE_MAX_PAGES", "JOB_WORKABLE_FETCH_DETAILS"];
const previous = new Map<string, string | undefined>();
beforeEach(() => {
  for (const name of envNames) { previous.set(name, process.env[name]); delete process.env[name]; }
  process.env.JOB_WORKABLE_ACCOUNTS = "Example|example";
  process.env.JOB_WORKABLE_FETCH_DETAILS = "false";
});
afterEach(() => {
  for (const [name, value] of previous) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
const job = (shortcode: string, workplace = "hybrid") => ({
  shortcode, title: "Endpoint Engineer", published: "2026-10-05T00:00:00Z",
  location: { city: "San Francisco", region: "California", country: "United States" },
  workplace, remote: true, description: "Manage Intune and Jamf device enrollment and endpoint policies."
});

test("Workable discovers endpoint roles after the former three-page limit", async (t) => {
  let pages = 0;
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, options?: RequestInit) => {
    const token = JSON.parse(String(options?.body)).token;
    assert.equal(token, pages === 0 ? undefined : `page-${pages}`);
    pages += 1;
    return Response.json({ results: pages === 9 ? [job("last-page")] : [],
      ...(pages < 9 ? { nextPage: `page-${pages}` } : {}) });
  });
  const jobs = (await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt })).filter(Boolean);
  assert.equal(pages, 9);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]!.postedAt, "2026-10-05T00:00:00.000Z");
  assert.equal(jobs[0]!.workplace, "Hybrid");
});

test("Workable rejects truncated accounts when the configured page bound is exhausted", async (t) => {
  process.env.JOB_WORKABLE_MAX_PAGES = "2";
  let pages = 0;
  t.mock.method(globalThis, "fetch", async () => Response.json({
    results: [job(`partial-${++pages}`)], nextPage: `page-${pages}`
  }));
  await assert.rejects(provider.fetchJobs({ url: provider.defaultUrl, fetchedAt }), /No Workable accounts returned jobs/);
  assert.equal(pages, 2);
});

test("Workable rejects repeated pagination tokens before reaching the page bound", async (t) => {
  let pages = 0;
  t.mock.method(globalThis, "fetch", async () => {
    pages += 1; return Response.json({ results: [job("partial")], nextPage: "same-token" });
  });
  await assert.rejects(provider.fetchJobs({ url: provider.defaultUrl, fetchedAt }), /No Workable accounts returned jobs/);
  assert.equal(pages, 2);
});

test("Workable preserves explicit workplace metadata and publication dates through details", async (t) => {
  process.env.JOB_WORKABLE_FETCH_DETAILS = "true";
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, options?: RequestInit) => options?.method === "POST"
    ? Response.json({ results: [job("hybrid"), job("remote", "remote"), job("onsite", "on-site"), { ...job("onsite-underscore", "on_site"), location: {} }] })
    : Response.json({ shortcode: String(_url).split("/").pop(), description: "Manage Intune and Jamf endpoint deployment.", title: "Endpoint Engineer" }));
  const jobs = (await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt })).filter(Boolean);
  assert.deepEqual(jobs.map((entry) => entry!.workplace), ["Hybrid", "Remote", "On-site", "On-site"]);
  assert.ok(jobs.every((entry) => entry!.postedAt === "2026-10-05T00:00:00.000Z"));
});

test("Workable keeps verified open listings fresh without changing their publication date", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ results: [{
    ...job("older-open"), published: "2026-06-01T00:00:00Z"
  }] }));
  const [openJob] = await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt });
  assert.equal(openJob?.postedAt, "2026-06-01T00:00:00.000Z");
  assert.ok(Date.parse(openJob!.staleAfter) > fetchedAt.getTime());
});
