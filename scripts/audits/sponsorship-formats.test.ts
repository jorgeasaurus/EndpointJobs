import assert from "node:assert/strict";
import test from "node:test";

import type { SponsorshipStatus } from "../../src/lib/visa-sponsorship";
import { normalizeDescription, stripHtml, toEndpointJob } from "../job-refresh/shared";
import { classifyVisaSponsorship } from "../job-refresh/visa-sponsorship";

const sourceUrl = "https://example.com/jobs/endpoint-engineer";
const cases: [string, SponsorshipStatus][] = [
  ["Eligible to work in the United States without company sponsorship", "unavailable"],
  ["Not eligible to work in the United States without company sponsorship", "not-stated"],
  ["Eligible to work in the United States with or without company sponsorship", "not-stated"],
  ["Eligible to work in the United States without company sponsorship preferred", "not-stated"],
  ["Eligible to work in the United States without company sponsorship?", "not-stated"],
  ["GEICO will consider sponsoring a new qualified applicant for employment authorization for this position.", "case-by-case"],
  ["GEICO will not consider sponsoring a new qualified applicant for employment authorization for this position.", "not-stated"],
  ["GEICO will consider sponsoring a new qualified applicant for employment authorization for other positions.", "not-stated"],
  ["GEICO will consider sponsoring a new qualified applicant for employment authorization for this position only after an internal transfer.", "not-stated"],
  ["If GEICO will consider sponsoring a new qualified applicant for employment authorization for this position, contact us.", "not-stated"],
  ["Sponsorship\nVanguard is not offering visa sponsorship for this position.", "unavailable"],
  ["Sponsorship\nVanguard is not offering visa sponsorship for this position unless you already hold a visa.", "not-stated"],
  ["Sponsorship\nVanguard is not offering visa sponsorship for other positions.", "not-stated"],
  ["Sponsorship not required\nVanguard is not offering visa sponsorship for this position.", "not-stated"],
  ["- Manage Intune endpoints\n- Visa sponsorship is available.\n- Support macOS", "available"],
  ["* Manage Intune endpoints\n* Visa sponsorship may be available.\n* Support macOS", "case-by-case"],
  ["- No visa sponsorship.", "unavailable"],
  ["- No visa sponsorship fees are charged to candidates.", "not-stated"],
  ["- No visa sponsorship restrictions apply.", "not-stated"],
  ["Visa sponsorship is available subject to approval.", "case-by-case"],
  ["Visa sponsorship is available for qualified candidates.", "case-by-case"],
  ["Visa sponsorship: Yes", "available"],
  ["Visa sponsorship: No", "unavailable"],
  ["Visa sponsorship: Maybe", "not-stated"],
  ["H-1B sponsorship is available.", "available"],
  ["We do not offer H-1B sponsorship.", "unavailable"],
  ["We are unable to sponsor employment visas.", "unavailable"],
  ["We do not offer visa sponsorship at this time.", "unavailable"],
  ["Visa sponsorship is available\nonly to internal transfers.", "not-stated"],
  ["- Visa sponsorship is available\n  only to internal transfers.", "not-stated"],
  ["Visa sponsorship is available. We do not offer visa sponsorship at this time.", "not-stated"],
  ["- Visa sponsorship: Yes\n- We are unable to sponsor employment visas.", "not-stated"]
];

for (const [description, expected] of cases) {
  test(`listing format ${expected}: ${description}`, () => {
    const result = classifyVisaSponsorship(description, sourceUrl);
    assert.equal(result.status, expected);
    if (expected === "not-stated") {
      assert.deepEqual(result, { status: "not-stated" });
    } else {
      assert.equal(result.sourceUrl, sourceUrl);
      assert.ok(result.evidence && description.replace(/\s+/g, " ").includes(result.evidence));
    }
  });
}

test("refresh retains explicit sponsorship in normalized HTML list items", () => {
  const job = toEndpointJob({
    id: "sponsorship-html-list", title: "Intune Endpoint Engineer", company: "Example",
    source: "Example", sourceUrl, attributionLabel: "Example", termsProfile: "public-api",
    postedAt: "2026-09-20", fetchedAt: new Date("2026-09-20"),
    description: "<h2>Benefits</h2><ul><li>Manage Intune endpoints</li><li>Visa sponsorship is available.</li><li>Support macOS</li></ul>"
  });
  assert.ok(job);
  assert.deepEqual(job.visaSponsorship, {
    status: "available", evidence: "Visa sponsorship is available.", sourceUrl
  });
});

test("HTML list hierarchy survives refresh and stored-description classification", () => {
  for (const restriction of ["Only for internal transfers.", "Not for this position.", "Subject to approval."]) {
    const description = `<p>${"Manage Intune endpoints and maintain device compliance. ".repeat(12)}</p><ul><li>Visa sponsorship is available.<ol><li>${restriction}</li></ol></li></ul>`;
    const job = toEndpointJob({
      id: "nested-list", title: "Intune Endpoint Engineer", company: "Example",
      source: "Example", sourceUrl, attributionLabel: "Example", termsProfile: "public-api",
      postedAt: "2026-09-20", fetchedAt: new Date("2026-09-20"), description
    });
    assert.ok(job?.description);
    assert.equal(job.visaSponsorship?.status, "not-stated");
    assert.ok(job.description.includes(`\n  - ${restriction}`));
    assert.equal(classifyVisaSponsorship(job.description, sourceUrl).status, "not-stated");
  }
});

