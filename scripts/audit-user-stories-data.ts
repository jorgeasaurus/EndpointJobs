import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { getActiveFilterItems } from "../src/components/job-board/active-filters";
import {
  filterJobs,
  filterReducer,
  initialFilterState
} from "../src/components/job-board/filter-model";
import {
  filterStateFromSearchParams,
  mergeFilterStateIntoSearchParams
} from "../src/components/job-board/filter-url";
import { JobCard } from "../src/components/job-board/job-card";
import { JobMapPopupContent } from "../src/components/job-board/job-map-popup";
import { ToggleButton } from "../src/components/job-board/toggle-button";
import feedData from "../src/data/jobs.json";
import { getHomeJsonLd, serializeJsonLd } from "../src/app/structured-data";
import { buildJobMapPoints } from "../src/lib/job-map";
import {
  formatUpdatedAt,
  getExpandedDescriptionParagraphs,
  isActiveJob,
  roleFamilyOptions,
  toolOptions
} from "../src/lib/jobs";
import {
  endpointToolDefinitions,
  roleFamilyInferenceRules
} from "../src/lib/job-taxonomy";
import {
  isExcludedJobSourceUrl,
  isSourceFreshnessExpired
} from "../src/lib/job-exclusions";
import type { EndpointTool, Job, JobsFeed, Platform } from "../src/types/job";
import {
  buildFeatureCollection,
  readJobPreview
} from "../src/components/job-board/job-map-features";

import { resolveJobMapLocation } from "./job-refresh/map-location";
import { selectFeedJobs } from "./job-refresh/job-selection";
import {
  defaultCompanyJobQueries,
  defaultEndpointSearchQueries,
  monitoredCompanyNames,
  powerShellSysadminSearchQueries,
  powerShellSysadminTitleFilters
} from "./job-refresh/search-config";
import {
  buildStableJobId,
  deriveMatchReasons,
  derivePlatforms,
  deriveTools,
  extractSalaryFromText,
  formatProviderError,
  inferEmploymentType,
  inferRoleFamily,
  inferSeniority,
  inferWorkplace,
  isEndpointRelevant,
  normalizeDescription,
  normalizeSearchText,
  summarize
} from "./job-refresh/shared";
import {
  classifyCuratedHttpStatus,
  evaluateCuratedAvailability
} from "./job-refresh/providers/curated-jobs";
import { normalizeSerpApiGoogleJob } from "./job-refresh/providers/serpapi";
import { auditJobComparisonData } from "./audits/job-comparison-data";
import { auditFeedSafetyData } from "./audits/feed-safety-data";
import { auditJobsApiData } from "./audits/jobs-api-data";
import { auditMinimumSalaryData } from "./audits/minimum-salary-data";

type AuditStatus = "Passed" | "Failed";
type AuditResult = { id: string; status: AuditStatus; detail: string };
type CsvRow = Record<string, string>;

const deadAdzunaUrl = "https://www.adzuna.com/details/5763079616";
const fixedAuditNow = new Date("2026-06-28T20:55:00.000Z");
const feed = feedData as JobsFeed;
const results: AuditResult[] = [];
const AuditToggleButton = ToggleButton as unknown as (props: {
  activeClassName: string;
  children?: ReactNode;
  inactiveClassName: string;
  isActive: boolean;
  onClick: () => void;
}) => ReturnType<typeof ToggleButton>;

const sourcePaths = {
  activeFilters: "src/components/job-board/active-filters.ts",
  animatedNumber: "src/components/job-board/animated-number.tsx",
  atsBoards: "scripts/job-refresh/providers/ats-boards.ts",
  browserAudit: "scripts/audit-user-stories-browser.mjs",
  comparisonBrowserAudit: "scripts/audits/job-comparison-browser.mjs",
  comparisonDataAudit: "scripts/audits/job-comparison-data.ts",
  companyAts: "scripts/job-refresh/providers/company-ats.ts",
  controls: "src/components/job-board/controls.tsx",
  curated: "scripts/job-refresh/providers/curated-jobs.ts",
  feedSafetyAudit: "scripts/audits/feed-safety-data.ts",
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
  jobsApiAudit: "scripts/audits/jobs-api-data.ts",
  jobsApiBrowserAudit: "scripts/audits/jobs-api-browser.mjs",
  minimumSalaryAudit: "scripts/audits/minimum-salary-data.ts",
  layout: "src/app/layout.tsx",
  mapLocation: "src/lib/map-location.ts",
  packageLock: "package-lock.json",
  packageJson: "package.json",
  parallaxBackground: "src/components/job-board/parallax-background.tsx",
  page: "src/app/page.tsx",
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

type SourceKey = keyof typeof sourcePaths;
const sources = await readSources();

const filterFixtureJobs = [
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

await run("TRACKER-001", "Canonical story sheet has complete source evidence", async () => {
  const rows = parseCsv(sources.sheet);
  assertEqual(rows.length, 75, "expected 75 user stories");
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
    sources.feedSafetyAudit,
    sources.jobsApiAudit,
    sources.jobsApiBrowserAudit,
    sources.minimumSalaryAudit,
    await readFile("scripts/audit-user-stories-data.ts", "utf8")
  ].join("\n");
  const auditedIds = new Set(
    [...auditSource.matchAll(/(?:run|audit)\("(FEAT-\d{3})"/g)].map((match) => match[1])
  );
  rows.forEach((row) => assertTruthy(auditedIds.has(row.ID), `${row.ID} has no executable audit`));
});

await run("FEAT-001", "Static job board loads from active feed data", () => {
  assertTruthy(feed.jobs.length > 0, "feed has no jobs");
  assertTruthy(feed.jobs.some((job) => isActiveJob(job)), "feed has no active jobs");
  assertIncludes(sources.page, "import feedData from \"@/data/jobs.json\"");
  assertIncludes(sources.page, "<JobBoard feed={activeFeed} />");
});

await run("FEAT-002", "Topbar brand links back home", () => {
  assertIncludes(sources.topbar, "href=\"/\"");
  assertIncludes(sources.topbar, "Endpoint Jobs home");
  assertIncludes(sources.topbar, "Endpoint Jobs");
});

await run("FEAT-003", "Refresh timestamps format valid and invalid feed dates", () => {
  assertNotEqual(formatUpdatedAt(feed.updatedAt), "Pending refresh");
  assertEqual(formatUpdatedAt("not-a-date"), "Pending refresh");
  assertIncludes(sources.topbar, "formatUpdatedAt(updatedAt)");
});

await run("FEAT-004", "Hero copy and tracked count describe endpoint scope", () => {
  ["macOS", "Windows", "MDM", "UEM", "endpoint security", "packaging", "automation"].forEach(
    (term) => assertIncludes(sources.controls, term)
  );
  assertIncludes(sources.controls, "activeJobsCount");
  assertIncludes(sources.jobBoard, "activeJobs.length");
  assertIncludes(sources.animatedNumber, "<span", "counter renders plain text");
  assertNotIncludes(sources.animatedNumber, "slot-text", "counter should not import slot-text");
  assertNotIncludes(sources.layout, "slot-text/style.css", "layout should not import slot-text CSS");
  assertNotIncludes(sources.packageJson, "\"slot-text\"", "package should not depend on slot-text");
  assertNotIncludes(sources.packageLock, "node_modules/slot-text", "lockfile should not include slot-text");
});

await run("FEAT-005", "Keyword search checks broad job text", () => {
  const matchesTool = filterJobs(filterFixtureJobs, {
    ...initialFilterState,
    query: "autopilot"
  });
  const matchesCompany = filterJobs(filterFixtureJobs, {
    ...initialFilterState,
    query: "acme"
  });
  assertIds(matchesTool, ["recent-intune"]);
  assertIds(matchesCompany, ["mac-jamf"]);
});

await run("FEAT-008", "Free-text location search checks location and workplace", () => {
  assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, locationQuery: "Austin" }), [
    "security-tanium"
  ]);
  assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, locationQuery: "Remote" }), [
    "mac-jamf"
  ]);
  const zurichJob = makeJob({
    id: "zurich-country-search",
    location: "Zürich",
    mapLocation: {
      label: "Zurich, Switzerland",
      latitude: 47.3769,
      longitude: 8.5417
    }
  });
  for (const locationQuery of ["Switzerland", "Zurich", "Zurich Switzerland", "Zu\u0308rich"]) {
    assertIds(
      filterJobs([zurichJob], { ...initialFilterState, locationQuery }),
      ["zurich-country-search"]
    );
  }
});

