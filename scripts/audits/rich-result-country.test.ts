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
  for (const delawareCity of ["Dover, DE", "Newark, DE", "Wilmington, DE", "New Castle, DE"]) {
    assert.equal(inferAddressCountry(makeJob({ location: delawareCity, mapLocation: undefined })), "US");
  }
});

test("German DE suffixes are not labeled as Delaware", () => {
  assert.equal(inferAddressCountry(makeJob({ location: "Berlin, DE", mapLocation: undefined })), "DE");
  assert.equal(inferAddressCountry(makeJob({ location: "Berlin, Germany", mapLocation: undefined })), "DE");
  assert.equal(inferAddressCountry(makeJob({ location: "Munich, DE", mapLocation: undefined })), "DE");
  assert.equal(inferAddressCountry(makeJob({ location: "Dresden, DE", mapLocation: undefined })), "DE");
  assert.equal(inferAddressCountry(makeJob({ location: "Leipzig, DE", mapLocation: undefined })), "DE");
  assert.equal(inferAddressCountry(makeJob({ location: "Bremen, DE", mapLocation: undefined })), "DE");
  assert.equal(
    inferAddressCountry(
      makeJob({
        location: "Campus, DE",
        mapLocation: { label: "Dresden, Germany", latitude: 51.0504, longitude: 13.7373 }
      })
    ),
    "DE"
  );
  assert.equal(inferAddressCountry(makeJob({ location: "Wilmington, DE", mapLocation: undefined })), "US");
  assert.equal(inferAddressCountry(makeJob({ location: "Lewes, DE", mapLocation: undefined })), "US");
  assert.equal(inferAddressCountry(makeJob({ location: "Rue de la Paix, Paris", mapLocation: undefined })), undefined);
});
