import assert from "node:assert/strict";
import test from "node:test";
import type { SponsorshipStatus } from "../../src/lib/visa-sponsorship";
import { classifyVisaSponsorship } from "../job-refresh/visa-sponsorship";
import { toEndpointJob } from "../job-refresh/shared";

const sourceUrl = "https://example.com/jobs/endpoint-engineer";
const cases: [string, SponsorshipStatus][] = [
  ["We provide visa sponsorship.", "available"],
  ["Visa sponsorship is available.", "available"],
  ["We can sponsor work visas.", "available"],
  ["Visa sponsorship may be available.", "case-by-case"],
  ["We may offer visa sponsorship.", "case-by-case"],
  ["Visa sponsorship is offered on a case-by-case basis.", "case-by-case"],
  ["No visa sponsorship is available.", "unavailable"],
  ["Visa sponsorship is not available.", "unavailable"],
  ["We do not provide visa sponsorship.", "unavailable"],
  ["We do not sponsor employment visas.", "unavailable"],
  ["We are not currently or in foreseeable future sponsoring employment visas.", "unavailable"],
  ["Is role eligible for Immigration Sponsorship? No.", "unavailable"],
  ["We are unable to offer employment sponsorship.", "unavailable"],
  ["Must be authorized to work without sponsorship now or in the future.", "unavailable"],
  ["Applicants must not require visa sponsorship.", "unavailable"],
  ["Remote worldwide. International applicants welcome.", "not-stated"],
  ["Must have work authorization.", "not-stated"],
  ["We provide conference sponsorship.", "not-stated"],
  ["We can sponsor candidates.", "not-stated"],
  ["The event runs without sponsorship.", "not-stated"],
  ["Do you require visa sponsorship?", "not-stated"],
  ["If visa sponsorship is available, ask the recruiter.", "not-stated"],
  ["Visa sponsorship is available only for some roles.", "not-stated"],
  ["Visa sponsorship is not guaranteed.", "not-stated"],
  ["No visa sponsorship required.", "not-stated"],
  ["We previously offered visa sponsorship.", "not-stated"],
  ["No visa sponsorship except for eligible transfers.", "not-stated"],
  ["Visa sponsorship is available. We do not provide visa sponsorship.", "not-stated"],
  ["Visa sponsorship is available, but no visa sponsorship for this role.", "not-stated"],
  ["Visa sponsorship may be available. Visa sponsorship is not available.", "not-stated"],
  ["Visa sponsorship may be available, but we cannot sponsor work visas.", "not-stated"],
  ["Visa sponsorship is available for other roles but is unavailable for this position.", "not-stated"],
  ["Visa sponsorship may be available for other roles but is unavailable for this position.", "not-stated"],
  ["Visa sponsorship may be available but is unavailable for this position.", "not-stated"],
  ["Visa sponsorship is available but is unavailable for this position.", "not-stated"],
  ["Applicants with or without visa sponsorship are welcome.", "not-stated"],
  ["Visa sponsorship is available for other roles.", "not-stated"],
  ["Visa sponsorship may be available for other roles.", "not-stated"],
  ["Visa sponsorship is available in general.", "not-stated"],
  ["We generally provide visa sponsorship.", "not-stated"],
  ["We used to provide visa sponsorship.", "not-stated"],
  ["In the past, visa sponsorship was available.", "not-stated"],
  ["Historically, visa sponsorship is available.", "not-stated"],
  ["We provide visa sponsorship information.", "not-stated"],
  ["No visa sponsorship fees are charged to candidates.", "not-stated"],
  ["No visa sponsorship restrictions apply.", "not-stated"],
  ["Visa sponsorship is available upon approval.", "case-by-case"],
  ["Visa sponsorship is available at other employers.", "not-stated"],
  ["Is this role eligible for visa sponsorship? No experience required.", "not-stated"],
  ["Is this role eligible for visa sponsorship? No", "unavailable"],
  ["No visa sponsorship.", "unavailable"],
  ["We do not sponsor employment visas or other immigration processes to attain or maintain employment eligibility.", "unavailable"],
  ["Please note that we will not sponsor applicants for work visas for this position.", "unavailable"],
  ["Guardian is not currently or in the foreseeable future sponsoring employment visas.", "unavailable"],
  ["Regions will not sponsor applicants for work visas for this position at this time.", "unavailable"],
  ["At this time, we are unable to offer visa sponsorship for this position.", "unavailable"],
  ["Infosys is unable to provide immigration sponsorship for this role now or in the future.", "unavailable"],
  ["Limited immigration sponsorship may be available", "case-by-case"],
  ["Visa Sponsorship: Please note, we are unable to provide visa sponsorship for the position offered.", "unavailable"],
  ["Visa sponsorship is available for this role.", "available"],
  ["Visa sponsorship is available\nonly to internal transfers.", "not-stated"],
  ["We do not offer\nvisa sponsorship available.", "not-stated"],
  ["We provide\nvisa sponsorship.", "available"],
  ["Is this role eligible for visa sponsorship?\nNo", "unavailable"],
  ["Visa sponsorship is available.\nWe do not provide visa sponsorship.", "not-stated"],
  ["", "not-stated"]
];

for (const [description, expected] of cases) {
  test(`sponsorship ${expected}: ${description || "empty description"}`, () => {
    const result = classifyVisaSponsorship(description, sourceUrl);
    assert.equal(result.status, expected);
    if (expected === "not-stated") assert.deepEqual(result, { status: "not-stated" });
    else {
      assert.equal(result.sourceUrl, sourceUrl);
      assert.ok(result.evidence && description.replace(/\s+/g, " ").includes(result.evidence));
    }
  });
}

test("refresh classifies full HTML description before display truncation", () => {
  const job = toEndpointJob({
    id: "sponsorship-audit", title: "Intune Endpoint Engineer", company: "Example",
    source: "Example", sourceUrl, attributionLabel: "Example", termsProfile: "public-api",
    postedAt: "2026-09-20", fetchedAt: new Date("2026-09-20"),
    description: `<p>${"Manage Intune endpoints. ".repeat(1000)}</p><p>We provide visa sponsorship.</p>`
  });
  assert.ok(job);
  assert.ok(!job.description?.includes("visa sponsorship"));
  assert.deepEqual(job.visaSponsorship, {
    status: "available", evidence: "We provide visa sponsorship.", sourceUrl
  });
});


test("adjacent provider sentences retain only the complete sponsorship assertion as evidence", () => {
  const statement = "Regions will not sponsor applicants for work visas for this position at this time.";
  assert.deepEqual(classifyVisaSponsorship(`Manage macOS devices.${statement}Join our team.`, sourceUrl), {
    status: "unavailable", evidence: statement, sourceUrl
  });
});