test("text normalization preserves list depth and remains stable on already-normalized text", () => {
  const html = "<ul><li>Parent<ol><li>Child<ul><li>Grandchild</li></ul></li></ol></li><li>Sibling</li></ul>";
  const text = stripHtml(html);
  assert.ok(text.includes("\n- Parent"));
  assert.ok(text.includes("\n  - Child"));
  assert.ok(text.includes("\n    - Grandchild"));
  assert.ok(text.includes("\n- Sibling"));
  assert.equal(stripHtml(text), text);
  const stored = normalizeDescription(`${"Manage endpoint devices. ".repeat(30)}\n\n${text}`);
  assert.ok(stored?.includes("\n    - Grandchild"));
  assert.equal(normalizeDescription(stored), stored);
});

// Static excerpt from the stored Deloitte MDM Solutions Engineer listing.
const deloitteQualifications = `Qualifications

Required

5+ years of experience in data management / MDM, including significant experience in Life Sciences commercial data
2+ years of hands-on implementation and/or operations experience with Reltio MDM and/or Informatica MDM
2+ years demonstrated knowledge of Life Sciences commercial domains (HCP/HCO, affiliations, territories/alignment, CRM, product hierarchies, account structures)
4+ years experience designing and operating data governance and stewardship models, including KPI definition and reporting
4+ years experience with data integration patterns (batch and streaming), APIs, and data pipelines
4+ years experience with data quality tooling and operational monitoring
Ability to travel up to 50% on average, based on the work you do and the clients and industries/sectors you serve
Limited immigration sponsorship may be available

Preferred

Experience with Veeva CRM and Life Sciences commercial data vendors/ecosystems
Experience with complex affiliation and hierarchy modeling (e.g., time-variant affiliations, multiple hierarchy types)
Experience operating MDM in a product model (roadmaps, SLAs, release trains, adoption)`;

test("unmarked Deloitte qualification list retains its conditional sponsorship assertion", () => {
  assert.deepEqual(classifyVisaSponsorship(deloitteQualifications, sourceUrl), {
    status: "case-by-case", evidence: "Limited immigration sponsorship may be available", sourceUrl
  });
});


test("country abbreviations preserve work authorization and following sponsorship sentences", () => {
  assert.equal(classifyVisaSponsorship("Must be authorized to work in the U.S. without sponsorship.", sourceUrl).status, "unavailable");
  const claim = "We do not sponsor employment visas or other immigration processes to attain or maintain employment eligibility.";
  assert.deepEqual(classifyVisaSponsorship(`Applicants must be authorized to work for ANY employer in the U.S. ${claim}`, sourceUrl), {
    status: "unavailable", evidence: claim, sourceUrl
  });
});

test("an explicit limitation qualifies an offer and both statements remain in the evidence", () => {
  const description = "**Visa sponsorship:** We do sponsor visas! However, we aren't able to successfully sponsor visas for every role and every candidate. But if we make you an offer, we will make every reasonable effort to get you a visa.";
  const result = classifyVisaSponsorship(description, sourceUrl);
  assert.equal(result.status, "case-by-case");
  assert.ok(result.evidence?.includes("We do sponsor visas!"));
  assert.ok(result.evidence?.includes("every role and every candidate."));
  assert.ok(description.includes(result.evidence!));
});

test("unmarked lists reject incomplete negations and wrapped restrictions", () => {
  for (const text of ["Visa sponsorship is available\nonly to internal transfers.", "We do not offer\nVisa sponsorship is available."]) {
    assert.equal(classifyVisaSponsorship(`Required\n\n5+ years experience\n2+ years experience\n${text}`, sourceUrl).status, "not-stated");
  }
});


test("nested list restrictions cannot become unconditional offers", () => {
  for (const restriction of ["Only for internal transfers.", "Not for this position.", "Subject to approval."]) {
    for (const punctuation of ["", "."]) {
      for (const marker of ["-", "*"]) {
        const description = `- Visa sponsorship is available${punctuation}\n  ${marker} ${restriction}`;
        assert.deepEqual(classifyVisaSponsorship(description, sourceUrl), { status: "not-stated" });
      }
    }
  }
  assert.equal(classifyVisaSponsorship("Visa sponsorship is available.\n- Only for internal transfers.", sourceUrl).status, "not-stated");
});

test("blank lines do not erase list hierarchy or conflicting sponsorship evidence", () => {
  for (const description of [
    "- Visa sponsorship is available.\n\n  - Only for internal transfers.",
    "Visa sponsorship is available.\n\n- Requirements\n  - No visa sponsorship.",
    "Visa sponsorship is available.\n\n- Only for internal transfers.",
    "- Visa sponsorship is available.\n\n  Only for internal transfers.",
    "- Visa sponsorship is available.\n  Only for internal transfers."
  ]) {
    assert.deepEqual(classifyVisaSponsorship(description, sourceUrl), { status: "not-stated" });
  }
});
