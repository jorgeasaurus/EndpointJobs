import assert from "node:assert/strict";
import test from "node:test";

import feedData from "../../src/data/jobs.json";
import type { Job } from "../../src/types/job";
import { fixedAuditNow, makeJob } from "./shared";

test("active duplicate stops redirecting when its canonical job expires", async (context) => {
  const jobs = feedData.jobs as Job[];
  const originalJobs = [...jobs];
  const description = "Manage Windows endpoint deployment and automation. ".repeat(40);
  const canonical = makeJob({
    id: "expiry-direct", source: "Workday", description,
    staleAfter: new Date(fixedAuditNow.getTime() + 86_400_000).toISOString()
  });
  const duplicate = makeJob({ id: "expiry-duplicate", source: "Audit", description });
  jobs.splice(0, jobs.length, canonical, duplicate);
  context.mock.timers.enable({ apis: ["Date"], now: fixedAuditNow });
  try {
    const { default: JobPage, generateMetadata, generateStaticParams } = await import("../../src/app/jobs/[id]/page");
    const props = { params: Promise.resolve({ id: duplicate.id }) };
    const before = await generateMetadata(props);
    assert.match(String(before.alternates?.canonical), /expiry-direct$/);
    context.mock.timers.setTime(fixedAuditNow.getTime() + 2 * 86_400_000);
    const after = await generateMetadata(props);
    assert.match(String(after.alternates?.canonical), /expiry-duplicate$/);
    assert.deepEqual(generateStaticParams(), [{ id: duplicate.id }]);
    assert.ok(await JobPage(props));
  } finally {
    jobs.splice(0, jobs.length, ...originalJobs);
    context.mock.timers.reset();
  }
});
