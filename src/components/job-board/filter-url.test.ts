import assert from "node:assert/strict";
import test from "node:test";

import { platformOptions, roleFamilyOptions, seniorityOptions, toolOptions } from "@/lib/jobs";
import { initialFilterState, metroAreaOptions, type FilterState } from "./filter-model";
import { filterStateFromLocation, filterStateFromSearchParams, getBoardPathnameForFilters, mergeFilterStateIntoSearchParams } from "./filter-url";

test("all filters roundtrip and preserve unrelated URL parameters", () => {
  const filters: FilterState = {
    query: "endpoint engineer",
    locationQuery: "New York",
    selectedPlatforms: [...platformOptions],
    selectedTools: [...toolOptions],
    selectedMetroAreas: [...metroAreaOptions],
    workplace: "Hybrid",
    salaryOnly: true,
    leadershipOnly: true,
    minimumSalary: "120000",
    seniority: seniorityOptions[0],
    roleFamily: roleFamilyOptions[0],
    freshness: "7",
    sort: "salary"
  };
  const params = mergeFilterStateIntoSearchParams(new URLSearchParams("utm_source=test&remote=1&locations=old"), filters);
  assert.deepEqual(filterStateFromLocation(getBoardPathnameForFilters(filters), params), filters);
  assert.equal(params.get("utm_source"), "test");
  assert.equal(params.has("remote"), false);
  assert.equal(params.has("locations"), false);
});

test("one tool is encoded in the pathname and clear removes all filter parameters", () => {
  const filters = { ...initialFilterState, selectedTools: [toolOptions[0]] };
  const params = mergeFilterStateIntoSearchParams(new URLSearchParams("q=old&tools=old"), filters);
  assert.equal(params.has("tools"), false);
  assert.deepEqual(filterStateFromLocation(getBoardPathnameForFilters(filters), params), filters);
  assert.equal(mergeFilterStateIntoSearchParams(params, initialFilterState).toString(), "");
});

test("invalid scalars fall back and legacy remote respects explicit workplace", () => {
  const params = new URLSearchParams("workplace=invalid&remote=1&salary=yes&leadership=yes&minSalary=9&freshness=3&sort=invalid&family=invalid&seniority=invalid");
  assert.deepEqual(filterStateFromSearchParams(params), initialFilterState);
  params.delete("workplace");
  assert.equal(filterStateFromSearchParams(params).workplace, "Remote");
});

test("URL lists reject unknown values and deduplicate selections", () => {
  const params = new URLSearchParams({
    tools: `${toolOptions[0]}, ${toolOptions[0]},unknown`,
    platforms: `${platformOptions[0]},${platformOptions[0]},unknown`,
    metroAreas: `${metroAreaOptions[0]}|${metroAreaOptions[0]}|unknown`
  });
  const filters = filterStateFromSearchParams(params);
  assert.deepEqual(filters.selectedTools, [toolOptions[0]]);
  assert.deepEqual(filters.selectedPlatforms, [platformOptions[0]]);
  assert.deepEqual(filters.selectedMetroAreas, [metroAreaOptions[0]]);
});
