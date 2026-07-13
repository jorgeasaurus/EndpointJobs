import { getActiveFilterItems } from "../../src/components/job-board/active-filters";
import {
  filterJobs,
  filterReducer,
  initialFilterState
} from "../../src/components/job-board/filter-model";
import type { Job } from "../../src/types/job";

type RunAudit = (
  id: string,
  detail: string,
  audit: () => Promise<void> | void
) => Promise<void>;

export async function auditMinimumSalaryData(run: RunAudit) {
  await run("FEAT-074", "Minimum salary keeps ranges that can meet the selected floor", () => {
    const jobs = [
      makeJob({
        id: "above-usd-boundary",
        postedAt: "2026-07-12T00:00:00.000Z",
        salary: { min: 150000, max: 190000, currency: "USD", label: "$150k-$190k" }
      }),
      makeJob({
        id: "exact-usd-boundary",
        postedAt: "2026-07-11T00:00:00.000Z",
        salary: { min: 160000, max: 180000, currency: "USD", label: "$160k-$180k" }
      }),
      makeJob({
        id: "single-usd-boundary",
        postedAt: "2026-07-10T00:00:00.000Z",
        salary: { min: 180000, currency: "USD", label: "$180k" }
      }),
      makeJob({ id: "missing-salary", postedAt: "2026-07-09T00:00:00.000Z" }),
      makeJob({
        id: "non-usd-above-boundary",
        postedAt: "2026-07-08T00:00:00.000Z",
        salary: { min: 250000, max: 300000, currency: "EUR", label: "EUR 250k-300k" }
      })
    ];

    assertIds(
      filterJobs(jobs, { ...initialFilterState, minimumSalary: "180000" }),
      ["above-usd-boundary", "exact-usd-boundary", "single-usd-boundary"]
    );
    assertEqual(
      getActiveFilterItems({ ...initialFilterState, minimumSalary: "180000" })[0]?.label,
      "Minimum: $180k+",
      "minimum salary chip"
    );
    assertEqual(
      filterReducer(initialFilterState, {
        type: "setMinimumSalary",
        value: "150000"
      }).minimumSalary,
      "150000",
      "minimum salary reducer"
    );
  });
}

function makeJob(overrides: Partial<Job>): Job {
  return {
    id: "salary-job",
    title: "Endpoint Engineer",
    company: "Audit Company",
    location: "Remote, US",
    workplace: "Remote",
    postedAt: "2026-07-12T00:00:00.000Z",
    fetchedAt: "2026-07-12T00:00:00.000Z",
    staleAfter: "2026-08-12T00:00:00.000Z",
    source: "Audit",
    sourceUrl: "https://example.com/job",
    applyUrl: "https://example.com/job",
    attributionLabel: "Audit",
    termsProfile: "public-api",
    summary: "Endpoint engineering role.",
    tags: ["Endpoint"],
    matchReasons: ["Endpoint engineering"],
    tools: ["Intune"],
    platforms: ["Windows"],
    roleFamily: "Endpoint Engineering",
    seniority: "Mid",
    employmentType: "Full-time",
    ...overrides
  };
}

function assertIds(jobs: Job[], expected: string[]) {
  assertEqual(jobs.map((job) => job.id).join(","), expected.join(","), "filtered job IDs");
}

function assertEqual<T>(actual: T, expected: T, detail: string) {
  if (actual !== expected) {
    throw new Error(`${detail}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
