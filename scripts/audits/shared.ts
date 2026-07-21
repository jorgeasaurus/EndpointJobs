import { readFile } from "node:fs/promises";
import type { ReactNode } from "react";

import { ToggleButton } from "../../src/components/job-board/toggle-button";
import type { EndpointTool, Job, JobsFeed, Platform } from "../../src/types/job";
import feedData from "../../src/data/jobs.json";

export type AuditStatus = "Passed" | "Failed";
export type AuditResult = { id: string; status: AuditStatus; detail: string };
export type CsvRow = Record<string, string>;

export type RunAudit = (
  id: string,
  detail: string,
  audit: () => Promise<void> | void
) => Promise<void>;

export const deadAdzunaUrl = "https://www.adzuna.com/details/5763079616";
export const fixedAuditNow = new Date("2026-06-28T20:55:00.000Z");
export const feed = feedData as JobsFeed;

export const AuditToggleButton = ToggleButton as unknown as (props: {
  activeClassName: string;
  children?: ReactNode;
  inactiveClassName: string;
  isActive: boolean;
  onClick: () => void;
}) => ReturnType<typeof ToggleButton>;

export const sourcePaths = {
  activeFilters: "src/components/job-board/active-filters.ts",
  animatedNumber: "src/components/job-board/animated-number.tsx",
  atsBoards: "scripts/job-refresh/providers/ats-boards.ts",
  browserAudit: "scripts/audit-user-stories-browser.mjs",
  comparisonBrowserAudit: "scripts/audits/job-comparison-browser.mjs",
  comparisonDataAudit: "scripts/audits/job-comparison-data.ts",
  companyAts: "scripts/job-refresh/providers/company-ats.ts",
  workdaySites: "scripts/job-refresh/providers/workday-sites.ts",
  controls: "src/components/job-board/controls.tsx",
  curated: "scripts/job-refresh/providers/curated-jobs.ts",
  feedAudit: "scripts/audits/feed-audits.ts",
  feedSafetyAudit: "scripts/audits/feed-safety-data.ts",
  filterAudit: "scripts/audits/filter-audits.ts",
  jobCardAudit: "scripts/audits/job-card-audits.ts",
  jobTaxonomy: "src/lib/job-taxonomy.ts",
  issueConfig: ".github/ISSUE_TEMPLATE/config.yml",
  issueTemplate: ".github/ISSUE_TEMPLATE/report-or-request.yml",
  jobBoard: "src/components/job-board.tsx",
  jobCard: "src/components/job-board/job-card.tsx",
  jobExclusions: "src/lib/job-exclusions.ts",
  jobMap: "src/components/job-board/job-map.tsx",
  jobMapCanvas: "src/components/job-board/job-map-canvas.tsx",
  jobMapConfig: "src/components/job-board/job-map-config.ts",
  jobMapCss: "src/app/job-board-map.css",
  jobMapFeatures: "src/components/job-board/job-map-features.ts",
  jobMapLib: "src/lib/job-map.ts",
  jobMapPopup: "src/components/job-board/job-map-popup.tsx",
  jobPage: "src/app/jobs/[id]/page.tsx",
  jobDirectory: "src/app/jobs/page.tsx",
  jobSeo: "src/lib/job-seo.ts",
  jobsApiAudit: "scripts/audits/jobs-api-data.ts",
  jobsApiBrowserAudit: "scripts/audits/jobs-api-browser.mjs",
  minimumSalaryAudit: "scripts/audits/minimum-salary-data.ts",
  layout: "src/app/layout.tsx",
  mapAudit: "scripts/audits/map-audits.ts",
  mapLocation: "src/lib/map-location.ts",
  normalizerAudit: "scripts/audits/normalizer-audits.ts",
  packageLock: "package-lock.json",
  packageJson: "package.json",
  parallaxBackground: "src/components/job-board/parallax-background.tsx",
  page: "src/app/page.tsx",
  providerAudit: "scripts/audits/provider-audits.ts",
  providerContract: "scripts/job-refresh/provider.ts",
  providersPublic: "scripts/job-refresh/providers/public-job-boards.ts",
  rapidApiDaily: "scripts/job-refresh/providers/rapidapi-daily-jobs.ts",
  rapidApiLinkedIn: "scripts/job-refresh/providers/rapidapi-linkedin.ts",
  recruitee: "scripts/job-refresh/providers/recruitee.ts",
  reactDoctorWorkflow: ".github/workflows/react-doctor.yml",
  readme: "README.md",
  refresh: "scripts/refresh-jobs.ts",
  resultsPanel: "src/components/job-board/results-panel.tsx",
  robots: "src/app/robots.ts",
  serpApi: "scripts/job-refresh/providers/serpapi.ts",
  smartRecruiters: "scripts/job-refresh/providers/smartrecruiters.ts",
  usaJobs: "scripts/job-refresh/providers/usajobs.ts",
  shared: "scripts/job-refresh/shared.ts",
  searchConfig: "scripts/job-refresh/search-config.ts",
  seoAudit: "scripts/audits/seo-audits.ts",
  sheet: "docs/feature-user-stories.csv",
  siteMetadata: "src/app/site-metadata.ts",
  sitemap: "src/app/sitemap.ts",
  structuredData: "src/app/structured-data.ts",
  techmapRss: "scripts/job-refresh/providers/techmap-rss.ts",
  theirStack: "scripts/job-refresh/providers/theirstack.ts",
  toggleButton: "src/components/job-board/toggle-button.tsx",
  topbar: "src/components/job-board/topbar.tsx",
  workflow: ".github/workflows/refresh-jobs.yml",
  aiDevBoard: "scripts/job-refresh/providers/aidevboard.ts"
} as const;

