import { readFile } from "node:fs/promises";
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
};

export function companiesShareEmployer(left: string, right: string) {
  const leftName = foldTokens(left);
  const rightName = foldTokens(right);
  if (!leftName || !rightName) return false;
  if (leftName === rightName || containsCompanyName(leftName, rightName) || containsCompanyName(rightName, leftName)) {
    return true;
  }

  const leftTokens = employerTokens(leftName);
  const rightTokens = employerTokens(rightName);
  if (leftTokens.length === 0 || rightTokens.length === 0) return false;
  return leftTokens.some((token) => rightTokens.includes(token));
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

  return { aliases, collisions };
}

function employerTokens(name: string) {
  const tokens = name.split(" ").filter((token) => token.length >= 2);
  const longTokens = tokens.filter((token) => token.length >= 4);
  return longTokens.length > 0 ? longTokens : tokens;
}

function containsCompanyName(haystack: string, name: string) {
  if (name.length < 2) return false;
  return haystack === name
    || haystack.startsWith(`${name} `)
    || haystack.endsWith(` ${name}`)
    || haystack.includes(` ${name} `);
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

export async function reportPostingUrlCollisions(path: string) {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isJobsFeed(parsed)) throw new Error(`${path} is not a jobs feed`);
  const report = classifyPostingUrlGroups(parsed.jobs);
  for (const group of report.aliases) printGroup("alias", group);
  for (const group of report.collisions) printGroup("collision", group);
  console.log(`Posting URL aliases: ${report.aliases.length}. Distinct-employer collisions: ${report.collisions.length}.`);
  return report;
}

function printGroup(kind: string, group: PostingUrlGroup) {
  console.log(`${kind}\t${group.key}`);
  console.log(`  companies: ${group.companies.join(" | ")}`);
  console.log(`  titles: ${group.titles.join(" | ")}`);
  console.log(`  ids: ${group.ids.join(", ")}`);
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const path = resolve(process.argv[2] ?? "src/data/jobs.json");
  const report = await reportPostingUrlCollisions(path);
  if (report.collisions.length > 0) process.exit(1);
}
