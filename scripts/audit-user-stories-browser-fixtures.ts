import { readFile } from "node:fs/promises";

import {
  filterJobs,
  initialFilterState,
  type FreshnessFilter,
  type RoleFamilyFilter,
  type SeniorityFilter
} from "../src/components/job-board/filter-model";
import { isActiveJob } from "../src/lib/jobs";
import type { Job, JobsFeed } from "../src/types/job";

type LocationMapScenario = {
  job: Job;
  mapLabel: string;
  mappedCount: number;
  query: string;
  totalCount: number;
};

type AdvancedFilterScenario = {
  expectedCompanies: string[];
  freshness: FreshnessFilter;
  resultCount: number;
  roleFamily: Exclude<RoleFamilyFilter, "All">;
  seniority: Exclude<SeniorityFilter, "All">;
};

export async function loadBrowserAuditScenarios() {
  const jobsFeed = JSON.parse(
    await readFile(new URL("../src/data/jobs.json", import.meta.url), "utf8")
  ) as JobsFeed;
  const activeJobs = jobsFeed.jobs.filter((job) => isActiveJob(job));

  return {
    advancedFilterScenario: findAdvancedFilterScenario(activeJobs),
    locationMapScenario: findLocationMapScenario(activeJobs)
  };
}

function findLocationMapScenario(jobs: Job[]): LocationMapScenario {
  const candidates = [{ query: "San Diego", priority: 0 }];

  for (const job of jobs) {
    if (!job.mapLocation || !job.applyUrl) {
      continue;
    }

    addLocationCandidate(candidates, getCityLabel(job.mapLocation.label), 1);
    addLocationCandidate(candidates, getCityLabel(job.location), 2);
    addLocationCandidate(candidates, job.location, 3);
  }

  const uniqueCandidates = Array.from(
    new Map(
      candidates
        .filter((candidate) => candidate.query.includes(" "))
        .map((candidate) => [normalizeFilterText(candidate.query), candidate])
    ).values()
  );
  let best: (LocationMapScenario & { priority: number }) | undefined;

  for (const candidate of uniqueCandidates) {
    const matchingJobs = filterJobs(jobs, {
      ...initialFilterState,
      locationQuery: candidate.query
    });
    const mappedJobs = matchingJobs.filter((job) => job.mapLocation && job.applyUrl);

    if (mappedJobs.length !== 1) {
      continue;
    }

    const [job] = mappedJobs;
    const scenario = {
      job,
      mapLabel: job.mapLocation?.label ?? job.location,
      mappedCount: mappedJobs.length,
      priority: candidate.priority,
      query: candidate.query,
      totalCount: matchingJobs.length
    };

    if (!best || getLocationScenarioScore(scenario) > getLocationScenarioScore(best)) {
      best = scenario;
    }
  }

  if (!best) {
    throw new Error("missing active mapped single-location scenario for browser audit");
  }

  return {
    job: best.job,
    mapLabel: best.mapLabel,
    mappedCount: best.mappedCount,
    query: best.query,
    totalCount: best.totalCount
  };
}

function findAdvancedFilterScenario(jobs: Job[]): AdvancedFilterScenario {
  let best: AdvancedFilterScenario | undefined;

  for (const roleFamily of uniqueValues(jobs.map((job) => job.roleFamily))) {
    for (const seniority of uniqueValues(jobs.map((job) => job.seniority))) {
      for (const freshness of ["7", "14", "30"] satisfies FreshnessFilter[]) {
        const sortedJobs = filterJobs(jobs, {
          ...initialFilterState,
          freshness,
          roleFamily,
          seniority,
          sort: "company"
        });

        if (sortedJobs.length === 0) {
          continue;
        }

        const scenario = {
          expectedCompanies: sortedJobs
            .slice(0, Math.min(6, sortedJobs.length))
            .map((job) => job.company),
          freshness,
          resultCount: sortedJobs.length,
          roleFamily,
          seniority
        };

        if (!best || getAdvancedScenarioScore(scenario) > getAdvancedScenarioScore(best)) {
          best = scenario;
        }
      }
    }
  }

  if (!best) {
    throw new Error("missing active advanced-filter scenario for browser audit");
  }

  return best;
}

function addLocationCandidate(
  candidates: Array<{ query: string; priority: number }>,
  value: string,
  priority: number
) {
  const query = normalizeDisplayText(value);

  if (query) {
    candidates.push({ query, priority });
  }
}

function getLocationScenarioScore(scenario: LocationMapScenario & { priority: number }) {
  return (
    (scenario.query === "San Diego" ? 1000 : 0) +
    (scenario.totalCount === 1 ? 100 : 0) -
    scenario.priority
  );
}

function getAdvancedScenarioScore(scenario: AdvancedFilterScenario) {
  return Math.min(scenario.resultCount, 6) * 10 + Number(scenario.freshness);
}

function uniqueValues<T extends string>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getCityLabel(value: string) {
  return value.split(",")[0] ?? value;
}

function normalizeDisplayText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeFilterText(value: string) {
  return normalizeDisplayText(value).toLowerCase();
}
