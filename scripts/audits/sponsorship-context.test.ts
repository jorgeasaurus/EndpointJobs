import assert from "node:assert/strict";
import test from "node:test";
import { classifyVisaSponsorshipWithJev } from "../job-refresh/jev-sponsorship";
import { classifyVisaSponsorship } from "../job-refresh/visa-sponsorship";

const sourceUrl = "https://example.com/jobs/endpoint-engineer";
for (const description of [
  "Visa sponsorship may be available. However, this does not apply to this position.",
  "Visa sponsorship may be available.\n\nOnly for internal transfers.",
  "Visa sponsorship is available. Only for internal transfers.",
  "Visa sponsorship is available. However, this does not apply to this position.",
  "Visa sponsorship is available.\n\nOnly for internal transfers.",
  "Visa sponsorship is available.\n\nHowever, this does not apply to this position.",
  "Visa sponsorship is available. This offer does not apply to this position.",
  "Visa sponsorship is available. Not for this position.",
  "Visa sponsorship is available. Unavailable for this job.",
  "No visa sponsorship. Except for internal transfers.",
  "No visa sponsorship.\n\nUnless the candidate already holds an H-1B visa.",
  "Is this role eligible for visa sponsorship? Yes. Only for internal transfers."
]) {
  test(`detached qualification remains unknown: ${description}`, async () => {
    assert.deepEqual(classifyVisaSponsorship(description, sourceUrl), { status: "not-stated" });
    let called = false;
    const result = await classifyVisaSponsorshipWithJev({ description, sourceUrl }, {
      evaluator: async () => {
        called = true;
        return { choice: "available:0", confidence: 0.99, model: "jev-test" };
      }
    });
    assert.equal(called, false);
    assert.deepEqual(result.sponsorship, { status: "not-stated" });
  });
}

for (const qualifier of [
  "Only for internal transfers.",
  "However, this does not apply to this position.",
  "Unless the candidate already holds an H-1B visa.",
  "Eligibility is limited to internal transfers."
]) {
  test(`JEV evidence retains a detached qualifier: ${qualifier}`, async () => {
    const claim = "Qualified applicants may receive employer immigration support after legal review.";
    const description = `${claim}\n\n${qualifier}`;
    const result = await classifyVisaSponsorshipWithJev({ description, sourceUrl }, {
      evaluator: async (request) => {
        assert.equal(request.state.candidate_passages.p0, description);
        return { choice: "case-by-case:0", confidence: 0.95, model: "jev-test" };
      }
    });
    assert.deepEqual(result.sponsorship, {
      status: "case-by-case",
      evidence: description,
      sourceUrl
    });
  });
}

test("recognized Anthropic limitation remains conditional with offer and limitation evidence", () => {
  const evidence = "Visa sponsorship: We do sponsor visas! However, we aren't able to successfully sponsor visas for every role and every candidate.";
  const description = `${evidence} But if we make you an offer, we will make every reasonable effort to get you a visa.`;
  assert.deepEqual(classifyVisaSponsorship(description, sourceUrl), {
    status: "case-by-case", evidence: description, sourceUrl
  });
});

test("unrelated following statement does not invalidate an explicit offer", () => {
  assert.deepEqual(classifyVisaSponsorship("Visa sponsorship is available. We offer health insurance.", sourceUrl), {
    status: "available", evidence: "Visa sponsorship is available.", sourceUrl
  });
});

test("eligibility questions accept role, position, and job wording", () => {
  for (const subject of ["role", "position", "job"]) {
    assert.deepEqual(classifyVisaSponsorship(
      `Is this ${subject} eligible for visa sponsorship? No.`, sourceUrl
    ), {
      status: "unavailable",
      evidence: `Is this ${subject} eligible for visa sponsorship? No.`,
      sourceUrl
    });
  }
});


test("complete conditional visa assistance assertion retains its legal-assistance suffix", () => {
  const description = "But if we make you an offer, we will make every reasonable effort to get you a visa, and we retain an immigration lawyer to help with this.";
  assert.deepEqual(classifyVisaSponsorship(description, sourceUrl), {
    status: "case-by-case", evidence: description, sourceUrl
  });
  assert.deepEqual(classifyVisaSponsorship(`${description.slice(0, -1)} for other positions.`, sourceUrl), {
    status: "not-stated"
  });
});