await run("FEAT-009", "Workplace filter requires exact workplace type", () => {
  assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, workplace: "Remote" }), [
    "mac-jamf"
  ]);
  assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, workplace: "Hybrid" }), [
    "recent-intune"
  ]);
});

await run("FEAT-010", "Salary-only filter keeps only transparent pay listings", () => {
  const filtered = filterJobs(filterFixtureJobs, { ...initialFilterState, salaryOnly: true });
  assertIds(filtered, ["recent-intune", "security-tanium"]);
  assertLabels(getActiveFilterItems({ ...initialFilterState, salaryOnly: true }), ["Salary shown"]);
});

await run("FEAT-011", "Role family filter matches exact role families", () => {
  assertIds(
    filterJobs(filterFixtureJobs, {
      ...initialFilterState,
      roleFamily: "Endpoint Security"
    }),
    ["security-tanium"]
  );
});

await run("FEAT-012", "Posted-age freshness filters use postedAt age", () => {
  assertLabels(getActiveFilterItems({ ...initialFilterState, freshness: "1" }), [
    "Last 1 day"
  ]);
  assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, freshness: "7" }), [
    "recent-intune"
  ]);
  assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, freshness: "14" }), [
    "recent-intune",
    "mac-jamf"
  ]);
});

await run("FEAT-013", "Platform multi-select matches any selected platform", () => {
  assertIds(
    filterJobs(filterFixtureJobs, {
      ...initialFilterState,
      selectedPlatforms: ["macOS", "Linux"]
    }),
    ["mac-jamf", "security-tanium"]
  );
  const next = filterReducer(initialFilterState, { type: "togglePlatform", value: "macOS" });
  assertEqual(next.selectedPlatforms[0], "macOS");
});

await run("FEAT-016", "Seniority filter matches exact seniority", () => {
  assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, seniority: "Staff" }), [
    "security-tanium"
  ]);
});

await run("FEAT-017", "Sort options order by newest, compensation, and company", () => {
  assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, sort: "newest" }), [
    "recent-intune",
    "mac-jamf",
    "security-tanium"
  ]);
  assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, sort: "salary" }), [
    "security-tanium",
    "recent-intune",
    "mac-jamf"
  ]);
  assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, sort: "company" }), [
    "mac-jamf",
    "recent-intune",
    "security-tanium"
  ]);
});

await run("FEAT-018", "Tool multi-select matches any selected tool", () => {
  assertIds(
    filterJobs(filterFixtureJobs, {
      ...initialFilterState,
      selectedTools: ["Jamf", "Defender"]
    }),
    ["mac-jamf", "security-tanium"]
  );
  const next = filterReducer(initialFilterState, { type: "toggleTool", value: "Jamf" });
  assertEqual(next.selectedTools[0], "Jamf");

  assertIds(
    filterJobs(filterFixtureJobs, {
      ...initialFilterState,
      selectedTools: ["PowerShell"]
    }),
    ["recent-intune"]
  );
});

await run("FEAT-019", "Active filter chips expose removable labels and clear actions", () => {
  const items = getActiveFilterItems({
    ...initialFilterState,
    query: " Jamf ",
    locationQuery: " Remote ",
    selectedPlatforms: ["macOS"],
    selectedTools: ["Jamf"],
    workplace: "Remote",
    salaryOnly: true,
    seniority: "Senior",
    roleFamily: "Endpoint Security",
    freshness: "7",
    sort: "salary"
  });
  assertLabels(items, [
    "Search: Jamf",
    "Location: Remote",
    "Remote",
    "Salary shown",
    "Endpoint Security",
    "Last 7 days",
    "Senior",
    "Sort: Compensation",
    "macOS",
    "Jamf"
  ]);
  items.forEach((item) => assertTruthy(item.clearAction, `${item.id} missing clear action`));
});

await run("FEAT-020", "Filter state serializes to shareable URL params", () => {
  const parsed = filterStateFromSearchParams(
    new URLSearchParams(
      "q=Jamf&platforms=macOS,Nope&tools=Jamf,PowerShell,Bad&location=Austin&remote=1&salary=1&minSalary=150000&seniority=Senior&family=Endpoint%20Security&freshness=1&sort=company"
    )
  );
  assertEqual(parsed.query, "Jamf");
  assertEqual(parsed.locationQuery, "Austin");
  assertEqual(parsed.workplace, "Remote");
  assertEqual(parsed.salaryOnly, true);
  assertEqual(parsed.minimumSalary, "150000");
  assertEqual(parsed.selectedPlatforms.join(","), "macOS");
  assertEqual(parsed.selectedTools.join(","), "Jamf,PowerShell");
  assertEqual(parsed.roleFamily, "Endpoint Security");
  assertEqual(parsed.freshness, "1");
  assertEqual(parsed.sort, "company");

  const systemsAdministration = filterStateFromSearchParams(
    new URLSearchParams("family=Systems%20Administration")
  );
  assertEqual(systemsAdministration.roleFamily, "Systems Administration");
  assertArrayIncludes(roleFamilyOptions, ["Systems Administration"]);

  const merged = mergeFilterStateIntoSearchParams(
    new URLSearchParams("keep=1&locations=legacy&remote=1"),
    {
      ...initialFilterState,
      query: "Intune",
      selectedPlatforms: ["Windows"],
      salaryOnly: true,
      minimumSalary: "120000",
      freshness: "1"
    }
  );
  assertEqual(merged.get("keep"), "1");
  assertEqual(merged.get("locations"), null);
  assertEqual(merged.get("remote"), null);
  assertEqual(merged.get("q"), "Intune");
  assertEqual(merged.get("platforms"), "Windows");
  assertEqual(merged.get("salary"), "1");
  assertEqual(merged.get("minSalary"), "120000");
  assertEqual(merged.get("freshness"), "1");
});

