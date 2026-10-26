import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { canonicalPostingUrl } from "../../src/lib/job-trust";
import { foldTokens } from "../../src/lib/text";
import type { Job, JobsFeed } from "../../src/types/job";

export type PostingUrlGroup = {
  key: string;
  companies: string[];
  titles: string[];
  ids: string[];
};

export type PostingUrlReport = {
  aliases: PostingUrlGroup[];
  collisions: PostingUrlGroup[];
  droppedIds: string[];
};

// Legal and generic words are not an employer. Compared names keep only the
// distinctive remainder, so "Corp" or "Systems" cannot glue two companies together.
const genericEmployerTokens = new Set([
  "ag",
  "bv",
  "co",
  "companies",
  "company",
  "consulting",
  "corp",
  "corporation",
  "global",
  "gmbh",
  "group",
  "groups",
  "holding",
  "holdings",
  "inc",
  "incorporated",
  "limited",
  "llc",
  "llp",
  "lp",
  "ltd",
  "ltda",
  "nv",
  "pc",
  "plc",
  "pllc",
  "pty",
  "sa",
  "sarl",
  "sas",
  "service",
  "services",
  "solution",
  "solutions",
  "system",
  "systems",
  "technologies",
  "technology"
]);

export function companiesShareEmployer(left: string, right: string) {
  const leftName = distinctiveEmployerName(left);
  const rightName = distinctiveEmployerName(right);
  if (leftName.length < 2 || rightName.length < 2) return false;
  if (leftName === rightName) return true;
  return leftName.startsWith(`${rightName} `) || rightName.startsWith(`${leftName} `);
}

export function classifyPostingUrlGroups(jobs: readonly Job[]): PostingUrlReport {
  const groups = new Map<string, Job[]>();

  for (const job of jobs) {
    const key = (job.applyUrl && canonicalPostingUrl(job.applyUrl)) || canonicalPostingUrl(job.sourceUrl);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(job);
    groups.set(key, group);
  }

  const aliases: PostingUrlGroup[] = [];
  const collisions: PostingUrlGroup[] = [];

  for (const [key, group] of groups) {
    const identities = new Set(group.map((job) => `${foldTokens(job.company)}|${foldTokens(job.title)}`));
    if (identities.size < 2) continue;
    const reported = toGroup(key, group);
    if (sameEmployerGroup(reported.companies)) aliases.push(reported);
    else collisions.push(reported);
  }

  return { aliases, collisions, droppedIds: collisions.flatMap((group) => group.ids) };
}

export async function quarantinePostingUrlCollisions(path: string) {
  const original = await readFile(path, "utf8");
  const parsed: unknown = JSON.parse(original);
  if (!isJobsFeed(parsed)) throw new Error(`${path} is not a jobs feed`);
  const report = classifyPostingUrlGroups(parsed.jobs);
  for (const group of report.aliases) printGroup("alias", group);
  for (const group of report.collisions) printGroup("collision", group);

  if (report.droppedIds.length === 0) {
    console.log(`Posting URL aliases: ${report.aliases.length}. Distinct-employer collisions: 0.`);
    return report;
  }

  const dropped = new Set(report.droppedIds);
  parsed.jobs = parsed.jobs.filter((job) => !dropped.has(job.id));
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`);
  for (const group of report.collisions) await warn(postingCollisionWarning(group));
  console.log(`Dropped ${report.droppedIds.length} colliding listings. Posting URL aliases: ${report.aliases.length}. Distinct-employer collisions: ${report.collisions.length}.`);
  return report;
}

function distinctiveEmployerName(value: string) {
  return foldTokens(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !genericEmployerTokens.has(token))
    .join(" ");
}

function sameEmployerGroup(companies: readonly string[]) {
  for (let left = 0; left < companies.length; left += 1) {
    for (let right = left + 1; right < companies.length; right += 1) {
      if (!companiesShareEmployer(companies[left], companies[right])) return false;
    }
  }
  return true;
}

function toGroup(key: string, jobs: readonly Job[]): PostingUrlGroup {
  return {
    key,
    companies: unique(jobs.map((job) => job.company)),
    titles: unique(jobs.map((job) => job.title)),
    ids: jobs.map((job) => job.id)
  };
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function isJobsFeed(value: unknown): value is JobsFeed {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as { jobs?: unknown }).jobs);
}

export function postingCollisionWarning(group: PostingUrlGroup) {
  return `Dropped ${group.ids.length} listings sharing ${group.key} across distinct employers: ${group.companies.join(" | ")} (${group.ids.join(", ")})`;
}

function printGroup(kind: string, group: PostingUrlGroup) {
  console.log(`${kind}\t${group.key}`);
  console.log(`  companies: ${group.companies.join(" | ")}`);
  console.log(`  titles: ${group.titles.join(" | ")}`);
  console.log(`  ids: ${group.ids.join(", ")}`);
}

async function warn(message: string) {
  console.log(`::warning::${message}`);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) await appendFile(summary, `- ${message}\n`);
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const path = resolve(process.argv[2] ?? "src/data/jobs.json");
  await quarantinePostingUrlCollisions(path);
}
