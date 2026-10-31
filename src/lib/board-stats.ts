import { isLeadershipJob } from "@/lib/job-filters";
import { seniorityOptions, getEndpointToolLabel } from "@/lib/job-taxonomy";
import { matchingMetroAreas, type MetroAreaFilter } from "@/lib/metro-areas";
import { hasListedSalary } from "@/lib/shown-salary";
import { getJobWorkplace } from "@/lib/workplace";
import type { EndpointTool, Job, Seniority } from "@/types/job";

export { boardStatPercent } from "@/lib/board-stat-percent";

export const topBoardLocationLimit = 5;

export type BoardLocationStat = {
  metroArea: MetroAreaFilter;
  count: number;
};

export type BoardToolStat = {
  tool: EndpointTool;
  count: number;
};

export type BoardStats = {
  mappedJobsCount: number;
  remoteJobsCount: number;
  salaryJobsCount: number;
  leadershipJobsCount: number;
  seniorityCounts: Record<Seniority, number>;
  topLocations: BoardLocationStat[];
  toolCounts: BoardToolStat[];
};

export function measureBoardStats(jobs: readonly Job[]): BoardStats {
  let mappedJobsCount = 0;
  let remoteJobsCount = 0;
  let salaryJobsCount = 0;
  let leadershipJobsCount = 0;
  const seniorityCounts = emptySeniorityCounts();
  const locationCounts = new Map<MetroAreaFilter, number>();
  const toolCounts = new Map<EndpointTool, number>();

  for (const job of jobs) {
    const workplace = getJobWorkplace(job);

    if (job.mapLocation) mappedJobsCount += 1;
    if (workplace === "Remote" || workplace === "Hybrid") remoteJobsCount += 1;
    if (hasListedSalary(job)) salaryJobsCount += 1;
    if (isLeadershipJob(job)) leadershipJobsCount += 1;
    seniorityCounts[job.seniority] += 1;

    for (const metroArea of matchingMetroAreas(job)) {
      locationCounts.set(metroArea, (locationCounts.get(metroArea) ?? 0) + 1);
    }

    for (const tool of new Set(job.tools)) {
      toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
    }
  }

  return {
    mappedJobsCount,
    remoteJobsCount,
    salaryJobsCount,
    leadershipJobsCount,
    seniorityCounts,
    topLocations: [...locationCounts.entries()]
      .map(([metroArea, count]) => ({ metroArea, count }))
      .sort(compareCountThenLabel)
      .slice(0, topBoardLocationLimit),
    toolCounts: [...toolCounts.entries()]
      .map(([tool, count]) => ({ tool, count }))
      .sort((left, right) => right.count - left.count || compareLabels(getEndpointToolLabel(left.tool), getEndpointToolLabel(right.tool)))
  };
}

function emptySeniorityCounts(): Record<Seniority, number> {
  const counts = {} as Record<Seniority, number>;
  for (const seniority of seniorityOptions) counts[seniority] = 0;
  return counts;
}

function compareCountThenLabel(
  left: { metroArea: string; count: number },
  right: { metroArea: string; count: number }
) {
  return right.count - left.count || compareLabels(left.metroArea, right.metroArea);
}

function compareLabels(left: string, right: string) {
  return left.localeCompare(right, "en");
}
