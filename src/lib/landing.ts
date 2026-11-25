import { initialFilterState, withInitialTools } from "@/components/job-board/filter-model";
import { selectVisibleJobs } from "@/lib/board-page";
import { managementTools } from "@/lib/job-taxonomy";
import { hasShownSalary } from "@/lib/shown-salary";
import type { EndpointTool, Job } from "@/types/job";

/** Enough rows for a tall desktop. Shorter viewports keep the first four visible. */
export const landingPreviewSize = 8;
const toolCountSize = 4;

export type LandingRole = { job: Job; managementTools: EndpointTool[] };

export type Landing = {
  total: number;
  preview: LandingRole[];
  toolCounts: { tool: EndpointTool; count: number }[];
};

/** Everything the home page shows, from the same selection the board uses. */
export function selectLanding(jobs: readonly Job[]): Landing {
  const { visibleJobs } = selectVisibleJobs(jobs, initialFilterState);
  // Management platforms by open roles, most first; ties keep taxonomy order.
  // Each count is the `/[tool]` page's own selection, so the number matches the page it links to.
  const ranking = managementTools
    .map((tool) => ({ tool, count: selectVisibleJobs(jobs, withInitialTools([tool])).visibleJobs.length }))
    .sort((a, b) => b.count - a.count);
  const rankedTools = ranking.map(({ tool }) => tool);
  const paid = visibleJobs
    .filter((job) => hasShownSalary(job))
    .map((job) => ({ job, managementTools: rankedTools.filter((tool) => job.tools.includes(tool)) }));
  // Management roles lead so the preview backs the endpoint claim; adjacent roles
  // only fill what is left. Recency holds within each tier.
  const preview = [
    ...paid.filter((role) => role.managementTools.length > 0),
    ...paid.filter((role) => role.managementTools.length === 0)
  ].slice(0, landingPreviewSize);
  const toolCounts = ranking.filter(({ count }) => count > 0).slice(0, toolCountSize);

  return { total: visibleJobs.length, preview, toolCounts };
}
