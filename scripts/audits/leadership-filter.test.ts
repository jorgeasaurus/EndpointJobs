import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  filterJobs,
  isLeadershipJob,
  type JobFilters
} from "../../src/lib/job-filters";
import type { Job, Seniority } from "../../src/types/job";
import {
  filterReducer,
  initialFilterState
} from "../../src/components/job-board/filter-model";
import { inferSeniority } from "../job-refresh/shared";
import { getActiveFilterItems } from "../../src/components/job-board/active-filters";
import {
  filterStateFromSearchParams,
  mergeFilterStateIntoSearchParams
} from "../../src/components/job-board/filter-url";
import { queryJobs } from "../../src/lib/jobs-api";

function job(title: string, seniority: Seniority): Job {
  return {
    id: title.toLowerCase().replace(/\W+/g, "-"),
    title,
    company: "Example Company",
    location: "Remote",
    workplace: "Remote",
    postedAt: "2026-07-15T00:00:00.000Z",
    fetchedAt: "2026-07-15T00:00:00.000Z",
    staleAfter: "2026-08-29T00:00:00.000Z",
    source: "Test",
    sourceUrl: "https://example.com/jobs/1",
    attributionLabel: "Test",
    termsProfile: "seed",
    summary: "Endpoint role",
    tags: [],
    matchReasons: ["Endpoint role"],
    tools: [],
    platforms: [],
    roleFamily: "Endpoint Engineering",
    seniority,
    employmentType: "Full-time"
  };
}

test("leadership classification includes organizational and technical leaders without manager-product false positives", () => {
  const leadershipTitles: Array<[string, Seniority]> = [
    ["Manager, Desktop Engineering", "Manager"],
    ["Director of Endpoint Engineering", "Mid"],
    ["Head of Digital Workplace", "Senior"],
    ["VP, End User Technology", "Mid"],
    ["Chief Information Officer", "Mid"],
    ["CIO, Workplace Technology", "Mid"],
    ["SVP, End User Technology", "Mid"],
    ["Endpoint Manager", "Manager"],
    ["Global Lead, Desktop Engineering", "Lead"]
  ];
  const individualContributorTitles: Array<[string, Seniority]> = [
    ["Microsoft Configuration Manager Engineer", "Manager"],
    ["Product Manager, Endpoint Security", "Manager"],
    ["Product Senior Manager, Endpoint Security", "Manager"],
    ["Endpoint Policy Manager", "Manager"],
    ["Staff Endpoint Engineer", "Staff"]
  ];

  assert.deepEqual(
    leadershipTitles.map(([title, seniority]) => isLeadershipJob(job(title, seniority))),
    leadershipTitles.map(() => true)
  );
  assert.deepEqual(
    individualContributorTitles.map(([title, seniority]) => isLeadershipJob(job(title, seniority))),
    individualContributorTitles.map(() => false)
  );
});

test("leadership classification does not rewrite seniority", () => {
  assert.equal(inferSeniority("director endpoint engineering"), "Mid");
  assert.equal(inferSeniority("head of digital workplace"), "Mid");
  assert.equal(
    inferSeniority("microsoft configuration manager engineer"),
    "Manager"
  );
  assert.equal(inferSeniority("product manager endpoint security"), "Manager");
});

test("leadership filtering returns leadership roles only", () => {
  const jobs = [
    job("Manager, Desktop Engineering", "Manager"),
    job("Global Lead, Desktop Engineering", "Lead"),
    job("Staff Endpoint Engineer", "Staff"),
    job("Product Manager, Endpoint Security", "Manager")
  ];
  const filters: JobFilters = {
    query: "",
    locationQuery: "",
    selectedPlatforms: [],
    selectedTools: [],
    selectedMetroAreas: [],
    workplace: "Any",
    salaryOnly: false,
    leadershipOnly: true,
    minimumSalary: "Any",
    seniority: "All",
    roleFamily: "All",
    freshness: "Any",
    sort: "newest"
  };

  assert.deepEqual(
    filterJobs(jobs, filters).map(({ title }) => title),
    ["Manager, Desktop Engineering", "Global Lead, Desktop Engineering"]
  );
});

test("leadership and exact seniority compose", () => {
  const senior = filterReducer(initialFilterState, {
    type: "setSeniority",
    value: "Senior"
  });
  const leadership = filterReducer(senior, { type: "toggleLeadershipOnly" });
  const manager = filterReducer(leadership, {
    type: "setSeniority",
    value: "Manager"
  });

  assert.equal(leadership.leadershipOnly, true);
  assert.equal(leadership.seniority, "Senior");
  assert.equal(manager.leadershipOnly, true);
  assert.equal(manager.seniority, "Manager");
});

test("leadership URLs hydrate, serialize, and expose a removable chip", () => {
  const hydrated = filterStateFromSearchParams(
    new URLSearchParams("leadership=1&seniority=Senior")
  );
  const serialized = mergeFilterStateIntoSearchParams(
    new URLSearchParams("page=2"),
    hydrated
  );
  const leadershipChip = getActiveFilterItems(hydrated).find(
    ({ id }) => id === "leadership"
  );

  assert.equal(hydrated.leadershipOnly, true);
  assert.equal(hydrated.seniority, "Senior");
  assert.equal(serialized.get("leadership"), "1");
  assert.equal(serialized.get("seniority"), "Senior");
  assert.equal(serialized.get("page"), "2");
  assert.deepEqual(leadershipChip, {
    clearAction: { type: "toggleLeadershipOnly" },
    id: "leadership",
    label: "Leadership"
  });
});

test("jobs API exposes leadership filtering through leadership=1", () => {
  const feed = {
    updatedAt: "2026-07-15T00:00:00.000Z",
    source: { name: "Test", url: "https://example.com/feed" },
    jobs: [
      job("Manager, Desktop Engineering", "Manager"),
      job("Global Lead, Desktop Engineering", "Lead"),
      job("Staff Endpoint Engineer", "Staff")
    ]
  };
  const result = queryJobs(
    feed,
    new URLSearchParams("leadership=1&limit=100"),
    new Date("2026-07-16T00:00:00.000Z")
  );
  const invalid = queryJobs(
    feed,
    new URLSearchParams("leadership=0"),
    new Date("2026-07-16T00:00:00.000Z")
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(
      result.body.data.map(({ title }) => title),
      ["Manager, Desktop Engineering", "Global Lead, Desktop Engineering"]
    );
    assert.equal(result.body.filters.leadership, true);
  }
  assert.equal(invalid.ok, false);
});

test("OpenAPI documents the leadership query and applied filter", async () => {
  const specification = JSON.parse(
    await readFile("public/openapi.json", "utf8")
  );
  const parameterReferences = specification.paths["/api/jobs"].get.parameters;

  assert.ok(specification.components.parameters.Leadership);
  assert.ok(
    parameterReferences.some(
      (parameter: { $ref?: string }) =>
        parameter.$ref === "#/components/parameters/Leadership"
    )
  );
  assert.equal(
    specification.components.schemas.Filters.properties.leadership.type,
    "boolean"
  );
  assert.ok(
    specification.components.schemas.Filters.required.includes("leadership")
  );
});
