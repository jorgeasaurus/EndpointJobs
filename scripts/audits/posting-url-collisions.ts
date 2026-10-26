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
  blocked: boolean;
};

// Legal designators are not the employer. Industry words are generic too, but
// a name that is only those words falls back to the legal-suffix form so
// "Global Systems" still matches "Global Systems Inc".
const legalSuffixTokens = new Set([
  "ag",
  "bv",
  "co",
  "corp",
  "corporation",
  "gmbh",
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
  "sas"
]);

const genericEmployerTokens = new Set([
  ...legalSuffixTokens,
  "companies",
  "company",
  "consulting",
  "global",
  "group",
  "groups",
  "holding",
  "holdings",
  "service",
  "services",
  "solution",
  "solutions",
  "system",
  "systems",
  "technologies",
  "technology"
]);

export function collisionDropLimit(jobCount: number) {
  return Math.min(5, (jobCount * 5) / 100);
}

export function collisionAuditExitCode(blocked: boolean) {
  return blocked ? 1 : 0;
}

export function companiesShareEmployer(left: string, right: string) {
  const leftName = employerName(left, genericEmployerTokens);
  const rightName = employerName(right, genericEmployerTokens);
  if (leftName && rightName && namesMatch(leftName, rightName)) return true;

  // A generic-only name has no distinctive tokens, so prefix matching would alias
  // "Global" with "Global Payments". The legal-suffix forms must be the same
  // name. That same full-string compare also rejoins "TEK Systems" with "TEKsystems"
  // after generic words such as "systems" were removed from the distinctive form.
  const leftLegal = employerName(left, legalSuffixTokens);
  const rightLegal = employerName(right, legalSuffixTokens);
  return namesEqual(leftLegal, rightLegal);
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

  return { aliases, collisions, droppedIds: collisions.flatMap((group) => group.ids), blocked: false };
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

  const limit = collisionDropLimit(parsed.jobs.length);
  if (report.droppedIds.length > limit) {
    const blocked = { ...report, blocked: true };
    await annotate("error", collisionDropBlockedMessage(blocked, parsed.jobs.length));
    console.log(`Refused to drop ${blocked.droppedIds.length} listings (limit ${limit} of ${parsed.jobs.length}). Distinct-employer collisions: ${blocked.collisions.length}.`);
    return blocked;
  }

  const dropped = new Set(report.droppedIds);
  parsed.jobs = parsed.jobs.filter((job) => !dropped.has(job.id));
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`);
  for (const group of report.collisions) await annotate("warning", postingCollisionWarning(group));
  console.log(`Dropped ${report.droppedIds.length} colliding listings. Posting URL aliases: ${report.aliases.length}. Distinct-employer collisions: ${report.collisions.length}.`);
  return report;
}

export function collisionDropBlockedMessage(report: PostingUrlReport, jobCount: number) {
  const limit = collisionDropLimit(jobCount);
  const keys = report.collisions.slice(0, 8).map((group) => group.key).join(", ");
  return `Refused to drop ${report.droppedIds.length} listings (limit ${limit} of ${jobCount}). Likely canonical posting URL regression. Keys: ${keys}`;
}

function employerName(value: string, drop: ReadonlySet<string>) {
  const tokens = normalizeEmployer(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !drop.has(token));
  while (tokens[0] === "the") tokens.shift();
  return tokens.join(" ");
}

function normalizeEmployer(value: string) {
  const prepared = value
    .replace(/int['’]l\b/gi, "international")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ");
  return foldTokens(prepared)
    .split(" ")
    .filter((token) => token.length > 0 && token !== "and")
    .map((token) => (token === "intl" ? "international" : token))
    .join(" ");
}

function namesMatch(left: string, right: string) {
  if (left.length < 2 || right.length < 2) return false;
  if (left === right || sameCompactName(left, right)) return true;
  return left.startsWith(`${right} `) || right.startsWith(`${left} `);
}

function namesEqual(left: string, right: string) {
  if (left.length < 2 || right.length < 2) return false;
  return left === right || sameCompactName(left, right);
}

function sameCompactName(left: string, right: string) {
  const compactLeft = left.replaceAll(" ", "");
  return compactLeft.length >= 2 && compactLeft === right.replaceAll(" ", "");
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

async function annotate(level: "warning" | "error", message: string) {
  console.log(`::${level}::${message}`);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) await appendFile(summary, `- ${message}\n`);
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const path = resolve(process.argv[2] ?? "src/data/jobs.json");
  const report = await quarantinePostingUrlCollisions(path);
  if (collisionAuditExitCode(report.blocked) === 1) process.exit(1);
}
