import assert from "node:assert/strict";
import test from "node:test";

import { getJobJsonLd, serializeJsonLd } from "../../src/app/structured-data";
import { isRichResultEligible, jobPostingAddress } from "../../src/lib/rich-result-schema";
import type { Job } from "../../src/types/job";
import { makeJob } from "./shared";

function address(location: string, addressCountry: string) {
  return jobPostingAddress(location, addressCountry);
}

function posting(job: Job) {
  const graph = getJobJsonLd(job)["@graph"];
  return graph.find((node) => node["@type"] === "JobPosting");
}

test("explicit US states and Swiss cantons become addressRegion", () => {
  assert.deepEqual(address("Memphis, TN", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Memphis",
    addressRegion: "TN",
    addressCountry: "US"
  });
  assert.deepEqual(address("Costa Mesa, California, United States", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Costa Mesa",
    addressRegion: "California",
    addressCountry: "US"
  });
  assert.deepEqual(address("Eysins, Vaud, Switzerland", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Eysins",
    addressRegion: "Vaud",
    addressCountry: "CH"
  });
  assert.deepEqual(address("San Mateo, CA United States", "US"), {
    "@type": "PostalAddress",
    addressLocality: "San Mateo",
    addressRegion: "CA",
    addressCountry: "US"
  });
  assert.deepEqual(address("Brazil, IN", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Brazil",
    addressRegion: "IN",
    addressCountry: "US"
  });
});

test("city and country-only text do not gain an invented region or locality", () => {
  assert.deepEqual(address("Hyderabad, India", "IN"), {
    "@type": "PostalAddress",
    addressLocality: "Hyderabad",
    addressCountry: "IN"
  });
  assert.deepEqual(address("San Francisco", "US"), {
    "@type": "PostalAddress",
    addressLocality: "San Francisco",
    addressCountry: "US"
  });
  assert.deepEqual(address("India", "IN"), {
    "@type": "PostalAddress",
    addressCountry: "IN"
  });
  assert.deepEqual(address("United States", "US"), {
    "@type": "PostalAddress",
    addressCountry: "US"
  });
  assert.deepEqual(address("Switzerland", "CH"), {
    "@type": "PostalAddress",
    addressCountry: "CH"
  });
});

test("dotted country and district abbreviations stay explicit", () => {
  assert.deepEqual(address("Memphis, TN, U.S.", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Memphis",
    addressRegion: "TN",
    addressCountry: "US"
  });
  assert.deepEqual(address("Austin, TX, U.S.A.", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Austin",
    addressRegion: "TX",
    addressCountry: "US"
  });
  assert.deepEqual(address("Washington, D.C.", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Washington",
    addressRegion: "D.C.",
    addressCountry: "US"
  });
  assert.deepEqual(address("Washington, DC", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Washington",
    addressRegion: "DC",
    addressCountry: "US"
  });
  assert.deepEqual(address("U.S.", "US"), {
    "@type": "PostalAddress",
    addressCountry: "US"
  });
});

test("a ZIP or other suffix on DC stays in the original locality", () => {
  for (const location of [
    "Washington, DC 20001",
    "Washington, D.C. 20001",
    "Washington, DC 20001-1234",
    "Washington, D.C. 20",
    "Washington, DC ABC",
    "DC 20001"
  ]) {
    assert.deepEqual(address(location, "US"), {
      "@type": "PostalAddress",
      addressLocality: location,
      addressCountry: "US"
    }, location);
    assert.equal("postalCode" in address(location, "US"), false, location);
    assert.equal("addressRegion" in address(location, "US"), false, location);
  }
});

test("a postal or malformed suffix after a state stays the original text", () => {
  for (const location of [
    "Memphis, TN, US 20001",
    "Austin, TX, U.S. 78701",
    "Austin, TX, USA abc"
  ]) {
    assert.deepEqual(address(location, "US"), {
      "@type": "PostalAddress",
      addressLocality: location,
      addressCountry: "US"
    }, location);
    assert.equal("postalCode" in address(location, "US"), false, location);
    assert.equal("addressRegion" in address(location, "US"), false, location);
  }
});

test("a US place that shares a country name stays in the locality", () => {
  assert.deepEqual(address("Jamaica", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Jamaica",
    addressCountry: "US"
  });
  assert.deepEqual(address("Queens, Jamaica", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Queens, Jamaica",
    addressCountry: "US"
  });
  assert.deepEqual(address("Mexico", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Mexico",
    addressCountry: "US"
  });
  assert.deepEqual(address("Kingston, Jamaica", "JM"), {
    "@type": "PostalAddress",
    addressLocality: "Kingston",
    addressCountry: "JM"
  });
});

