import assert from "node:assert/strict";
import test from "node:test";

import { initialFilterState } from "../../src/components/job-board/filter-model";
import { queryBoardPage } from "../../src/lib/board-page";
import { isLeadershipJob } from "../../src/lib/job-filters";
import { hasListedSalary } from "../../src/lib/shown-salary";
import { getJobWorkplace } from "../../src/lib/workplace";
import type { Job, JobsFeed } from "../../src/types/job";
import { makeJob } from "./shared";

import {
  boardStatPercent,
  measureBoardStats,
  topBoardLocationLimit
} from "../../src/lib/board-stats";

function statJob(id: string, overrides: Partial<Job> = {}): Job {
  return makeJob({
    id,
    company: `Company ${id}`,
    title: overrides.title ?? `Endpoint Engineer ${id}`,
    sourceUrl: `https://example.com/jobs/${id}`,
    applyUrl: `https://example.com/jobs/${id}/apply`,
    tools: [],
    seniority: "Mid",
    workplace: "On-site",
    location: "Remote",
    salary: undefined,
    mapLocation: undefined,
    ...overrides
  });
}

function feedOf(jobs: Job[]): JobsFeed {
  return {
    updatedAt: "2026-10-31T00:00:00.000Z",
    source: { name: "Audit", url: "https://example.com" },
    jobs
  };
}

test("board stat percent is the rounded share of the current total", () => {
  assert.equal(boardStatPercent(1, 3), 33);
  assert.equal(boardStatPercent(2, 4), 50);
  assert.equal(boardStatPercent(0, 0), 0);
  assert.equal(boardStatPercent(5, -1), 0);
});

test("board stats count leadership from the existing title classifier", () => {
  const jobs = [
    statJob("director", { title: "Director of Endpoint Engineering", seniority: "Manager" }),
    statJob("manager", { title: "Endpoint Engineering Manager", seniority: "Senior" }),
    statJob("lead", { title: "Endpoint Team Lead", seniority: "Mid" }),
    statJob("tool-manager", { title: "Microsoft Endpoint Manager Engineer", seniority: "Senior" }),
    statJob("configmgr", { title: "Configuration Manager", seniority: "Mid" }),
    statJob("ic", { title: "Senior Endpoint Engineer", seniority: "Senior" })
  ];
  const stats = measureBoardStats(jobs);

  assert.equal(stats.leadershipJobsCount, jobs.filter(isLeadershipJob).length);
  assert.equal(stats.leadershipJobsCount, 3);
  assert.equal(isLeadershipJob(jobs[3]), false);
  assert.equal(isLeadershipJob(jobs[4]), false);
});

test("board stats bucket every job into the existing seniority ladder", () => {
  const jobs = [
    statJob("a", { seniority: "Associate" }),
    statJob("b", { seniority: "Senior" }),
    statJob("c", { seniority: "Senior" }),
    statJob("d", { seniority: "Lead" }),
    statJob("e", { seniority: "Manager" }),
    statJob("f", { seniority: "Staff" })
  ];
  const stats = measureBoardStats(jobs);
  const total = Object.values(stats.seniorityCounts).reduce((sum, count) => sum + count, 0);

  assert.equal(total, jobs.length);
  assert.deepEqual(stats.seniorityCounts, {
    Associate: 1,
    Mid: 0,
    Senior: 2,
    Staff: 1,
    Lead: 1,
    Manager: 1
  });
});

test("board stats rank the top metro areas with the existing matcher", () => {
  const jobs = [
    ...Array.from({ length: 5 }, (_, index) => statJob(`sea-${index}`, { location: "Seattle, WA" })),
    ...Array.from({ length: 4 }, (_, index) => statJob(`aus-${index}`, { location: "Austin, TX" })),
    ...Array.from({ length: 3 }, (_, index) => statJob(`lon-${index}`, { location: "London, UK" })),
    ...Array.from({ length: 2 }, (_, index) => statJob(`ber-${index}`, { location: "Berlin, Germany" })),
    ...Array.from({ length: 2 }, (_, index) => statJob(`chi-${index}`, { location: "Chicago, IL" })),
    statJob("den", { location: "Denver, CO" }),
    statJob("country", { location: "United States", workplace: "Remote" }),
    statJob("overlap", { location: "Arlington, VA / Washington, DC" })
  ];
  const stats = measureBoardStats(jobs);

  assert.equal(topBoardLocationLimit, 5);
  assert.deepEqual(
    stats.topLocations.map((location) => location.metroArea),
    ["Seattle, WA", "Austin, TX", "London, UK", "Berlin, Germany", "Chicago, IL"]
  );
  assert.deepEqual(stats.topLocations.map((location) => location.count), [5, 4, 3, 2, 2]);

  const costaRica = statJob("cr", { location: "San José, Costa Rica" });
  const california = statJob("sj", { location: "San Jose, CA" });
  const disambiguated = measureBoardStats([costaRica, california]);
  assert.deepEqual(
    disambiguated.topLocations.map((location) => [location.metroArea, location.count]),
    [["San Jose, CA", 1], ["San José, Costa Rica", 1]]
  );

  const overlap = measureBoardStats([statJob("both", { location: "Arlington, VA / Washington, DC" })]);
  assert.deepEqual(
    overlap.topLocations.map((location) => location.metroArea).sort(),
    ["Northern Virginia", "Washington, DC"]
  );
});

