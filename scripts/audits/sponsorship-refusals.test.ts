import assert from "node:assert/strict";
import test from "node:test";

import { classifyVisaSponsorship } from "../job-refresh/visa-sponsorship";

const sourceUrl = "https://example.com/jobs/endpoint-engineer";
// Static assertions copied from the stored listings, independent of feed refreshes.
const refusals = [
  ["U.S. Bank", "This position is not eligible for visa sponsorship."],
  ["Raymond James", "This role is not eligible for Work Visa sponsorship, either currently or in the future."],
  ["Vanguard", "Vanguard is not offering visa sponsorship for this position."],
  ["Expel", "We do not currently sponsor immigration visas."],
  ["Hike2", "Hike2 cannot sponsor work authorizations or visas now or in the future."],
  ["Philips", "The company will not consider candidates who require sponsorship for a work-authorized visa, now or in the future."],
  ["PNC", "PNC will not provide sponsorship for employment visas or participate in STEM OPT for this position."],
  ["MBTA", "The MBTA does not have an employer work sponsorship program."],
  ["Colorado School of Mines", "Visa sponsorship is not available for this position now nor in the future."],
  ["HelloKindred", "Candidates must be legally authorized to live and work in the country where the position is based, without requiring employer sponsorship."]
] as const;

for (const [employer, description] of refusals) {
  test(`real listing sponsorship refusal: ${employer}`, () => {
    assert.deepEqual(classifyVisaSponsorship(description, sourceUrl), {
      status: "unavailable", evidence: description, sourceUrl
    });
  });
}

for (const description of [
  "Is this position eligible for visa sponsorship?",
  "We provide information about sponsorship for employment visas.",
  "No immigration sponsorship fees are charged to candidates."
]) {
  test(`sponsorship vocabulary without an employer claim: ${description}`, () => {
    assert.deepEqual(classifyVisaSponsorship(description, sourceUrl), { status: "not-stated" });
  });
}
