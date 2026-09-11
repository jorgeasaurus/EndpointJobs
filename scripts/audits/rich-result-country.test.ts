import assert from "node:assert/strict";
import test from "node:test";

import { resolveJobMapLocation } from "../../src/lib/map-location";
import { inferAddressCountry } from "../../src/lib/rich-result-schema";
import { makeJob } from "./shared";

test("ambiguous DE suffix does not override an explicit country in rich results", () => {
  for (const [location, country] of [["Brazil, DE", "BR"], ["Peru, DE", "PE"], ["Spain, DE", "ES"]]) {
    assert.equal(inferAddressCountry(makeJob({ location, mapLocation: undefined })), country);
  }
  assert.equal(inferAddressCountry(makeJob({ location: "Brazil, IN", mapLocation: undefined })), "US");
});

test("Delaware locations retain their map coordinates and US rich-result country", () => {
  const location = "Newark, New Castle County";
  const mapLocation = resolveJobMapLocation(location);
  assert.equal(mapLocation?.label, "Wilmington, DE");
  assert.equal(inferAddressCountry(makeJob({ location, mapLocation })), "US");
  assert.equal(inferAddressCountry(makeJob({ location: "Wilmington, DE", mapLocation: undefined })), "US");
});