await run("FEAT-022", "Results panel exposes count and daily refresh note", () => {
  assertIncludes(sources.resultsPanel, "endpoint opportunities");
  assertIncludes(sources.resultsPanel, "Daily refresh");
  assertIncludes(sources.resultsPanel, "totalJobs");
});

await run("FEAT-024", "Empty state offers recovery through reset filters", () => {
  assertIncludes(sources.resultsPanel, "No matching roles");
  assertIncludes(sources.resultsPanel, "Reset filters");
  assertIncludes(sources.resultsPanel, "clearFilters");
});

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

await run("FEAT-025", "Job card renders core listing details", () => {
  const jobCardText = stripHtml(jobCardMarkup);
  [
    "Audit Source",
    "Intune Endpoint Engineer",
    "Card Company",
    "Hybrid",
    "Manage ",
    "Seattle, WA",
    "Endpoint Engineering",
    "Senior",
    "Full-time"
  ].forEach((text) => assertIncludes(jobCardText, text));
});

await run("FEAT-026", "Salary pill renders accessible salary label", () => {
  assertIncludes(jobCardMarkup, "salary-pill");
  assertIncludes(jobCardMarkup, "Salary $120k-$150k");
});

await auditJobComparisonData(run);
await auditFeedSafetyData(run);
await auditJobsApiData(run);
await auditMinimumSalaryData(run);

await run("FEAT-028", "Match reasons render on job cards", () => {
  assertIncludes(jobCardMarkup, "Endpoint match reasons");
  assertIncludes(jobCardMarkup, "Intune + Autopilot");
});

await run("FEAT-029", "Platform and tool tags render on job cards", () => {
  assertIncludes(jobCardMarkup, "Matched tools and platforms");
  assertIncludes(jobCardMarkup, "Windows");
  assertIncludes(jobCardMarkup, "Autopilot");
});

await run("FEAT-035", "Toggle buttons emit explicit pressed state", () => {
  const active = renderToStaticMarkup(
    createElement(
      AuditToggleButton,
      {
        activeClassName: "active",
        inactiveClassName: "inactive",
        isActive: true,
        onClick: () => undefined
      },
      "Filter"
    )
  );
  const inactive = renderToStaticMarkup(
    createElement(
      AuditToggleButton,
      {
        activeClassName: "active",
        inactiveClassName: "inactive",
        isActive: false,
        onClick: () => undefined
      },
      "Filter"
    )
  );
  assertIncludes(active, 'aria-pressed="true"');
  assertIncludes(inactive, 'aria-pressed="false"');
  assertIncludes(active, 'type="button"');
});

await run("FEAT-036", "Static JSON feed builds without runtime fetching", () => {
  assertTruthy(feed.updatedAt, "feed missing updatedAt");
  feed.jobs.slice(0, 10).forEach(assertValidJobShape);
  assertIncludes(sources.page, "feedData as JobsFeed");
  assertNotIncludes(sources.page, "fetch(");
});

await run("FEAT-037", "Refresh workflow runs on schedule and manual dispatch", () => {
  assertIncludes(sources.workflow, 'cron: "17 11 * * *"');
  assertIncludes(sources.workflow, "workflow_dispatch");
  assertIncludes(sources.workflow, "npm run jobs:refresh");
  assertIncludes(sources.workflow, "npm run build");
  assertIncludes(sources.workflow, "git rebase FETCH_HEAD");
});

await run("FEAT-038", "Provider list and URL overrides are configurable", () => {
  assertIncludes(sources.refresh, "process.env.JOB_PROVIDERS");
  assertIncludes(sources.refresh, "process.env.JOB_PROVIDER");
  assertIncludes(sources.refresh, "JOB_${provider.toUpperCase()}_API_URL");
  assertIncludes(sources.readme, "JOB_PROVIDERS=");
  assertIncludes(sources.readme, "Override individual URLs");
});

await run("FEAT-039", "Public job-board providers are wired", () => {
  ["remoteok", "remotive", "arbeitnow", "jobicy", "muse", "adzuna"].forEach((id) =>
    assertIncludes(sources.providersPublic, `id: "${id}"`)
  );
});

await run("FEAT-040", "Direct ATS board providers are wired", () => {
  ["greenhouse", "lever", "ashby", "workable"].forEach((id) =>
    assertIncludes(sources.atsBoards, `id: "${id}"`)
  );
});

await run("FEAT-041", "Targeted company ATS providers are wired", () => {
  ["amazon", "workday", "jibe", "activate"].forEach((id) =>
    assertIncludes(sources.companyAts, `id: "${id}"`)
  );
});

