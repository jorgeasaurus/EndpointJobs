import type { EndpointTool, Job, Platform, Seniority } from "@/types/job";

import { getLocationSearchText, normalizeFilterText } from "./filter-model";

export type MatchPreferences = {
  platforms: Platform[];
  tools: EndpointTool[];
  location: string;
  salaryFloor: number | null;
  seniority: Seniority | "Any";
};

export type JobMatch = {
  label: "Strong match" | "Good match" | "Partial match";
  reasons: MatchEvaluation[];
  score: number;
};

export const initialMatchPreferences: MatchPreferences = {
  platforms: [],
  tools: [],
  location: "",
  salaryFloor: null,
  seniority: "Any"
};

export function getJobMatch(
  job: Job,
  preferences: MatchPreferences
): JobMatch | null {
  const evaluations = [
    evaluateListPreference(
      preferences.platforms,
      job.platforms,
      "Platform",
      "Platform differs"
    ),
    evaluateListPreference(preferences.tools, job.tools, "Tool", "Tools differ"),
    evaluateLocation(job, preferences.location),
    evaluateSalary(job, preferences.salaryFloor),
    evaluateSeniority(job, preferences.seniority)
  ].filter((evaluation) => evaluation !== null);

  if (evaluations.length === 0) return null;

  const matched = evaluations.filter((evaluation) => evaluation.matched);
  const score = Math.round((matched.length / evaluations.length) * 100);

  return {
    label:
      score >= 80 ? "Strong match" : score >= 60 ? "Good match" : "Partial match",
    reasons: evaluations,
    score
  };
}

export type MatchEvaluation = { matched: boolean; reason: string };

function evaluateListPreference<T extends string>(
  preferred: T[],
  actual: T[],
  label: string,
  missingReason: string
): MatchEvaluation | null {
  if (preferred.length === 0) return null;

  const matches = preferred.filter((value) => actual.includes(value));
  return matches.length > 0
    ? { matched: true, reason: `${label}: ${matches.join(", ")}` }
    : { matched: false, reason: missingReason };
}

function evaluateLocation(job: Job, location: string): MatchEvaluation | null {
  const normalizedLocation = normalizeFilterText(location);
  if (!normalizedLocation) return null;

  return getLocationSearchText(job).includes(normalizedLocation)
    ? { matched: true, reason: `Location: ${location.trim()}` }
    : { matched: false, reason: "Location differs" };
}

function evaluateSalary(job: Job, salaryFloor: number | null): MatchEvaluation | null {
  if (salaryFloor === null) return null;

  const disclosedMaximum = job.salary?.max ?? job.salary?.min;
  return typeof disclosedMaximum === "number" && disclosedMaximum >= salaryFloor
    ? { matched: true, reason: `Salary reaches $${formatSalary(salaryFloor)}` }
    : { matched: false, reason: "Salary below target or not shown" };
}

function evaluateSeniority(
  job: Job,
  seniority: MatchPreferences["seniority"]
): MatchEvaluation | null {
  if (seniority === "Any") return null;

  return job.seniority === seniority
    ? { matched: true, reason: `Seniority: ${seniority}` }
    : { matched: false, reason: `Seniority: ${job.seniority}` };
}

function formatSalary(value: number) {
  return value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);
}
