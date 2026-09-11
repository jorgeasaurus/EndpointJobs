import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import feedData from "../../src/data/jobs.json";
import type { Job } from "../../src/types/job";
import { fixedAuditNow, makeJob } from "./shared";

test("directory refreshes canonical jobs and pagination after expiry in a warm process", async (context) => {
  const jobs = feedData.jobs as Job[];
  const originalJobs = [...jobs];
  const description = "Manage Windows endpoint deployment and automation. ".repeat(40);
  const staleAfter = new Date(fixedAuditNow.getTime() + 86_400_000).toISOString();
  const canonical = makeJob({ id: "directory-direct", source: "Workday", description, staleAfter });
  const duplicate = makeJob({ id: "directory-duplicate", source: "Audit", description });
  const stableJobs = Array.from({ length: 49 }, (_, index) => makeJob({
    id: `directory-stable-${index}`, company: `Independent Company ${index}`
  }));
  const expiring = makeJob({ id: "directory-expiring", company: "Expiring Company", staleAfter });
  jobs.splice(0, jobs.length, canonical, duplicate, ...stableJobs, expiring);
  context.mock.timers.enable({ apis: ["Date"], now: fixedAuditNow });
  try {
    const { default: JobsDirectory, generateMetadata } = await import("../../src/app/jobs/page");
    const firstPage = { searchParams: Promise.resolve({}) };
    const secondPage = { searchParams: Promise.resolve({ page: "2" }) };
    const before = renderToStaticMarkup(await JobsDirectory(firstPage));
    assert.match(before, /href="\/jobs\/directory-direct"/);
    assert.doesNotMatch(before, /href="\/jobs\/directory-duplicate"/);
    assert.match(renderToStaticMarkup(await JobsDirectory(secondPage)), /directory-expiring/);
    assert.match(String((await generateMetadata(secondPage)).alternates?.canonical), /page=2$/);

    context.mock.timers.setTime(fixedAuditNow.getTime() + 2 * 86_400_000);
    const after = renderToStaticMarkup(await JobsDirectory(firstPage));
    assert.match(after, /href="\/jobs\/directory-duplicate"/);
    assert.doesNotMatch(after, /href="\/jobs\/directory-direct"/);
    assert.doesNotMatch(after, /directory-expiring/);
    await assert.rejects(JobsDirectory(secondPage), /NEXT_HTTP_ERROR_FALLBACK;404/);
    await assert.rejects(generateMetadata(secondPage), /NEXT_HTTP_ERROR_FALLBACK;404/);
  } finally {
    jobs.splice(0, jobs.length, ...originalJobs);
    context.mock.timers.reset();
  }
});