await run("FEAT-042", "Optional API providers are key-gated and non-fatal", () => {
  [
    sources.techmapRss,
    sources.theirStack,
    sources.serpApi,
    sources.rapidApiDaily,
    sources.rapidApiLinkedIn,
    sources.aiDevBoard
  ].forEach((source) => assertIncludes(source, "fetchJobs"));
  assertIncludes(sources.refresh, "Skipping ${provider}");
  assertEqual(formatProviderError(new Error("provider failed")), "provider failed");
  assertEqual(formatProviderError(Object.assign(new Error("  "), { name: "ProviderQuotaError" })), "ProviderQuotaError");
  assertEqual(formatProviderError({ message: "quota exceeded", code: 429 }), "quota exceeded");
  assertEqual(formatProviderError({ code: 429, title: "Too Many Requests" }), "{\"code\":429,\"title\":\"Too Many Requests\"}");

  const serpApiJob = normalizeSerpApiGoogleJob(
    {
      job_id: "serpapi-line-break-audit",
      title: "Endpoint Engineer",
      company_name: "Audit Company",
      location: "Remote",
      description: `${"Endpoint engineering overview for a global Windows environment. ".repeat(8)}\\n\\nResponsibilities\\n\\n${"Manage Intune and Windows endpoints across the enterprise. ".repeat(10)}\\n\\nQualifications\\n\\n${"Deep endpoint engineering and PowerShell automation experience. ".repeat(10)}`,
      apply_options: [{ link: "https://example.com/jobs/serpapi-line-break-audit" }]
    },
    "endpoint engineer",
    fixedAuditNow
  );
  assertIncludes(serpApiJob?.description ?? "", "\n\n", "SerpAPI literal line breaks were flattened");
  assertNotIncludes(serpApiJob?.description ?? "", "\\n", "SerpAPI literal line-break markers remained visible");
  assertTruthy(
    serpApiJob && getExpandedDescriptionParagraphs(serpApiJob).length > 1,
    "SerpAPI description did not render as multiple paragraphs"
  );

  const flattenedDescription = [
    "Endpoint engineering overview for a global environment. ".repeat(8),
    "Manage Intune and Windows endpoints across the enterprise.",
    " Coordinate endpoint delivery with infrastructure and security teams. ".repeat(6),
    "Automate endpoint operations with PowerShell.",
    " Equal opportunity employer."
  ].join("");
  const flattenedSerpApiJob = normalizeSerpApiGoogleJob(
    {
      job_id: "serpapi-highlight-audit",
      title: "Endpoint Engineer",
      company_name: "Audit Company",
      location: "Remote",
      description: flattenedDescription,
      job_highlights: [{
        title: "Responsibilities",
        items: [
          "Manage Intune and Windows endpoints across the enterprise.",
          "Automate endpoint operations with PowerShell."
        ]
      }],
      apply_options: [{ link: "https://example.com/jobs/serpapi-highlight-audit" }]
    },
    "endpoint engineer",
    fixedAuditNow
  );
  assertTruthy(
    flattenedSerpApiJob && getExpandedDescriptionParagraphs(flattenedSerpApiJob).length > 1,
    "SerpAPI job highlights did not restore flattened description structure"
  );
  assertEqual(
    normalizeSearchText(flattenedSerpApiJob?.description ?? ""),
    normalizeSearchText(flattenedDescription),
    "SerpAPI highlight formatting changed description content"
  );

  const repeatedHighlightText = "Manage Intune endpoints. ".repeat(25);
  const ambiguousSerpApiJob = normalizeSerpApiGoogleJob(
    {
      job_id: "serpapi-ambiguous-highlight-audit",
      title: "Endpoint Engineer",
      company_name: "Audit Company",
      location: "Remote",
      description: repeatedHighlightText,
      job_highlights: [{ title: "Responsibilities", items: ["Manage Intune endpoints."] }],
      apply_options: [{ link: "https://example.com/jobs/serpapi-ambiguous-highlight-audit" }]
    },
    "endpoint engineer",
    fixedAuditNow
  );
  assertNotIncludes(
    ambiguousSerpApiJob?.description ?? "",
    "\n",
    "ambiguous SerpAPI highlights should not rewrite description structure"
  );

  for (const [jobHighlights, label] of [
    [{}, "non-array highlights"],
    [[null], "null highlight section"],
    [{ items: [null] }, "non-string highlight item"],
    [{ items: "Manage Intune endpoints." }, "non-array highlight items"]
  ] as const) {
    const malformedHighlightJob = normalizeSerpApiGoogleJob(
      {
        job_id: `serpapi-malformed-highlight-${label}`,
        title: "Endpoint Engineer",
        company_name: "Audit Company",
        location: "Remote",
        description: repeatedHighlightText,
        job_highlights: jobHighlights,
        apply_options: [{ link: "https://example.com/jobs/serpapi-malformed-highlight-audit" }]
      },
      "endpoint engineer",
      fixedAuditNow
    );
    assertEqual(
      malformedHighlightJob?.description,
      ambiguousSerpApiJob?.description,
      `${label} should preserve the original SerpAPI description`
    );
  }
});

await run("FEAT-043", "Curated jobs reserve slots and normalize reviewed listings", () => {
  assertIncludes(sources.curated, "curatedJobProvider");
  assertIncludes(sources.curated, "reserveFeedSlots");
  assertIncludes(sources.refresh, "reservedJobIds");
  const availability = { requiredText: ["Endpoint Engineer", "Example Company"] } as const;
  assertEqual(
    evaluateCuratedAvailability(availability, "<h1>Endpoint Engineer</h1><p>Example Company</p>").status,
    "available"
  );
  assertEqual(
    evaluateCuratedAvailability(availability, "Endpoint Engineer — this job is no longer available").status,
    "unavailable"
  );
  assertEqual(
    evaluateCuratedAvailability(availability, "Endpoint Engineer at another employer").status,
    "unavailable"
  );
  assertEqual(classifyCuratedHttpStatus(404, false)?.status, "unavailable");
  assertEqual(classifyCuratedHttpStatus(410, false)?.status, "unavailable");
  assertEqual(classifyCuratedHttpStatus(503, false)?.status, "unknown");
  assertEqual(classifyCuratedHttpStatus(200, true), undefined);
});

await run("FEAT-044", "Normalizer accepts endpoint roles and rejects generic software roles", () => {
  const endpointHaystack = normalizeSearchText("Endpoint engineer Intune device management");
  const powershellSysadminHaystack = normalizeSearchText(
    "Systems Administrator PowerShell automation Active Directory Windows Server"
  );
  const genericHaystack = normalizeSearchText("Backend software engineer developer platform");
  const germanEndpointHaystack = normalizeSearchText(
    "Microsoft Intune Spezialist fuer Endpoint Management und Windows Clients"
  );
  const sapDataHaystack = normalizeSearchText(
    "Functional Specialist SAP MDM MDG master data governance"
  );
  assertEqual(isEndpointRelevant(endpointHaystack, "Endpoint Engineer", deriveTools(endpointHaystack)), true);
  assertEqual(
    isEndpointRelevant(
      powershellSysadminHaystack,
      "Systems Administrator",
      deriveTools(powershellSysadminHaystack)
    ),
    true
  );
  assertEqual(isEndpointRelevant(genericHaystack, "Software Engineer", deriveTools(genericHaystack)), false);
  assertEqual(
    isEndpointRelevant(
      germanEndpointHaystack,
      "Microsoft Intune Spezialist",
      deriveTools(germanEndpointHaystack)
    ),
    true
  );
  assertEqual(
    isEndpointRelevant(
      sapDataHaystack,
      "Functional Specialist SAP MDM MDG",
      deriveTools(sapDataHaystack)
    ),
    false
  );
});

await run("FEAT-045", "Normalizer derives tools, platforms, tags, and match reasons", () => {
  const haystack = normalizeSearchText("Jamf macOS Intune Autopilot PowerShell endpoint security");
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const reasons = deriveMatchReasons(haystack, tools, platforms);
  const canonicalTools = endpointToolDefinitions.map(({ tool }) => tool);
  const systemsAdministrationRule = roleFamilyInferenceRules.find(
    (rule) => rule.family === "Systems Administration"
  );
  assertEqual(toolOptions.join(","), canonicalTools.join(","));
  assertArrayIncludes(tools, ["Jamf", "Intune", "Autopilot", "PowerShell"]);
  assertArrayIncludes(toolOptions, ["PowerShell"]);
  assertArrayIncludes(platforms, ["macOS"]);
  assertArrayIncludes(reasons, ["Jamf + macOS", "PowerShell automation"]);
  assertIncludes(sources.jobTaxonomy, "endpointToolDefinitions");
  assertIncludes(sources.jobTaxonomy, "roleFamilyInferenceRules");
  assertIncludes(sources.shared, "endpointToolDefinitions");
  assertIncludes(sources.shared, "roleFamilyInferenceRules");
  assertEqual(systemsAdministrationRule?.match, "all");
});

