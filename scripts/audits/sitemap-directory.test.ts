import assert from "node:assert/strict";
import test from "node:test";

import sitemap from "../../src/app/sitemap";
import { generateMetadata } from "../../src/app/jobs/page";
import feedData from "../../src/data/jobs.json";
import type { Job } from "../../src/types/job";
import { fixedAuditNow, makeJob } from "./shared";

const jobs = feedData.jobs as Job[];

for (const count of [0, 1, 50, 51, 100, 101]) {
  test(`sitemap lists exactly the valid directory pages for ${count} active jobs`, async (context) => {
    const originalJobs = [...jobs];
    context.mock.timers.enable({ apis: ["Date"], now: fixedAuditNow });
    jobs.splice(0, jobs.length, ...Array.from({ length: count }, (_, index) =>
      makeJob({ id: `sitemap-${index}`, company: `Company ${index}` })
    ));
    try {
      const directoryUrls = sitemap().map((entry) => entry.url)
        .filter((url) => new URL(url).pathname === "/jobs");
      const expectedPages = Math.max(1, Math.ceil(count / 50));
      assert.equal(directoryUrls.length, expectedPages);
      assert.equal(directoryUrls[0], "https://endpointjobs.dev/jobs");
      for (let page = 1; page <= expectedPages; page++) {
        const metadata = await generateMetadata({ searchParams: Promise.resolve({ page: String(page) }) });
        assert.equal(directoryUrls[page - 1], metadata.alternates?.canonical);
      }
      await assert.rejects(generateMetadata({
        searchParams: Promise.resolve({ page: String(expectedPages + 1) })
      }), /NEXT_HTTP_ERROR_FALLBACK;404/);
    } finally {
      jobs.splice(0, jobs.length, ...originalJobs);
      context.mock.timers.reset();
    }
  });
}

test("sitemap pagination excludes duplicates and shrinks when canonical listings expire", (context) => {
  const originalJobs = [...jobs];
  const description = "Manage Windows endpoints and automate their deployment. ".repeat(40);
  const staleAfter = new Date(fixedAuditNow.getTime() + 86_400_000).toISOString();
  context.mock.timers.enable({ apis: ["Date"], now: fixedAuditNow });
  const stable = Array.from({ length: 49 }, (_, index) =>
    makeJob({ id: `stable-${index}`, company: `Independent ${index}` }));
  const direct = makeJob({ id: "direct", source: "Workday", description });
  const duplicate = makeJob({ id: "duplicate", description });
  const expiring = makeJob({ id: "expiring", company: "Expiring", staleAfter });
  const expired = makeJob({ id: "expired", staleAfter: new Date(fixedAuditNow.getTime() - 1).toISOString() });
  jobs.splice(0, jobs.length, ...stable, direct, duplicate, expiring, expired);
  try {
    const before = sitemap().map((entry) => entry.url);
    assert.ok(before.includes("https://endpointjobs.dev/jobs?page=2"));
    assert.ok(before.includes("https://endpointjobs.dev/jobs/direct"));
    assert.ok(!before.includes("https://endpointjobs.dev/jobs/duplicate"));
    assert.ok(!before.includes("https://endpointjobs.dev/jobs/expired"));

    context.mock.timers.setTime(fixedAuditNow.getTime() + 2 * 86_400_000);
    const after = sitemap().map((entry) => entry.url);
    assert.ok(after.includes("https://endpointjobs.dev/jobs"));
    assert.ok(!after.includes("https://endpointjobs.dev/jobs?page=2"));
    assert.ok(!after.includes("https://endpointjobs.dev/jobs/expiring"));
  } finally {
    jobs.splice(0, jobs.length, ...originalJobs);
    context.mock.timers.reset();
  }
});
