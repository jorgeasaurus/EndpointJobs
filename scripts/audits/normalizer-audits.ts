import {
  getExpandedDescriptionParagraphs,
  isActiveJob,
  toolOptions
} from "../../src/lib/jobs";
import {
  endpointToolDefinitions,
  roleFamilyInferenceRules
} from "../../src/lib/job-taxonomy";
import { selectFeedJobs } from "../job-refresh/job-selection";
import {
  buildStableJobId,
  deriveMatchReasons,
  derivePlatforms,
  deriveTools,
  extractSalaryFromText,
  inferEmploymentType,
  inferRoleFamily,
  inferSeniority,
  inferWorkplace,
  isEndpointRelevant,
  normalizeDescription,
  normalizeSearchText,
  summarize
} from "../job-refresh/shared";

import {
  assertArrayIncludes,
  assertEqual,
  assertIncludes,
  assertNotEqual,
  assertNotIncludes,
  assertTruthy,
  daysAgo,
  fixedAuditNow,
  makeJob,
  type AuditContext
} from "./shared";

export async function auditNormalizers({ run, sources }: AuditContext) {
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
    const corporateTaxHaystack = normalizeSearchText(
      "Business Systems Engineer Tax Technology Corporate Engineering & IT Oracle ERP tax compliance"
    );
    const corporateEndpointHaystack = normalizeSearchText(
      "Senior Client Platform Engineer Corporate Engineering Intune Windows device management"
    );
    const corporateWorkdayHaystack = normalizeSearchText(
      "Senior Platform Engineer Corporate Engineering & IT Workday payroll finance integrations"
    );
    const corporateFinanceDataHaystack = normalizeSearchText(
      "Staff Data Engineer Corporate Engineering financial systems ERP treasury accounting tax warehouse"
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
    assertEqual(
      isEndpointRelevant(
        corporateTaxHaystack,
        "Business Systems Engineer, Tax Technology",
        deriveTools(corporateTaxHaystack)
      ),
      false
    );
    assertEqual(
      isEndpointRelevant(
        corporateEndpointHaystack,
        "Senior Client Platform Engineer, Windows",
        deriveTools(corporateEndpointHaystack)
      ),
      true
    );
    assertEqual(
      isEndpointRelevant(
        corporateWorkdayHaystack,
        "Senior Platform Engineer, Workday Extend & Integrations",
        deriveTools(corporateWorkdayHaystack)
      ),
      false
    );
    assertEqual(
      isEndpointRelevant(
        corporateFinanceDataHaystack,
        "Staff Data Engineer, Corporate Engineering",
        deriveTools(corporateFinanceDataHaystack)
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

    // Case-sensitive regression: the summary-prefix trim must match original
    // casing, so a description starting with an uppercase summary still strips.
    const uppercaseSummary = "Endpoint Summary With Capitals.";
    const tail = "Additional detail about endpoint management work. ".repeat(8);
    const prefixedParagraphs = getExpandedDescriptionParagraphs(
      makeJob({
        summary: uppercaseSummary,
        description: `${uppercaseSummary} ${tail}`
      })
    );
    assertTruthy(prefixedParagraphs.length > 0, "case-sensitive prefix trim failed");
    assertTruthy(
      !prefixedParagraphs[0]?.startsWith(uppercaseSummary),
      "summary prefix was not trimmed"
    );
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
    assertIncludes(sources.refresh, "defaultMaxJobs = 1000");
    assertIncludes(sources.workflow, 'JOB_MAX_RESULTS: "1000"');
    assertIncludes(sources.refresh, "limitFeedJobs");
    assertIncludes(sources.refresh, "staleAfter");
  });
}
