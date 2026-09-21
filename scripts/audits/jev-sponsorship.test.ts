import assert from "node:assert/strict";
import test from "node:test";

import type { Job } from "../../src/types/job";
import {
  classifyVisaSponsorshipWithJev,
  enrichVisaSponsorshipWithJev,
  extractJevSponsorshipPassages,
  type JevChoiceEvaluator
} from "../job-refresh/jev-sponsorship";
import { toEndpointJob } from "../job-refresh/shared";

const sourceUrl = "https://example.com/jobs/endpoint-engineer";

function evaluator(result: { choice: string; confidence: number; model?: string }): JevChoiceEvaluator {
  return async () => ({ ...result, model: result.model ?? "jev-test" });
}

test("deterministic claims remain authoritative and skip JEV", async () => {
  let called = false;
  const result = await classifyVisaSponsorshipWithJev({
    description: "We provide visa sponsorship.", sourceUrl
  }, { evaluator: async () => { called = true; throw new Error("not expected"); } });
  assert.equal(called, false);
  assert.equal(result.method, "deterministic");
  assert.equal(result.sponsorship.status, "available");
});

test("high-confidence JEV choice maps to exact candidate evidence", async () => {
  const evidence = "Qualified applicants may receive employer immigration support after legal review.";
  const description = `Manage Intune and Jamf.\n\n${evidence}\n\nWe offer health insurance.`;
  const evidenceWithContext = `Manage Intune and Jamf.\n\n${evidence}\n\nWe offer health insurance.`;
  const result = await classifyVisaSponsorshipWithJev({ description, sourceUrl }, {
    evaluator: async (request) => {
      assert.equal(request.model, "jev-latest");
      assert.deepEqual(request.state.candidate_passages, { p0: evidenceWithContext });
      assert.deepEqual(request.criteria["case-by-case:0"], {
        status: "The employer may sponsor or will consider sponsorship depending on the candidate, role, approval, qualifications, or another stated condition.",
        evidence_reference: "`candidate_passages.p0`"
      });
      return { choice: "case-by-case:0", confidence: 0.91, model: "jev-1.13.0" };
    }
  });
  assert.deepEqual(result, {
    sponsorship: { status: "case-by-case", evidence: evidenceWithContext, sourceUrl },
    method: "jev", confidence: 0.91, model: "jev-1.13.0"
  });
});

test("JEV receives preceding restriction context", async () => {
  const description = "Only for internal transfers.\n\nQualified applicants may receive employer immigration support after legal review.";
  const result = await classifyVisaSponsorshipWithJev({ description, sourceUrl }, {
    evaluator: async (request) => {
      assert.deepEqual(request.state.candidate_passages, { p0: description });
      return { choice: "case-by-case:0", confidence: 0.95, model: "jev-test" };
    }
  });
  assert.deepEqual(result.sponsorship, {
    status: "case-by-case", evidence: description, sourceUrl
  });
});

test("low-confidence, unknown, malformed, and failed evaluations stay not stated", async () => {
  const input = { description: "Visa status and employment authorization details are reviewed.", sourceUrl };
  for (const evaluate of [
    evaluator({ choice: "available:0", confidence: 0.79 }),
    evaluator({ choice: "not_stated", confidence: 0.99 }),
    evaluator({ choice: "available:99", confidence: 0.99 }),
    (async () => { throw new Error("rate limited"); }) satisfies JevChoiceEvaluator
  ]) {
    const result = await classifyVisaSponsorshipWithJev(input, { evaluator: evaluate });
    assert.equal(result.sponsorship.status, "not-stated");
    assert.notEqual(result.method, "jev");
  }
});