await run("FEAT-046", "Normalizer infers workplace, role family, seniority, and employment type", () => {
  const securityText = normalizeSearchText("senior endpoint security engineer contract remote");
  const sysadminText = normalizeSearchText(
    "senior systems administrator powershell automation active directory windows server security hardening"
  );
  assertEqual(inferWorkplace("Remote", securityText), "Remote");
  assertEqual(inferRoleFamily(securityText, ["Defender"], ["Windows"]), "Endpoint Security");
  assertEqual(inferRoleFamily(securityText, [], ["Windows"]), "Endpoint Security");
  assertEqual(inferRoleFamily(sysadminText, ["PowerShell"], ["Windows"]), "Systems Administration");
  assertEqual(inferSeniority(securityText), "Senior");
  assertEqual(inferSeniority("senior manager of it", "Senior IT Engineer"), "Senior");
  assertEqual(inferSeniority("senior manager role", "Senior IT Manager"), "Manager");
  assertEqual(inferEmploymentType(securityText), "Contract");
});

await run("FEAT-047", "Salary ranges are preserved or extracted from descriptions", () => {
  const salary = extractSalaryFromText("The annual base salary range is $120,000 to $150,000 per year.");
  assertEqual(salary?.label, "$120k-$150k");
});

await run("FEAT-048", "Descriptions are cleaned, capped, and not duplicated as summaries", () => {
  const htmlDescription = `<p>Endpoint summary.</p><p>${"Detailed endpoint management work. ".repeat(80)}</p>`;
  const description = normalizeDescription(htmlDescription);
  assertTruthy(description, "long description was dropped");
  assertNotIncludes(description ?? "", "<p>");
  assertTruthy((description ?? "").length <= 12000, "description exceeds cap");
  assertTruthy(summarize(htmlDescription).length <= 260, "summary exceeds snippet cap");
  const paragraphs = getExpandedDescriptionParagraphs(
    makeJob({
      summary: "Endpoint summary.",
      description
    })
  );
  assertTruthy(paragraphs.length > 0, "expanded paragraphs missing");
});

await run("FEAT-049", "Dedupe and stable IDs use source URLs and React job IDs", () => {
  const firstId = buildStableJobId("greenhouse", "spacex", "Endpoint Engineer", "https://example.com/a");
  const secondId = buildStableJobId("greenhouse", "spacex", "Endpoint Engineer", "https://example.com/b");
  assertNotEqual(firstId, secondId);
  const selectedJobs = selectFeedJobs([
    makeJob({
      id: "aggregated",
      source: "SerpAPI Google Jobs",
      sourceUrl: "https://aggregator.example/endpoint",
      postedAt: fixedAuditNow.toISOString(),
      fetchedAt: fixedAuditNow.toISOString()
    }),
    makeJob({
      id: "direct",
      source: "Greenhouse",
      sourceUrl: "https://boards.greenhouse.io/example/jobs/123",
      postedAt: daysAgo(3),
      fetchedAt: fixedAuditNow.toISOString()
    })
  ]);
  assertEqual(selectedJobs.length, 1);
  assertEqual(selectedJobs[0]?.id, "direct");
  assertIncludes(sources.refresh, "selectFeedJobs");
  assertIncludes(sources.resultsPanel, "key={job.id}");
});

await run("FEAT-050", "Stale filtering and result cap are enforced", () => {
  assertEqual(
    isActiveJob(
      makeJob({
        staleAfter: daysAgo(1)
      })
    ),
    false
  );
  assertIncludes(sources.refresh, "JOB_MAX_RESULTS");
  assertIncludes(sources.refresh, "limitFeedJobs");
  assertIncludes(sources.refresh, "staleAfter");
});

await run("FEAT-051", "Metadata, Open Graph, and Twitter cards are configured", () => {
  ["metadataBase", "openGraph", "twitter", "siteKeywords", "creator", "publisher", "canonical"].forEach((text) =>
    assertIncludes(sources.layout, text)
  );
  assertIncludes(sources.siteMetadata, "Endpoint Engineering Jobs", "search-focused title");
  assertIncludes(sources.siteMetadata, "specialtySearchLinks", "crawlable specialty links");
  assertIncludes(sources.topbar, "Popular endpoint job searches", "footer search navigation");
  assertIncludes(sources.jobCard, "id={`job-${job.id}`}", "stable job anchors");
  assertTruthy(existsSync("public/og-image.png"), "missing public/og-image.png");
});

await run("FEAT-052", "Home JSON-LD emits escaped collection data", () => {
  const jsonLd = getHomeJsonLd({
    ...feed,
    jobs: Array.from({ length: 25 }, (_, index) =>
      makeJob({
        id: `schema-${index}`,
        title: index === 0 ? "Endpoint <Engineer>" : `Endpoint Engineer ${index}`,
        company: "Schema Co",
        applyUrl: index === 0 ? undefined : `https://example.com/apply/${index}`,
        sourceUrl: `https://example.com/source/${index}`
      })
    )
  });
  const serialized = serializeJsonLd(jsonLd);
  assertEqual(jsonLd["@graph"].length, 6, "structured-data graph node count");
  assertIncludes(serialized, "CollectionPage");
  assertIncludes(serialized, "ItemList");
  assertIncludes(serialized, "SearchAction");
  assertIncludes(serialized, "WebApplication");
  assertIncludes(serialized, "BreadcrumbList");
  assertIncludes(serialized, '"numberOfItems":25');
  assertIncludes(serialized, "#job-schema-19");
  assertNotIncludes(serialized, "#job-schema-20", "structured listing cap");
  assertIncludes(serialized, "https://example.com/source/0", "source URL sameAs fallback");
  assertIncludes(serialized, "#popular-searches");
  assertIncludes(serialized, "\\u003cEngineer>");
});

await run("FEAT-053", "Sitemap and robots point at the canonical site", () => {
  assertIncludes(sources.sitemap, "feed.updatedAt");
  assertIncludes(sources.sitemap, "siteUrl");
  assertIncludes(sources.sitemap, "images");
  assertIncludes(sources.robots, "sitemap");
  assertIncludes(sources.robots, "Googlebot");
  assertIncludes(sources.robots, "host: siteUrl");
});

await run("FEAT-054", "Vercel Analytics is installed globally", () => {
  assertIncludes(sources.layout, "@vercel/analytics/next");
  assertIncludes(sources.layout, "<Analytics />");
  assertIncludes(sources.packageJson, "\"@vercel/analytics\"");
});