export type SourceKey = keyof typeof sourcePaths;
export type Sources = Record<SourceKey, string>;

export async function readSources(): Promise<Sources> {
  const loaded = {} as Sources;

  await Promise.all(
    Object.entries(sourcePaths).map(async ([key, path]) => {
      loaded[key as SourceKey] = await readText(path);
    })
  );

  return loaded;
}

export async function readText(path: string) {
  return readFile(path, "utf8");
}

export type AuditContext = {
  feed: JobsFeed;
  filterFixtureJobs: Job[];
  jobCardMarkup: string;
  results: AuditResult[];
  run: RunAudit;
  sources: Sources;
};

export function makeFilterFixtureJobs(): Job[] {
  return [
    makeJob({
      id: "recent-intune",
      title: "Senior Intune Endpoint Engineer",
      company: "Beta Devices",
      location: "San Francisco, CA",
      workplace: "Hybrid",
      postedAt: daysAgo(3),
      summary: "Own Windows endpoint management with Intune, Autopilot, and PowerShell.",
      salary: { min: 150000, max: 190000, currency: "USD", label: "$150k-$190k" },
      tags: ["Windows", "Intune", "Autopilot", "PowerShell"],
      matchReasons: ["Intune + Autopilot"],
      tools: ["Intune", "Autopilot", "PowerShell"],
      platforms: ["Windows"],
      roleFamily: "Endpoint Engineering",
      seniority: "Senior"
    }),
    makeJob({
      id: "mac-jamf",
      title: "Mac Platform Engineer",
      company: "Acme Systems",
      location: "Remote, US",
      workplace: "Remote",
      postedAt: daysAgo(10),
      summary: "Manage macOS fleet automation with Jamf.",
      tags: ["macOS", "Jamf"],
      matchReasons: ["Jamf + macOS"],
      tools: ["Jamf"],
      platforms: ["macOS"],
      roleFamily: "macOS Platform",
      seniority: "Mid"
    }),
    makeJob({
      id: "security-tanium",
      title: "Staff Endpoint Security Engineer",
      company: "Zulu Security",
      location: "Austin, TX",
      workplace: "On-site",
      postedAt: daysAgo(40),
      summary: "Lead Linux endpoint security response with Tanium and Defender.",
      salary: { min: 170000, max: 210000, currency: "USD", label: "$170k-$210k" },
      tags: ["Linux", "Tanium", "Defender"],
      matchReasons: ["Tanium endpoint security"],
      tools: ["Tanium", "Defender"],
      platforms: ["Linux"],
      roleFamily: "Endpoint Security",
      seniority: "Staff"
    })
  ];
}

