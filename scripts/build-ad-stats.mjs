// Snapshot feed stats for the Remotion social ad. The ad must not bundle the 5 MB feed.
import {readFileSync, writeFileSync} from "node:fs";

const {jobs, updatedAt} = JSON.parse(readFileSync("src/data/jobs.json", "utf8"));

const count = (pick) => {
  const totals = new Map();
  for (const job of jobs) for (const value of pick(job) ?? []) totals.set(value, (totals.get(value) ?? 0) + 1);
  return [...totals].sort((a, b) => b[1] - a[1]);
};

const highlights = jobs
  .filter((job) => job.salary?.currency === "USD" && job.salary.min >= 100000 && job.workplace === "Remote" && job.tools?.length >= 2)
  .filter((job) => /endpoint|macos|mdm|intune|jamf|client platform/i.test(job.title) && job.title.length <= 34)
  .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  .filter((job, index, all) => all.findIndex((other) => other.title === job.title) === index)
  .slice(0, 3)
  .map((job) => ({title: job.title, workplace: job.workplace, salary: job.salary.label, tools: job.tools.slice(0, 3)}));

const stats = {
  updatedAt,
  total: jobs.length,
  remoteOrHybrid: jobs.filter((job) => job.workplace === "Remote" || job.workplace === "Hybrid").length,
  salaryShown: jobs.filter((job) => job.salary).length,
  locations: new Set(jobs.map((job) => job.mapLocation?.label).filter(Boolean)).size,
  tools: count((job) => job.tools).slice(0, 6).map(([name, total]) => ({name, total})),
  highlights,
};

writeFileSync("remotion/ad-stats.json", `${JSON.stringify(stats, null, 2)}\n`);
console.log(stats);