await run("FEAT-055", "React Doctor CI is configured for PRs and main", () => {
  assertIncludes(sources.reactDoctorWorkflow, "pull_request");
  assertIncludes(sources.reactDoctorWorkflow, "push");
  assertIncludes(sources.reactDoctorWorkflow, "branches: [\"main\"]");
  assertIncludes(sources.reactDoctorWorkflow, "millionco/react-doctor@v2");
  assertIncludes(sources.reactDoctorWorkflow, "cancel-in-progress: true");
});

await run("FEAT-056", "GitHub issue template captures support and feature reports", () => {
  ["Request type", "Summary", "Details", "Steps to reproduce", "Device and browser"].forEach(
    (text) => assertIncludes(sources.issueTemplate, text)
  );
  assertIncludes(sources.issueConfig, "blank_issues_enabled");
});

await run("FEAT-058", "Expanded direct ATS sources are configured", () => {
  ["spacex", "gitlab", "coinbase", "canonical", "pinterest", "block", "roblox"].forEach(
    (board) => {
      assertIncludes(sources.atsBoards, `"${board}"`, `default Greenhouse board ${board}`);
    }
  );
  assertIncludes(sources.atsBoards, '"1password"', "monitored Ashby board 1password");
  ["Booz Allen", "HP", "NVIDIA", "Adobe", "F5", "Allstate", "Gartner", "Nordic Consulting", "SHI", "Circle", "Jabil"].forEach(
    (company) => {
      assertIncludes(sources.companyAts, company, `default Workday site ${company}`);
    }
  );
  ["Chatham Financial", "Austal USA", "MBDA Italy", "Velera", "Pacific Life", "General Motors"].forEach(
    (company) => assertIncludes(sources.companyAts, company, `verified Workday site ${company}`)
  );
  assertIncludes(sources.readme, "SpaceX", "README source documentation");
  assertIncludes(sources.readme, "GitLab", "README expanded source documentation");
  assertIncludes(sources.workflow, "us,ch,it,es,fr,de", "scheduled Adzuna Germany coverage");
  assertIncludes(sources.workflow, "US,CH,IT,ES,FR,DE", "scheduled TheirStack Germany coverage");
  assertIncludes(sources.workflow, '"Germany" OR "Remote"', "scheduled LinkedIn Germany coverage");
});

await run("FEAT-059", "Confirmed-dead Adzuna listing is excluded from data and runtime active jobs", () => {
  const matchingJobs = feed.jobs.filter(
    (job) => job.sourceUrl === deadAdzunaUrl || job.id.includes("5763079616")
  );
  assertEqual(matchingJobs.length, 0, "dead Adzuna listing still exists in feed");
  assertTruthy(isExcludedJobSourceUrl(deadAdzunaUrl), "exact dead URL is not excluded");
  assertTruthy(
    isExcludedJobSourceUrl(`${deadAdzunaUrl}/#source`),
    "normalized dead URL is not excluded"
  );
  assertIncludes(sources.refresh, "JOB_EXCLUDED_SOURCE_URLS", "refresh env configuration");
  assertIncludes(sources.refresh, "isExcludedJobSourceUrl", "refresh exclusion filter");
  assertIncludes(sources.workflow, "JOB_EXCLUDED_SOURCE_URLS", "workflow exclusion env passthrough");
  assertEqual(isActiveJob(makeAdzunaJob({ sourceUrl: deadAdzunaUrl }), fixedAuditNow), false);
});

await run("FEAT-060", "Adzuna aggregator listings expire on source-specific freshness rules", () => {
  const oldFetchedJob = makeAdzunaJob({
    id: "audit-old-fetched-adzuna",
    fetchedAt: "2026-06-20T02:04:09.167Z",
    postedAt: "2026-06-27T02:04:09.167Z",
    sourceUrl: "https://www.adzuna.com/details/audit-old-fetched"
  });
  const oldPostedJob = makeAdzunaJob({
    id: "audit-old-posted-adzuna",
    fetchedAt: "2026-06-28T02:04:09.167Z",
    postedAt: "2026-05-20T02:04:09.167Z",
    sourceUrl: "https://www.adzuna.com/details/audit-old-posted"
  });
  const freshJob = makeAdzunaJob({
    id: "audit-fresh-adzuna",
    fetchedAt: "2026-06-28T02:04:09.167Z",
    postedAt: "2026-06-27T02:04:09.167Z",
    sourceUrl: "https://www.adzuna.com/details/audit-fresh"
  });

  assertTruthy(isSourceFreshnessExpired(oldFetchedJob, fixedAuditNow));
  assertTruthy(isSourceFreshnessExpired(oldPostedJob, fixedAuditNow));
  assertEqual(isSourceFreshnessExpired(freshJob, fixedAuditNow), false);
  assertEqual(isActiveJob(oldFetchedJob, fixedAuditNow), false);
  assertEqual(isActiveJob(oldPostedJob, fixedAuditNow), false);
  assertEqual(isActiveJob(freshJob, fixedAuditNow), true);
  assertIncludes(sources.jobExclusions, "maxPostedAgeDays: 30", "Adzuna posted-age cap");
  assertIncludes(sources.jobBoard, "isActiveJob(job)", "job board active feed filter");
  assertIncludes(sources.companyAts, "completedQueries", "Workday skips isolated query failures");
  assertIncludes(sources.page, "activeFeed", "home page active feed projection");
  assertIncludes(sources.page, "getHomeJsonLd(activeFeed)", "JSON-LD uses filtered active feed");
  assertIncludes(sources.packageJson, '"audit:data"', "package script for data audit");

  const activeExpiredAdzuna = feed.jobs.filter(
    (job) =>
      job.source === "Adzuna" &&
      isSourceFreshnessExpired(job, fixedAuditNow) &&
      isActiveJob(job, fixedAuditNow)
  );
  assertEqual(activeExpiredAdzuna.length, 0, "expired Adzuna jobs still active");
});

