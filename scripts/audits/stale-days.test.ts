import { execFileSync } from "node:child_process";
import test from "node:test";

// Each process imports providers after configuration, matching jobs:refresh startup.
for (const [configured, days] of [["invalid", 45], ["0", 45], ["1.5", 45], ["7", 7]] as const) {
  test(`freshness configuration ${configured} uses ${days} days consistently`, () => {
    execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import assert from "node:assert/strict";
      import { toEndpointJob } from "./scripts/job-refresh/shared.ts";
      import { companyAtsProviders } from "./scripts/job-refresh/providers/company-ats.ts";
      const fetchedAt = new Date("2026-09-11T00:00:00.000Z");
      const postedAt = "2026-09-10T00:00:00.000Z";
      const candidate = { id: "audit", title: "Intune Endpoint Engineer", company: "Audit",
        postedAt, fetchedAt, source: "Audit", sourceUrl: "https://example.com/job",
        attributionLabel: "Audit", termsProfile: "public-api" };
      const expected = (date) => new Date(new Date(date).getTime() + ${days} * 86400000).toISOString();
      assert.equal(toEndpointJob(candidate).staleAfter, expected(postedAt));
      assert.equal(toEndpointJob({ ...candidate, staleAfter: "2026-09-12T00:00:00.000Z" }).staleAfter,
        "2026-09-12T00:00:00.000Z");
      process.env.JOB_AMAZON_QUERIES = "Intune";
      globalThis.fetch = async () => Response.json({jobs: [{id: "audit", title: candidate.title,
        posted_date: postedAt, job_path: "/en/jobs/audit"}]});
      const provider = companyAtsProviders.find(provider => provider.id === "amazon");
      const jobs = await provider.fetchJobs({url: provider.defaultUrl, fetchedAt});
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].staleAfter, expected(fetchedAt));
    `], { cwd: process.cwd(), env: { ...process.env, JOB_STALE_DAYS: configured }, stdio: "pipe" });
  });
}
