import { initialFilterState } from "@/components/job-board/filter-model";
import { selectVisibleJobs } from "@/lib/board-page";
import { hasShownSalary } from "@/lib/shown-salary";
import type { EndpointTool, Job } from "@/types/job";

// Management platforms that identify an endpoint role on their own. Identity,
// scripting, and security tools (Entra ID, PowerShell, Defender) also show up in
// adjacent roles, so they stay off the landing page.
const platformTools: readonly EndpointTool[] = [
  "Intune",
  "Jamf",
  "SCCM",
  "Autopilot",
  "Workspace ONE",
  "Kandji",
  "Tanium",
  "Fleet MDM",
  "NinjaOne"
];

const previewSize = 4;
const toolCountSize = 4;

export type LandingRole = { job: Job; platformTools: EndpointTool[] };

export type Landing = {
  total: number;
  preview: LandingRole[];
  toolCounts: { tool: EndpointTool; count: number }[];
};

/** Everything the home page shows, from the same selection the board uses. */
export function selectLanding(jobs: readonly Job[]): Landing {
  const { visibleJobs } = selectVisibleJobs(jobs, initialFilterState);
  const paid = visibleJobs
    .filter((job) => hasShownSalary(job))
    .map((job) => ({ job, platformTools: platformTools.filter((tool) => job.tools.includes(tool)) }));
  // Platform roles lead so the preview backs the endpoint claim; adjacent roles
  // only fill what is left. Recency holds within each tier.
  const preview = [
    ...paid.filter((role) => role.platformTools.length > 0),
    ...paid.filter((role) => role.platformTools.length === 0)
  ].slice(0, previewSize);
  // Each count is the `/[tool]` page's own selection, so the number matches the page it links to.
  const toolCounts = platformTools
    .map((tool) => ({
      tool,
      count: selectVisibleJobs(jobs, { ...initialFilterState, selectedTools: [tool] }).visibleJobs.length
    }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, toolCountSize);

  return { total: visibleJobs.length, preview, toolCounts };
}