test("board stats count a job toward every tagged tool", () => {
  const jobs = [
    statJob("one", { tools: ["Intune", "Jamf"] }),
    statJob("two", { tools: ["Intune"] }),
    statJob("three", { tools: ["Intune"] }),
    statJob("four", { tools: ["Jamf"] }),
    statJob("five", { tools: ["SCCM"] }),
    statJob("six", { tools: ["Kandji"] }),
    statJob("none", { tools: [] })
  ];
  const stats = measureBoardStats(jobs);

  assert.deepEqual(stats.toolCounts, [
    { tool: "Intune", count: 3 },
    { tool: "Jamf", count: 2 },
    { tool: "Kandji", count: 1 },
    { tool: "SCCM", count: 1 }
  ]);
  assert.deepEqual(
    measureBoardStats([statJob("dup", { tools: ["Intune", "Intune"] })]).toolCounts,
    [{ tool: "Intune", count: 1 }]
  );
});

test("board stats keep mapped, remote, and salary counts on the same jobs", () => {
  const jobs = [
    statJob("mapped-remote", {
      workplace: "Remote",
      mapLocation: { label: "Seattle, WA", latitude: 47.6, longitude: -122.3 },
      salary: { min: 100000, max: 120000, currency: "USD", label: "$100k-$120k" }
    }),
    statJob("hybrid", { workplace: "Hybrid", location: "Austin, TX" }),
    statJob("onsite-text", {
      workplace: "Remote",
      location: "Seattle, WA",
      summary: "This position is not a remote role."
    }),
    statJob("unmapped", { workplace: "On-site", location: "Chicago, IL" })
  ];
  const stats = measureBoardStats(jobs);

  assert.equal(stats.mappedJobsCount, jobs.filter((job) => job.mapLocation).length);
  assert.equal(stats.remoteJobsCount, jobs.filter((job) => {
    const workplace = getJobWorkplace(job);
    return workplace === "Remote" || workplace === "Hybrid";
  }).length);
  assert.equal(stats.salaryJobsCount, jobs.filter(hasListedSalary).length);
  assert.equal(stats.mappedJobsCount, 1);
  assert.equal(stats.remoteJobsCount, 2);
  assert.equal(stats.salaryJobsCount, 1);
});

test("empty boards report zero shares and no breakdown rows", () => {
  const stats = measureBoardStats([]);

  assert.equal(stats.mappedJobsCount, 0);
  assert.equal(stats.remoteJobsCount, 0);
  assert.equal(stats.salaryJobsCount, 0);
  assert.equal(stats.leadershipJobsCount, 0);
  assert.deepEqual(stats.topLocations, []);
  assert.deepEqual(stats.toolCounts, []);
  assert.equal(Object.values(stats.seniorityCounts).every((count) => count === 0), true);
});

test("board page metrics follow the filtered visible jobs", () => {
  const jobs = [
    statJob("lead", {
      title: "Director of Endpoint Engineering",
      seniority: "Manager",
      tools: ["Intune"],
      location: "Seattle, WA",
      workplace: "Hybrid"
    }),
    statJob("ic", {
      title: "Endpoint Engineer",
      seniority: "Mid",
      tools: ["Jamf"],
      location: "Austin, TX",
      workplace: "On-site"
    })
  ];
  const page = queryBoardPage(feedOf(jobs), { ...initialFilterState, seniority: "Manager" }, 1);

  assert.equal(page.total, 1);
  assert.equal(page.metrics.leadershipJobsCount, 1);
  assert.equal(page.metrics.seniorityCounts.Manager, 1);
  assert.equal(page.metrics.seniorityCounts.Mid, 0);
  assert.deepEqual(page.metrics.toolCounts, [{ tool: "Intune", count: 1 }]);
  assert.deepEqual(page.metrics.topLocations, [{ metroArea: "Seattle, WA", count: 1 }]);
  assert.equal(page.metrics.remoteJobsCount, 1);
});