await run("FEAT-061", "Mapped count and ratio come from active job map points", () => {
  const activeJobs = feed.jobs.filter((job) => isActiveJob(job, fixedAuditNow));
  const activeJobsWithMapLocation = activeJobs.filter((job) => job.mapLocation);
  const fallbackResolvedJobs = activeJobs.filter(
    (job) => !job.mapLocation && resolveJobMapLocation(job.location)
  );
  const points = buildJobMapPoints(activeJobs);
  const mappedScenarioJob = activeJobs.find((job) => job.mapLocation);
  assertTruthy(mappedScenarioJob, "active feed has no mapped scenario job");
  const mappedLocationJobs = filterJobs(activeJobs, {
    ...initialFilterState,
    locationQuery: mappedScenarioJob?.location ?? ""
  });
  const mappedLocationPoints = buildJobMapPoints(mappedLocationJobs);

  assertTruthy(points.length > 0, "active feed has no mapped jobs");
  assertTruthy(
    points.length >= Math.floor(activeJobs.length * 0.5),
    `mapped coverage too low: ${points.length} of ${activeJobs.length}`
  );
  assertTruthy(points.length <= activeJobs.length, "mapped points exceed active jobs");
  assertEqual(points.length, activeJobsWithMapLocation.length, "map points should come from persisted mapLocation");
  assertEqual(fallbackResolvedJobs.length, 0, "active feed relies on client map-location fallback");
  assertTruthy(mappedLocationJobs.length > 0, "mapped location filter returned no jobs");
  assertTruthy(mappedLocationPoints.length > 0, "mapped location filter returned no mapped jobs");
  assertNoStaticImport(sources.jobMap, "./job-map-canvas", "map canvas should not be a static import");
  assertIncludes(sources.jobMap, "const mappedJobCount = points.length");
  assertIncludes(sources.jobMap, "{mappedJobCount} of {jobs.length}");
  assertIncludes(sources.jobMapFeatures, "buildFeatureCollection");
  assertIncludes(sources.refresh, "addResolvedMapLocation");
  assertNoStaticImport(sources.jobMapLib, "./map-location", "client map should not import resolver table");
  assertIncludes(sources.companyAts, "parseWorkdayLocationFromExternalPath");
});

await run("FEAT-062", "Per-job map points preserve duplicate-coordinate jobs", () => {
  const jobs = [
    makeJob({
      id: "map-a",
      mapLocation: { label: "Seattle, WA", latitude: 47.6062, longitude: -122.3321 }
    }),
    makeJob({
      id: "map-b",
      mapLocation: { label: "Seattle, WA", latitude: 47.6062, longitude: -122.3321 }
    }),
    makeJob({ id: "map-unmapped", mapLocation: undefined })
  ];
  const points = buildJobMapPoints(jobs);
  assertEqual(points.length, 2);
  assertEqual(new Set(points.map((point) => point.id)).size, 2);
  assertEqual(points.every((point) => point.latitude === 47.6062), true);
  assertIncludes(sources.jobMapFeatures, "buildFeatureCollection");
});

await run("FEAT-064", "Map popup content includes job details and safe apply links", () => {
  const [point] = buildJobMapPoints([
    makeJob({
      id: "popup-job",
      title: "Map Endpoint Engineer",
      company: "Map Company",
      mapLocation: { label: "Seattle, WA", latitude: 47.6062, longitude: -122.3321 },
      salary: { min: 140000, max: 160000, currency: "USD", label: "$140k-$160k" },
      applyUrl: "https://example.com/map-apply"
    })
  ]);
  const feature = buildFeatureCollection([point]).features[0];
  const preview = readJobPreview(feature);
  if (!preview) {
    throw new Error("missing popup preview");
  }
  assertEqual(preview?.title, "Map Endpoint Engineer");
  assertEqual(preview?.company, "Map Company");
  assertEqual(preview?.salary, "$140k-$160k");
  assertEqual(preview?.applyUrl, "https://example.com/map-apply");

  const markup = renderToStaticMarkup(
    createElement(JobMapPopupContent, {
      popup: {
        count: 3,
        jobs: [preview],
        key: "cluster:1:3",
        label: "3 jobs near Seattle, WA",
        latitude: 47.6062,
        longitude: -122.3321,
        type: "cluster"
      }
    })
  );
  assertIncludes(markup, "Map Endpoint Engineer");
  assertIncludes(markup, "Map Company");
  assertIncludes(markup, "$140k-$160k");
  assertIncludes(markup, "https://example.com/map-apply");
  assertIncludes(markup, 'rel="noopener noreferrer"');
  assertIncludes(markup, 'target="_blank"');
  assertIncludes(markup, "Showing 1 of 3");
});

await run("FEAT-065", "Mobile map detail sheet is wired for selected jobs", () => {
  assertIncludes(sources.jobMapCanvas, "JobMapMobileSheet");
  assertIncludes(sources.jobMapCanvas, "Close selected job");
  assertIncludes(sources.jobMapCss, ".job-map-mobile-sheet");
  assertIncludes(sources.jobMapCss, ".job-map-popup");
  assertIncludes(sources.jobMapCss, "display: none;");
  assertIncludes(sources.jobMapCss, "bottom: calc(66px + env(safe-area-inset-bottom))");
});

await run("FEAT-066", "Map visual treatment and attribution match the page", () => {
  assertIncludes(sources.jobMapCss, "--map-highlight: var(--lime)");
  assertIncludes(sources.jobMapCss, "--map-highlight-dark: var(--emerald)");
  assertIncludes(sources.jobMapCss, "border-radius: 8px");
  assertIncludes(sources.jobMapCss, ".maplibregl-canvas-container", "scoped map canvas CSS");
  assertIncludes(sources.jobMapCss, ".maplibregl-popup-anchor-bottom", "scoped map popup CSS");
  assertIncludes(sources.jobMapCss, ".maplibregl-cooperative-gesture-screen", "scoped cooperative gesture CSS");
  assertNotIncludes(sources.layout, "maplibre-gl/dist/maplibre-gl.css", "layout should not import global MapLibre CSS");
  assertIncludes(sources.jobMapConfig, "carto-dark");
  assertIncludes(sources.jobMapCanvas, "OpenStreetMap");
  assertIncludes(sources.jobMapCanvas, "CARTO");
});

await run("FEAT-067", "Provider adapter contract is shared by refresh orchestration", () => {
  ["ProviderAdapter", "ProviderFetchContext", "displayName", "defaultUrl", "fetchJobs"].forEach(
    (text) => assertIncludes(sources.providerContract, text)
  );
  assertIncludes(sources.providerContract, "reserveFeedSlots");
  assertIncludes(sources.refresh, "ProviderAdapter");
  assertIncludes(sources.refresh, "providerAdapters");
  assertIncludes(sources.refresh, "smartRecruitersProvider");
  assertIncludes(sources.refresh, "recruiteeProvider");
  assertIncludes(sources.refresh, "usaJobsProvider");
  assertIncludes(sources.smartRecruiters, 'id: "smartrecruiters"');
  assertIncludes(sources.recruitee, 'id: "recruitee"');
  assertIncludes(sources.usaJobs, 'id: "usajobs"');
});

