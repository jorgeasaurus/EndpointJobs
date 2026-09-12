import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

for (const { provider, detailStatus } of [
  { provider: "workday", detailStatus: 500 },
  { provider: "workday", detailStatus: 404 },
  { provider: "oraclehcm", detailStatus: 500 }
]) {
  test(`refresh ${detailStatus === 500 ? "preserves the previous feed on failed" : "omits closed"} ${provider} details`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "endpoint-refresh-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const output = join(directory, "jobs.json");
    const previous = JSON.stringify({ updatedAt: "2026-09-12", source: { name: "Previous" }, jobs: [{ id: "previous-job" }] });
    await writeFile(output, previous);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (url.includes("boards-api.greenhouse.io")) return Response.json({ jobs: [{
          id: 123, title: "Endpoint Engineer", absolute_url: "https://example.com/jobs/123",
          updated_at: new Date().toISOString(), location: { name: "Chicago, IL" },
          content: "Manage Windows endpoints with Intune."
        }] });
        if (url.includes("example.wd1.myworkdayjobs.com")) {
          if (init?.method === "POST") return Response.json({ jobPostings: [{
            title: "Endpoint Engineer", externalPath: "/job/Chicago/Endpoint_456"
          }] });
          return new Response(null, { status: ${detailStatus} });
        }
        if (url.includes("fa-etum-saasfaprod1.fa.ocs.oraclecloud.com")) {
          if (url.includes("recruitingCEJobRequisitions?")) return Response.json({
            items: [{ TotalJobsCount: 1, requisitionList: [{ Id: "41900", Title: "Endpoint Engineer" }] }]
          });
          return new Response(null, { status: ${detailStatus} });
        }
        throw new Error("Unexpected network request: " + url);
      };
      await import("./scripts/refresh-jobs.ts");
    `], {
      cwd: process.cwd(), encoding: "utf8", timeout: 15_000,
      env: {
        ...process.env, JOB_PROVIDERS: `greenhouse,${provider}`, JOB_OUTPUT_PATH: output,
        JOB_ORACLEHCM_API_URL: "https://fa-etum-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest",
        JOB_GREENHOUSE_BOARDS: "test", JOB_GREENHOUSE_API_URL: "https://boards-api.greenhouse.io/v1/boards",
        JOB_WORKDAY_SITES: "Example|https://example.wd1.myworkdayjobs.com/wday/cxs/example/Careers/jobs|Endpoint|true"
      }
    });
    assert.equal(result.error, undefined);
    const written = await readFile(output, "utf8");
    if (detailStatus === 500) {
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, provider === "workday" ? /WorkdayDetailError/ : /OracleHcmIncompleteSnapshotError/);
      assert.equal(written, previous, "No successful provider may overwrite the feed after incomplete details");
    } else {
      assert.equal(result.status, 0, result.stderr);
      const feed = JSON.parse(written);
      assert.equal(feed.jobs.length, 1);
      assert.equal(feed.jobs[0].source, "Greenhouse");
    }
  });
}