test("candidate extraction ignores unrelated text and bounds long passages", () => {
  assert.deepEqual(extractJevSponsorshipPassages("Relocation is available. Company-sponsored events."), []);
  const passages = extractJevSponsorshipPassages(
    `${"Endpoint engineering duties. ".repeat(80)}Visa sponsorship depends on approval. ${"Benefits. ".repeat(80)}`
  );
  assert.ok(passages.length > 0);
  assert.ok(passages.every((passage) => passage.length <= 1_200));
  assert.ok(passages.some((passage) => passage.includes("Visa sponsorship depends on approval.")));

  const longSentence = `${"A".repeat(1_250)} Visa sponsorship may be available after review.`;
  const longPassages = extractJevSponsorshipPassages(longSentence);
  assert.ok(longPassages.every((passage) => passage.length <= 1_200));
  assert.ok(longPassages.every((passage) => sponsorshipClaimIsPresent(passage)));

  const conflicting = extractJevSponsorshipPassages(
    `Visa sponsorship is available. ${"A".repeat(1_800)} We do not sponsor visas.`
  );
  assert.ok(conflicting.some((passage) => passage.includes("Visa sponsorship is available.")));
  assert.ok(conflicting.some((passage) => passage.includes("We do not sponsor visas.")));

  const firstClaim = "Visa sponsorship is available. ";
  const boundaryConflict = extractJevSponsorshipPassages(
    `${firstClaim}${"A".repeat(1_170 - firstClaim.length)} Immigration assistance is unavailable for this position.`
  );
  assert.ok(boundaryConflict.some((passage) => passage.includes("Immigration assistance is unavailable for this position.")));

  const tooManySignals = Array.from(
    { length: 25 },
    (_, index) => `Policy ${index}: immigration sponsorship is reviewed for group ${index}.`
  ).join("\n\n");
  assert.deepEqual(extractJevSponsorshipPassages(tooManySignals), []);

  const precedingRestriction = "Only for internal transfers.";
  const novelClaim = "Qualified applicants may receive employer immigration support after legal review.";
  assert.deepEqual(extractJevSponsorshipPassages(`${precedingRestriction}\n\n${novelClaim}`), [
    `${precedingRestriction}\n\n${novelClaim}`
  ]);
});

function sponsorshipClaimIsPresent(value: string) {
  return value.includes("Visa sponsorship may be available after review.");
}

test("batch enrichment skips known jobs and accepts only JEV results", async () => {
  const base = {
    title: "Endpoint Engineer", company: "Example", location: "Remote", workplace: "Remote",
    postedAt: "2026-09-20", fetchedAt: "2026-09-20", staleAfter: "2026-11-01",
    source: "Test", sourceUrl, attributionLabel: "Test", termsProfile: "public-api",
    summary: "Endpoint role", tags: [], matchReasons: [], tools: [], platforms: [],
    roleFamily: "Endpoint Engineering", seniority: "Mid", employmentType: "Full-time"
  } satisfies Omit<Job, "id">;
  const jobs: Job[] = [
    { ...base, id: "known", description: "We provide visa sponsorship.", visaSponsorship: { status: "available", evidence: "We provide visa sponsorship.", sourceUrl } },
    { ...base, id: "unknown", description: "Immigration sponsorship depends on legal review." },
    { ...base, id: "irrelevant", description: "Manage Intune endpoints." },
    { ...base, id: "stale-unknown", description: "We provide visa sponsorship.", visaSponsorship: { status: "not-stated" } }
  ];
  let calls = 0;
  const result = await enrichVisaSponsorshipWithJev(jobs, {
    evaluator: async () => {
      calls++;
      return { choice: "case-by-case:0", confidence: 0.95, model: "jev-test" };
    }
  });
  assert.equal(calls, 1);
  assert.deepEqual({ attempted: result.attempted, classified: result.classified, failed: result.failed }, {
    attempted: 1, classified: 1, failed: 0
  });
  assert.equal(result.jobs[0], jobs[0]);
  assert.equal(result.jobs[1].visaSponsorship?.status, "case-by-case");
  assert.equal(result.jobs[2], jobs[2]);
  assert.deepEqual(result.jobs[3].visaSponsorship, {
    status: "available", evidence: "We provide visa sponsorship.", sourceUrl
  });
});

test("deterministic promotions persist without a JEV evaluator", async () => {
  const job = {
    id: "stale-unknown", title: "Endpoint Engineer", company: "Example", location: "Remote",
    workplace: "Remote", postedAt: "2026-09-20", fetchedAt: "2026-09-20", staleAfter: "2026-11-01",
    source: "Test", sourceUrl, attributionLabel: "Test", termsProfile: "public-api",
    description: "We do not provide visa sponsorship.", visaSponsorship: { status: "not-stated" },
    summary: "Endpoint role", tags: [], matchReasons: [], tools: [], platforms: [],
    roleFamily: "Endpoint Engineering", seniority: "Mid", employmentType: "Full-time"
  } satisfies Job;
  const result = await enrichVisaSponsorshipWithJev([job], { evaluator: null });
  assert.deepEqual(result.jobs[0].visaSponsorship, {
    status: "unavailable", evidence: "We do not provide visa sponsorship.", sourceUrl
  });
  assert.equal(result.attempted, 0);
});

