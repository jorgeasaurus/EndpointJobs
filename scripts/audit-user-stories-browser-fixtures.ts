import { readFile } from "node:fs/promises";

import {
  filterJobs,
  initialFilterState,
  type FreshnessFilter,
  type MinimumSalaryFilter,
  type RoleFamilyFilter,
  type SeniorityFilter
} from "../src/components/job-board/filter-model";
import { getExpandedDescriptionParagraphs, isActiveJob } from "../src/lib/jobs";
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

type DescriptionScenario = {
  query: string;
  title: string;
};

type MinimumSalaryScenario = {
  resultCount: number;
  threshold: Exclude<MinimumSalaryFilter, "Any">;
};

export async function loadBrowserAuditScenarios() {
  const jobsFeed = JSON.parse(
    await readFile(new URL("../src/data/jobs.json", import.meta.url), "utf8")
  ) as JobsFeed;
  const activeJobs = jobsFeed.jobs.filter((job) => isActiveJob(job));

  return {
    advancedFilterScenario: findAdvancedFilterScenario(activeJobs),
    descriptionScenario: findDescriptionScenario(activeJobs),
    locationMapScenario: findLocationMapScenario(activeJobs),
    minimumSalaryScenario: findMinimumSalaryScenario(activeJobs)
  };
}

function findMinimumSalaryScenario(jobs: Job[]): MinimumSalaryScenario {
  const thresholds = ["200000", "180000", "150000", "120000", "100000", "80000"] satisfies Array<Exclude<MinimumSalaryFilter, "Any">>;

  for (const threshold of thresholds) {
    const matchingJobs = filterJobs(jobs, {
      ...initialFilterState,
      minimumSalary: threshold
    });

    if (matchingJobs.length > 0 && matchingJobs.length < jobs.length) {
      return { resultCount: matchingJobs.length, threshold };
    }
  }

  throw new Error("missing minimum-salary browser scenario");
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

function findDescriptionScenario(jobs: Job[]): DescriptionScenario {
  let best:
    | (DescriptionScenario & {
        rank: number;
        resultCount: number;
      })
    | undefined;

  for (const job of jobs) {
    if (getExpandedDescriptionParagraphs(job).length === 0) {
      continue;
    }

    const matchingJobs = filterJobs(jobs, {
      ...initialFilterState,
      query: job.title
    });
    const rank = matchingJobs.findIndex((candidate) => candidate.id === job.id);

    if (rank < 0 || rank >= 20) {
      continue;
    }

    const scenario = {
      query: job.title,
      rank,
      resultCount: matchingJobs.length,
      title: job.title
    };

    if (!best || getDescriptionScenarioScore(scenario) > getDescriptionScenarioScore(best)) {
      best = scenario;
    }
  }

  if (!best) {
    throw new Error("missing active expandable-description scenario for browser audit");
  }

  return {
    query: best.query,
    title: best.title
  };
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

function getDescriptionScenarioScore(
  scenario: DescriptionScenario & { rank: number; resultCount: number }
) {
  return (20 - scenario.rank) * 10 - scenario.resultCount;
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