export function parseCsv(value: string): CsvRow[] {
  const [headerLine, ...lines] = value.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);

  return lines.map((line) => {
    const fields = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ""]));
  });
}

function parseCsvLine(line: string) {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && next === "\"") {
      field += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(field);
      field = "";
      continue;
    }

    field += char;
  }

  fields.push(field);
  return fields;
}

export function assertIncludes(value: string, expected: string, label?: string) {
  if (!value.includes(expected)) {
    throw new Error(`${label ?? "value"} does not include ${expected}`);
  }
}

export function assertNotIncludes(value: string, unexpected: string, label?: string) {
  if (value.includes(unexpected)) {
    throw new Error(`${label ?? "value"} unexpectedly includes ${unexpected}`);
  }
}

export function assertNoStaticImport(value: string, modulePath: string, label: string) {
  const escapedModulePath = modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const staticImportPattern = new RegExp(
    `import\\s+(?:[^"'();]+?\\s+from\\s+)?["']${escapedModulePath}["']`
  );

  if (staticImportPattern.test(value)) {
    throw new Error(label);
  }
}

export function assertTruthy(value: unknown, message = "expected truthy value") {
  if (!value) {
    throw new Error(message);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `expected ${String(expected)}, got ${String(actual)}`);
  }
}

export function assertNotEqual<T>(actual: T, expected: T, message?: string) {
  if (actual === expected) {
    throw new Error(message ?? `did not expect ${String(expected)}`);
  }
}

export function assertIds(jobs: Job[], expectedIds: string[]) {
  assertEqual(jobs.map((job) => job.id).join(","), expectedIds.join(","));
}

export function assertLabels(items: Array<{ label: string }>, expectedLabels: string[]) {
  assertEqual(items.map((item) => item.label).join("|"), expectedLabels.join("|"));
}

export function assertArrayIncludes<T>(actual: readonly T[], expectedValues: readonly T[]) {
  for (const value of expectedValues) {
    if (!actual.includes(value)) {
      throw new Error(`expected ${JSON.stringify(actual)} to include ${String(value)}`);
    }
  }
}

export function assertValidJobShape(job: Job) {
  [
    job.id,
    job.title,
    job.company,
    job.location,
    job.postedAt,
    job.fetchedAt,
    job.staleAfter,
    job.source,
    job.sourceUrl,
    job.attributionLabel,
    job.summary,
    job.roleFamily,
    job.seniority,
    job.employmentType
  ].forEach((value) => assertTruthy(value, `job ${job.id} has missing required field`));
  assertTruthy(job.matchReasons.length > 0, `job ${job.id} missing match reasons`);
  assertTruthy(job.platforms.length > 0, `job ${job.id} missing platforms`);
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

export function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function makeAdzunaJob(overrides: Partial<Job> = {}): Job {
  return makeJob({
    source: "Adzuna",
    sourceUrl: "https://www.adzuna.com/details/audit-fresh",
    applyUrl: "https://www.adzuna.com/details/audit-fresh",
    attributionLabel: "Adzuna",
    ...overrides
  });
}

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "audit-job",
    title: "Endpoint Engineer",
    company: "Audit Company",
    location: "Remote",
    workplace: "Remote",
    postedAt: daysAgo(1),
    fetchedAt: new Date().toISOString(),
    staleAfter: daysFromNow(30),
    source: "Audit",
    sourceUrl: "https://example.com/audit-job",
    applyUrl: "https://example.com/audit-job/apply",
    attributionLabel: "Audit Source",
    termsProfile: "public-api",
    summary: "Endpoint engineer role for Windows and macOS device management.",
    tags: ["Windows", "macOS"],
    matchReasons: ["Endpoint engineering"],
    tools: ["Intune"] satisfies EndpointTool[],
    platforms: ["Windows", "macOS"] satisfies Platform[],
    roleFamily: "Endpoint Engineering",
    seniority: "Mid",
    employmentType: "Full-time",
    ...overrides
  };
}