test("batch enrichment caps paid requests and reports eligible jobs left untouched", async () => {
  const jobs: Job[] = Array.from({ length: 3 }, (_, index) => ({
    id: `unknown-${index}`, title: "Endpoint Engineer", company: "Example", location: "Remote",
    workplace: "Remote", postedAt: "2026-09-20", fetchedAt: "2026-09-20", staleAfter: "2026-11-01",
    source: "Test", sourceUrl: `${sourceUrl}/${index}`, attributionLabel: "Test", termsProfile: "public-api",
    description: "Immigration sponsorship depends on legal review.", summary: "Endpoint role", tags: [],
    matchReasons: [], tools: [], platforms: [], roleFamily: "Endpoint Engineering", seniority: "Mid",
    employmentType: "Full-time"
  }));
  const result = await enrichVisaSponsorshipWithJev(jobs, {
    maxRequests: 2,
    evaluator: evaluator({ choice: "case-by-case:0", confidence: 0.95 })
  });
  assert.deepEqual({ attempted: result.attempted, classified: result.classified, skipped: result.skipped }, {
    attempted: 2, classified: 2, skipped: 1
  });
  assert.equal(result.jobs[2], jobs[2]);
  assert.equal(result.jobs[2].visaSponsorship, undefined);
});

test("batch enrichment excludes empty-passage jobs from the request budget", async () => {
  const invalidDescription = Array.from(
    { length: 25 },
    (_, index) => `Policy ${index}: immigration sponsorship is reviewed for group ${index}.`
  ).join("\n\n");
  const jobs: Job[] = [invalidDescription, "Immigration sponsorship depends on legal review."].map((description, index) => ({
    id: `candidate-${index}`, title: "Endpoint Engineer", company: "Example", location: "Remote",
    workplace: "Remote", postedAt: "2026-09-20", fetchedAt: "2026-09-20", staleAfter: "2026-11-01",
    source: "Test", sourceUrl: `${sourceUrl}/${index}`, attributionLabel: "Test", termsProfile: "public-api",
    description, summary: "Endpoint role", tags: [], matchReasons: [], tools: [], platforms: [],
    roleFamily: "Endpoint Engineering", seniority: "Mid", employmentType: "Full-time"
  }));
  let calls = 0;
  const result = await enrichVisaSponsorshipWithJev(jobs, {
    maxRequests: 1,
    evaluator: async () => {
      calls++;
      return { choice: "case-by-case:0", confidence: 0.95, model: "jev-test" };
    }
  });
  assert.equal(calls, 1);
  assert.deepEqual({ attempted: result.attempted, classified: result.classified, skipped: result.skipped }, {
    attempted: 1, classified: 1, skipped: 0
  });
  assert.equal(result.jobs[0].visaSponsorship, undefined);
  assert.equal(result.jobs[1].visaSponsorship?.status, "case-by-case");
});

test("refresh hands JEV the full source description before display truncation", async () => {
  const evidence = "Qualified applicants may receive employer immigration support after legal review.";
  const job = toEndpointJob({
    id: "full-source", title: "Intune Endpoint Engineer", company: "Example",
    postedAt: "2026-09-20", fetchedAt: new Date("2026-09-20"), source: "Test",
    sourceUrl, attributionLabel: "Test", termsProfile: "public-api",
    description: `${"Manage Intune endpoints. ".repeat(800)}\n\n${evidence}`
  });
  assert.ok(job);
  assert.ok(!job.description?.includes(evidence));
  const result = await enrichVisaSponsorshipWithJev([job], {
    evaluator: async (request) => {
      assert.ok(Object.values(request.state.candidate_passages).some((passage) => passage.includes(evidence)));
      return { choice: "case-by-case:0", confidence: 0.95, model: "jev-test" };
    }
  });
  assert.deepEqual(result.jobs[0].visaSponsorship, {
    status: "case-by-case", evidence, sourceUrl
  });
});