await run("FEAT-068", "Endpoint search defaults include role and company expansion", () => {
  assertArrayIncludes(defaultEndpointSearchQueries, [
    "endpoint engineer",
    "client platform engineer",
    "powershell systems administrator",
    "powershell sysadmin",
    "intune engineer",
    "jamf engineer",
    "endpoint spezialist",
    "intune spezialist",
    "it arbeitsplatz"
  ]);
  assertArrayIncludes(powerShellSysadminSearchQueries, [
    "powershell systems administrator",
    "powershell sysadmin"
  ]);
  assertArrayIncludes(powerShellSysadminTitleFilters, [
    "PowerShell Systems Administrator",
    "PowerShell Sysadmin"
  ]);
  assertArrayIncludes(monitoredCompanyNames, ["Kandji", "CrowdStrike", "Microsoft"]);
  assertArrayIncludes(defaultCompanyJobQueries, [
    "Kandji endpoint engineer",
    "CrowdStrike endpoint engineer"
  ]);
  assertIncludes(sources.searchConfig, "defaultEndpointSearchQueries");
  assertIncludes(sources.rapidApiLinkedIn, "powerShellSysadminTitleFilters");
});

await run("FEAT-069", "Map location resolver maps known places and skips ambiguous rows", () => {
  assertEqual(resolveJobMapLocation("San Francisco, CA")?.label, "San Francisco, CA");
  assertEqual(resolveJobMapLocation("Berlin, Germany")?.label, "Berlin, Germany");
  assertEqual(resolveJobMapLocation("München, Deutschland")?.label, "Munich, Germany");
  assertEqual(resolveJobMapLocation("Germany")?.label, "Germany");
  for (const [location, label] of [
    ["Frankfurt am Main, Germany", "Frankfurt, Germany"],
    ["Köln, Deutschland", "Cologne, Germany"],
    ["Stuttgart, Germany", "Stuttgart, Germany"],
    ["Düsseldorf, Germany", "Düsseldorf, Germany"]
  ] as const) {
    assertEqual(resolveJobMapLocation(location)?.label, label);
  }
  assertEqual(resolveJobMapLocation("NYC")?.label, "New York, NY");
  assertEqual(resolveJobMapLocation("United States")?.label, "United States");
  assertEqual(resolveJobMapLocation("Hawthorne, CA")?.label, "Los Angeles, CA");
  assertEqual(resolveJobMapLocation("Jacks Cabin, Gunnison County")?.label, "Denver, CO");
  assertEqual(resolveJobMapLocation("Newark, New Castle County")?.label, "Wilmington, DE");
  assertEqual(resolveJobMapLocation("Paris, France")?.label, "Paris, France");
  assertEqual(resolveJobMapLocation("La-Madeleine, Lille")?.label, "Lille, France");
  assertEqual(resolveJobMapLocation("Toulouse, Haute-Garonne")?.label, "Toulouse, France");
  assertEqual(resolveJobMapLocation("Hérault, Occitanie")?.label, "Montpellier, France");
  assertEqual(resolveJobMapLocation("Barcelona, Spain")?.label, "Barcelona, Spain");
  assertEqual(resolveJobMapLocation("Albacete")?.label, "Albacete, Spain");
  assertEqual(resolveJobMapLocation("Vitoria-Gasteiz, Alava")?.label, "Vitoria-Gasteiz, Spain");
  assertEqual(resolveJobMapLocation("España")?.label, "Spain");
  assertEqual(resolveJobMapLocation("Milano, Italia")?.label, "Milan, Italy");
  assertEqual(resolveJobMapLocation("Zürich")?.label, "Zurich, Switzerland");
  assertEqual(resolveJobMapLocation("Fehraltorf (Zurich), Switzerland")?.label, "Zurich, Switzerland");
  assertEqual(resolveJobMapLocation("Köniz, Bern-Mittelland")?.label, "Bern, Switzerland");
  assertEqual(resolveJobMapLocation("Zollikofen, Bern-Mittelland")?.label, "Bern, Switzerland");
  assertEqual(resolveJobMapLocation("Basel (City)")?.label, "Basel, Switzerland");
  assertEqual(resolveJobMapLocation("Genf")?.label, "Geneva, Switzerland");
  assertEqual(resolveJobMapLocation("Kriens, Luzern-Land")?.label, "Lucerne, Switzerland");
  assertEqual(resolveJobMapLocation("Le Mont-sur-Lausanne, Lausanne")?.label, "Lausanne, Switzerland");
  assertEqual(resolveJobMapLocation("Switzerland")?.label, "Switzerland");
  assertEqual(resolveJobMapLocation("12 locations"), undefined);
  assertIncludes(sources.mapLocation, "locationCoordinates");
  assertIncludes(sources.mapLocation, "searchableLocationCoordinates");
  assertIncludes(sources.mapLocation, "normalizedKeys");
  assertIncludes(sources.shared, "resolveJobMapLocation(location)");
});

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

async function readSources() {
  const loaded = {} as Record<SourceKey, string>;

  await Promise.all(
    Object.entries(sourcePaths).map(async ([key, path]) => {
      loaded[key as SourceKey] = await readText(path);
    })
  );

  return loaded;
}

async function readText(path: string) {
  return readFile(path, "utf8");
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

function parseCsv(value: string): CsvRow[] {
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

function assertIncludes(value: string, expected: string, label?: string) {
  if (!value.includes(expected)) {
    throw new Error(`${label ?? "value"} does not include ${expected}`);
  }
}

function assertNotIncludes(value: string, unexpected: string, label?: string) {
  if (value.includes(unexpected)) {
    throw new Error(`${label ?? "value"} unexpectedly includes ${unexpected}`);
  }
}

function assertNoStaticImport(value: string, modulePath: string, label: string) {
  const escapedModulePath = modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const staticImportPattern = new RegExp(
    `import\\s+(?:[^"'();]+?\\s+from\\s+)?["']${escapedModulePath}["']`
  );

  if (staticImportPattern.test(value)) {
    throw new Error(label);
  }
}

function assertTruthy(value: unknown, message = "expected truthy value") {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertNotEqual<T>(actual: T, expected: T, message?: string) {
  if (actual === expected) {
    throw new Error(message ?? `did not expect ${String(expected)}`);
  }
}

function assertIds(jobs: Job[], expectedIds: string[]) {
  assertEqual(jobs.map((job) => job.id).join(","), expectedIds.join(","));
}

function assertLabels(items: Array<{ label: string }>, expectedLabels: string[]) {
  assertEqual(items.map((item) => item.label).join("|"), expectedLabels.join("|"));
}

function assertArrayIncludes<T>(actual: readonly T[], expectedValues: readonly T[]) {
  for (const value of expectedValues) {
    if (!actual.includes(value)) {
      throw new Error(`expected ${JSON.stringify(actual)} to include ${String(value)}`);
    }
  }
}

function assertValidJobShape(job: Job) {
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

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function makeAdzunaJob(overrides: Partial<Job> = {}): Job {
  return makeJob({
    source: "Adzuna",
    sourceUrl: "https://www.adzuna.com/details/audit-fresh",
    applyUrl: "https://www.adzuna.com/details/audit-fresh",
    attributionLabel: "Adzuna",
    ...overrides
  });
}

function makeJob(overrides: Partial<Job> = {}): Job {
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
