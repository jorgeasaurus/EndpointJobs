import assert from "node:assert/strict";
import test from "node:test";
import { classify, extractLinks, mapBounded, request } from "../link-audit/check";
import { collectDestinations, checkDestination } from "../link-audit/external";
import { classifyProviderPayload, getProviderProbe } from "../link-audit/providers";
import { fixedAuditNow, makeJob } from "./shared";

const url = "https://example.com/job/1";
test("HTTP uncertainty never becomes a dead link", () => {
  for (const [status, expected] of [[401, "auth"], [403, "blocked"], [429, "rate-limited"], [500, "transient"], [999, "blocked"]] as const) {
    assert.equal(classify(status, "", url).outcome, expected);
  }
  assert.equal(classify(200, "<title>Just a moment...</title>", url).outcome, "blocked");
  assert.equal(classify(200, "", "https://example.com/authwall").outcome, "auth");
  assert.equal(classify(404, "", url).outcome, "dead");
  assert.equal(classify(410, "", url).outcome, "dead");
});
test("crawl preserves distinct query destinations but deduplicates fragments", () => {
  assert.deepEqual(extractLinks('<a href="/jobs?page=2&amp;x=y#top">x</a><a href="/jobs?page=2&amp;x=y">y</a><a href="mailto:a@example.com">z</a>', url), ["https://example.com/jobs?page=2&x=y"]);
});
test("source and application destinations retain all affected job IDs", () => {
  const results = collectDestinations([makeJob({ id: "a", sourceUrl: url, applyUrl: `${url}#apply` }), makeJob({ id: "b", sourceUrl: url, applyUrl: `${url}/apply` })]);
  assert.equal(results.length, 2);
  assert.deepEqual(results[0].jobIds, ["a", "b"]);
});
test("bounded workers preserve results without exceeding concurrency", async () => {
  let running = 0;
  let peak = 0;
  const results = await mapBounded([1, 2, 3, 4, 5], 2, async (value) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running--;
    return value * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(results, [2, 4, 6, 8, 10]);
  await assert.rejects(mapBounded([], 0, async () => 1));
});
test("provider URL matching excludes lookalikes and strips application suffixes", () => {
  const probe = getProviderProbe("https://acme.wd1.myworkdayjobs.com/en-US/Careers/job/City/Engineer_R123/apply");
  assert.equal(probe?.url, "https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/Careers/job/City/Engineer_R123");
  assert.equal(getProviderProbe("https://job-boards.greenhouse.io.attacker.com/acme/jobs/123"), null);
  assert.equal(getProviderProbe("https://user:password@job-boards.greenhouse.io/acme/jobs/123"), null);
});
test("ATS verification requires a matching recognized payload", () => {
  const probe = getProviderProbe("https://job-boards.greenhouse.io/acme/jobs/123")!;
  for (const [status, body] of [[404, "<html>Not found</html>"], [403, '{"error":"Job not found","status":403}'], [200, '{"id":456,"title":"Engineer"}']] as const) {
    assert.equal(classifyProviderPayload(probe, status, body).status, "unverified");
  }
  assert.equal(classifyProviderPayload(probe, 404, '{"error":"Job not found","status":404}').status, "dead");
  assert.equal(classifyProviderPayload(probe, 200, '{"id":123,"title":"Engineer"}').status, "ok");
  const workday = getProviderProbe("https://acme.wd1.myworkdayjobs.com/Careers/job/City/Engineer_R123")!;
  assert.equal(classifyProviderPayload(workday, 200, '{"jobPostingInfo":{"id":"1","title":"Engineer","posted":false,"canApply":false}}').status, "dead");
});
test("a single 404 followed by success is unverified, not confirmed dead", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    const response = new Response("", { status: calls === 1 ? 404 : 200 });
    Object.defineProperty(response, "url", { value: url });
    return response;
  });
  const result = await checkDestination({ url, jobIds: ["a"], sources: ["Test"] });
  assert.equal(calls, 2);
  assert.equal(result.outcome, "unverified");
});

test("oversized responses cannot silently pass a partial crawl", async (context) => {
  context.mock.method(globalThis, "fetch", async () => {
    const response = new Response("x".repeat(8_000_001));
    Object.defineProperty(response, "url", { value: url });
    return response;
  });
  assert.equal((await request(url)).observation.outcome, "unverified");
});

test("confirmed dead listings stay out of runtime and the generated feed", async () => {
  const { default: report } = await import("../../docs/link-audit-60.json");
  const { default: feed } = await import("../../src/data/jobs.json");
  const { isActiveJob } = await import("../../src/lib/jobs");
  const { isExcludedJobSourceUrl } = await import("../../src/lib/job-exclusions");
  for (const removed of report.remediation.excludedListings) {
    assert.ok(isExcludedJobSourceUrl(removed.sourceUrl), removed.id);
    assert.equal(isActiveJob(makeJob({ sourceUrl: removed.sourceUrl }), fixedAuditNow), false, removed.id);
    assert.ok(!feed.jobs.some((job) => job.sourceUrl === removed.sourceUrl), removed.id);
  }
  for (const kept of report.external.filter((entry) => ["blocked", "rate-limited", "auth", "unverified"].includes(entry.outcome))) {
    assert.equal(isExcludedJobSourceUrl(kept.url), false, kept.url);
  }
});
