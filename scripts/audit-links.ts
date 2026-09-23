import { writeFile } from "node:fs/promises";
import feedData from "../src/data/jobs.json";
import { isActiveJob } from "../src/lib/jobs";
import type { Job } from "../src/types/job";
import { auditInternal } from "./link-audit/internal";
import { auditExternal } from "./link-audit/external";

const base = process.env.LINK_AUDIT_BASE_URL ?? "https://endpointjobs.dev";
const output = process.env.LINK_AUDIT_OUTPUT ?? "/tmp/endpointjobs-link-audit.json";
const scope = process.env.LINK_AUDIT_SCOPE ?? "all";
if (!["all", "internal", "external"].includes(scope)) throw new Error("Scope must be all, internal, or external");
const startedAt = new Date();
const jobs = (feedData.jobs as Job[]).filter((job) => isActiveJob(job, startedAt));
const internal = scope !== "external" ? await auditInternal(base) : undefined;
const external = scope !== "internal" ? await auditExternal(jobs) : undefined;
const tally = (entries: { outcome: string }[]) => entries.reduce<Record<string, number>>((counts, item) => {
  counts[item.outcome] = (counts[item.outcome] ?? 0) + 1;
  return counts;
}, {});
const report = {
  startedAt: startedAt.toISOString(), completedAt: new Date().toISOString(), base,
  feedUpdatedAt: feedData.updatedAt, activeListings: jobs.length,
  limits: ["External HTTP success proves reachability only, not that a vacancy remains open.", "Dead means repeated HTTP 404/410 or recognized ATS closed/not-found response; inspect before excluding.", "Bot protection, authentication, rate limits, network errors, and unknown ATS payloads remain unverified.", "Internal crawl follows rendered HTML anchor URLs, strips fragments, and preserves queries; it does not exercise client-only controls."],
  summary: { internal: internal ? tally(internal.results) : undefined, external: external ? tally(external) : undefined },
  internal, external
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, ...report.summary }));
if (internal?.results.some((result) => result.outcome !== "reachable") || external?.some((result) => result.outcome === "dead")) process.exitCode = 1;
