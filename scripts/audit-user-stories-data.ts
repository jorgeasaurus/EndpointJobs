import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { JobCard } from "../src/components/job-board/job-card";

import { auditJobComparisonData } from "./audits/job-comparison-data";
import { auditFeedSafetyData } from "./audits/feed-safety-data";
import { auditJobsApiData } from "./audits/jobs-api-data";
import { auditMinimumSalaryData } from "./audits/minimum-salary-data";
import { auditFeedIntegrity } from "./audits/feed-audits";
import { auditFilters } from "./audits/filter-audits";
import { auditJobCards } from "./audits/job-card-audits";
import { auditMaps } from "./audits/map-audits";
import { auditNormalizers } from "./audits/normalizer-audits";
import { auditProviders } from "./audits/provider-audits";
import { auditSeo } from "./audits/seo-audits";
import {
  assertEqual,
  assertTruthy,
  daysAgo,
  feed,
  makeFilterFixtureJobs,
  makeJob,
  parseCsv,
  readSources,
  type AuditContext,
  type AuditResult,
  type AuditStatus
} from "./audits/shared";

const results: AuditResult[] = [];
const sources = await readSources();
const filterFixtureJobs = makeFilterFixtureJobs();
const jobCardMarkup = renderToStaticMarkup(
  createElement(JobCard, {
    compareDisabled: false,
    isCompared: false,
    job: makeJob({
      id: "card-job",
      title: "Intune Endpoint Engineer",
      company: "Card Company",
      location: "Seattle, WA",
      workplace: "Hybrid",
      postedAt: daysAgo(2),
      source: "Audit Source",
      attributionLabel: "Audit Attribution",
      summary: "Manage Intune endpoint policy.",
      description: `Manage Intune endpoint policy.\n\n${"Long endpoint operations details. ".repeat(40)}`,
      salary: { min: 120000, max: 150000, currency: "USD", label: "$120k-$150k" },
      tags: ["Windows", "Intune"],
      matchReasons: ["Intune + Autopilot", "Endpoint engineering"],
      tools: ["Intune", "Autopilot"],
      platforms: ["Windows"],
      roleFamily: "Endpoint Engineering",
      seniority: "Senior",
      employmentType: "Full-time"
    }),
    onToggleComparison: () => undefined,
    query: "Intune"
  })
);

const context: AuditContext = {
  feed,
  filterFixtureJobs,
  jobCardMarkup,
  results,
  run,
  sources
};

await run("TRACKER-001", "Canonical story sheet has complete source evidence", async () => {
  const rows = parseCsv(sources.sheet);
  assertEqual(rows.length, 78, "expected 78 user stories");
  assertEqual(new Set(rows.map((row) => row.ID)).size, rows.length, "duplicate story IDs");

  rows.forEach((row, index) => {
    assertEqual(row.ID, `FEAT-${String(index + 1).padStart(3, "0")}`);
    assertTruthy(row["User Story"], `${row.ID} missing user story`);
    assertTruthy(row["Expected Behavior"], `${row.ID} missing expected behavior`);
    assertTruthy(row["Source Evidence"], `${row.ID} missing source evidence`);
    assertEqual(row["Implementation Status"], "Implemented from code");
    assertEqual(row["Test Status"], "Passed");
    assertTruthy(
      row["Retest Status"].startsWith("Passed"),
      `${row.ID} retest status is not passed`
    );

    for (const evidencePath of row["Source Evidence"].split(";").map((item) => item.trim())) {
      assertTruthy(existsSync(evidencePath), `${row.ID} evidence path missing: ${evidencePath}`);
    }
  });

  const auditSource = [
    sources.browserAudit,
    sources.comparisonBrowserAudit,
    sources.comparisonDataAudit,
    sources.feedAudit,
    sources.feedSafetyAudit,
    sources.filterAudit,
    sources.jobCardAudit,
    sources.jobsApiAudit,
    sources.jobsApiBrowserAudit,
    sources.mapAudit,
    sources.minimumSalaryAudit,
    sources.normalizerAudit,
    sources.providerAudit,
    sources.seoAudit,
    await readFile("scripts/audit-user-stories-data.ts", "utf8")
  ].join("\n");
  const auditedIds = new Set(
    [...auditSource.matchAll(/(?:run|audit)\("(FEAT-\d{3})"/g)].map((match) => match[1])
  );
  rows.forEach((row) => assertTruthy(auditedIds.has(row.ID), `${row.ID} has no executable audit`));
});

await auditJobCards(context);
await auditFilters(context);
await auditJobComparisonData(run);
await auditFeedSafetyData(run);
await auditJobsApiData(run);
await auditMinimumSalaryData(run);
await auditFeedIntegrity(context);
await auditProviders(context);
await auditNormalizers(context);
await auditSeo(context);
await auditMaps(context);

const summary = results.reduce<Record<string, number>>((acc, result) => {
  acc[result.status] = (acc[result.status] ?? 0) + 1;
  return acc;
}, {});

const auditedFeatureIds = new Set(
  results
    .filter((result) => result.status === "Passed" && /^FEAT-\d{3}$/.test(result.id))
    .map((result) => result.id)
);

console.log(
  JSON.stringify(
    {
      summary,
      auditedFeatureCount: auditedFeatureIds.size,
      results
    },
    null,
    2
  )
);

if (results.some((result) => result.status !== "Passed")) {
  process.exitCode = 1;
}

async function run(id: string, detail: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    record(id, "Passed", detail);
  } catch (error) {
    record(
      id,
      "Failed",
      `${detail}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function record(id: string, status: AuditStatus, detail: string) {
  results.push({ id, status, detail });
}
