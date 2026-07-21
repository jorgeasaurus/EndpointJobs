import {
  getExpandedDescriptionParagraphs
} from "../../src/lib/jobs";
import {
  defaultCompanyJobQueries,
  defaultEndpointSearchQueries,
  monitoredCompanyNames,
  powerShellSysadminSearchQueries,
  powerShellSysadminTitleFilters
} from "../job-refresh/search-config";
import {
  formatProviderError,
  normalizeSearchText
} from "../job-refresh/shared";
import {
  classifyCuratedHttpStatus,
  evaluateCuratedAvailability
} from "../job-refresh/providers/curated-jobs";
import { normalizeSerpApiGoogleJob } from "../job-refresh/providers/serpapi";

import {
  assertArrayIncludes,
  assertEqual,
  assertIncludes,
  assertNotIncludes,
  assertTruthy,
  fixedAuditNow,
  type AuditContext
} from "./shared";

export async function auditProviders({ run, sources }: AuditContext) {
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

  await run("FEAT-058", "Expanded direct ATS sources are configured", () => {
    ["spacex", "gitlab", "coinbase", "canonical", "pinterest", "block", "roblox"].forEach(
      (board) => {
        assertIncludes(sources.atsBoards, `"${board}"`, `default Greenhouse board ${board}`);
      }
    );
    assertIncludes(sources.atsBoards, '"1password"', "monitored Ashby board 1password");
    ["Booz Allen", "HP", "NVIDIA", "Adobe", "F5", "Allstate", "Gartner", "Nordic Consulting", "SHI", "Circle", "Jabil"].forEach(
      (company) => {
        assertIncludes(sources.workdaySites, company, `default Workday site ${company}`);
      }
    );
    ["Chatham Financial", "Austal USA", "MBDA Italy", "Velera", "Pacific Life", "General Motors", "GEICO"].forEach(
      (company) => assertIncludes(sources.workdaySites, company, `verified Workday site ${company}`)
    );
    assertIncludes(sources.readme, "SpaceX", "README source documentation");
    assertIncludes(sources.readme, "GitLab", "README expanded source documentation");
    assertIncludes(sources.workflow, "us,ch,it,es,fr,de", "scheduled Adzuna Germany coverage");
    assertIncludes(sources.workflow, "US,CH,IT,ES,FR,DE", "scheduled TheirStack Germany coverage");
    assertIncludes(sources.workflow, '"Germany" OR "Remote"', "scheduled LinkedIn Germany coverage");
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
    assertIncludes(sources.workflow, "JOB_SERPAPI_COUNTRIES: us,au");
    const serpApiAuQueries = sources.workflow.match(/JOB_SERPAPI_AU_QUERIES:\s*([^\n]+)/)?.[1];
    const serpApiAuLocations = sources.workflow.match(/JOB_SERPAPI_AU_LOCATIONS:\s*([^\n]+)/)?.[1];
    assertEqual(new Set([...defaultEndpointSearchQueries, ...defaultCompanyJobQueries]).size, 66);
    assertEqual(serpApiAuQueries, "endpoint engineer");
    assertEqual(serpApiAuLocations?.split("|").length, 2);
    assertIncludes(sources.workflow, 'JOB_SERPAPI_US_QUERY_LIMIT: "26"');
    assertIncludes(sources.workflow, "JOB_SERPAPI_ROTATION_INDEX: ${{ github.run_number }}");
    assertIncludes(sources.workflow, 'JOB_SERPAPI_MAX_SEARCHES_PER_RUN: "28"');
    assertIncludes(sources.workflow, 'JOB_SERPAPI_MONTHLY_RESERVE: "100"');
    assertIncludes(sources.workflow, 'JOB_SERPAPI_QUOTA_PREFLIGHT: "true"');
  });
}