test("empty comma parts stay the original text", () => {
  assert.deepEqual(address("Austin,, TX", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Austin,, TX",
    addressCountry: "US"
  });
  assert.deepEqual(address("Austin, TX,", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Austin, TX,",
    addressCountry: "US"
  });
});

test("a shared city and region name stays a locality", () => {
  assert.deepEqual(address("Zürich, Switzerland", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Zürich",
    addressCountry: "CH"
  });
  assert.deepEqual(address("Bern, Switzerland", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Bern",
    addressCountry: "CH"
  });
  assert.deepEqual(address("New York, United States", "US"), {
    "@type": "PostalAddress",
    addressLocality: "New York",
    addressCountry: "US"
  });
  assert.deepEqual(address("California", "US"), {
    "@type": "PostalAddress",
    addressRegion: "California",
    addressCountry: "US"
  });
  assert.deepEqual(address("Vaud", "CH"), {
    "@type": "PostalAddress",
    addressRegion: "Vaud",
    addressCountry: "CH"
  });
  assert.deepEqual(address("Schweiz", "CH"), {
    "@type": "PostalAddress",
    addressCountry: "CH"
  });
  assert.deepEqual(address("Eysins, Vaud, Schweiz", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Eysins",
    addressRegion: "Vaud",
    addressCountry: "CH"
  });
  assert.deepEqual(address("Schwyz, Switzerland", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Schwyz",
    addressCountry: "CH"
  });
  assert.deepEqual(address("Glarus, Switzerland", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Glarus",
    addressCountry: "CH"
  });
  assert.deepEqual(address("Genf", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Genf",
    addressCountry: "CH"
  });
  assert.deepEqual(address("Meyrin, Genf, Switzerland", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Meyrin",
    addressRegion: "Genf",
    addressCountry: "CH"
  });
  assert.deepEqual(address("Bern, Bern-Mittelland", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Bern, Bern-Mittelland",
    addressCountry: "CH"
  });
  assert.deepEqual(address("Zürich, ZH, Switzerland", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Zürich, ZH, Switzerland",
    addressCountry: "CH"
  });
});

test("ambiguous extra commas do not become a region", () => {
  assert.deepEqual(address("Austin, Downtown, TX", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Austin, Downtown, TX",
    addressCountry: "US"
  });
  assert.deepEqual(address("New York, NY", "US"), {
    "@type": "PostalAddress",
    addressLocality: "New York, NY",
    addressCountry: "US"
  });
  assert.deepEqual(address("Luzern, Luzern, Switzerland", "CH"), {
    "@type": "PostalAddress",
    addressLocality: "Luzern, Luzern, Switzerland",
    addressCountry: "CH"
  });
  assert.deepEqual(address("Washington, District of Columbia, United States", "US"), {
    "@type": "PostalAddress",
    addressLocality: "Washington, District of Columbia, United States",
    addressCountry: "US"
  });
});

test("JobPosting omits unknown street, postal code, and salary period", () => {
  const job = makeJob({
    location: "Costa Mesa, California, United States",
    workplace: "Hybrid",
    description: `Endpoint <Engineer> role. ${"Own endpoint platforms and automation. ".repeat(40)}`,
    salary: {
      min: 132000,
      max: 175000,
      currency: "USD",
      currencySource: "source",
      label: "$132k-$175k"
    }
  });
  const serialized = serializeJsonLd(getJobJsonLd(job));
  assert.match(serialized, /"addressLocality":"Costa Mesa"/);
  assert.match(serialized, /"addressRegion":"California"/);
  assert.match(serialized, /"addressCountry":"US"/);
  assert.doesNotMatch(serialized, /streetAddress|postalCode|baseSalary/);
  assert.equal(serialized.includes("\\u003cp>"), true);
  assert.equal(serialized.includes("&lt;Engineer&gt;"), true);
  assert.equal(serialized.includes("<"), false);
});

test("remote and multi-location jobs still omit JobPosting", () => {
  const description = "Complete role details. ".repeat(60);
  const remote = makeJob({
    description,
    location: "United States",
    workplace: "Remote"
  });
  const multi = makeJob({
    description,
    location: "Austin, TX; Seattle, WA",
    workplace: "Hybrid"
  });
  assert.equal(isRichResultEligible(remote), false);
  assert.equal(isRichResultEligible(multi), false);
  assert.equal(posting(remote), undefined);
  assert.equal(posting(multi), undefined);
  assert.doesNotMatch(serializeJsonLd(getJobJsonLd(remote)), /TELECOMMUTE|applicantLocationRequirements/);
});
