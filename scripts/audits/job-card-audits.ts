import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { formatUpdatedAt, isActiveJob } from "../../src/lib/jobs";
import { JobContextCards } from "../../src/components/job-board/job-context-cards";
import { WorkplaceFilters } from "../../src/components/job-board/location-filters";
import { MatchRecommendation } from "../../src/components/job-board/match-recommendation";
import { ToolChips } from "../../src/components/job-board/tool-chips";
import { JobMapCanvasLoading } from "../../src/components/job-board/job-map-loading";

import {
  assertEqual,
  assertIncludes,
  assertNotEqual,
  assertNotIncludes,
  assertTruthy,
  AuditToggleButton,
  stripHtml,
  type AuditContext
} from "./shared";

export async function auditJobCards({ feed, jobCardMarkup, run, sources }: AuditContext) {
  await run("FEAT-001", "Static job board loads from active feed data", () => {
    assertTruthy(feed.jobs.length > 0, "feed has no jobs");
    assertTruthy(feed.jobs.some((job) => isActiveJob(job)), "feed has no active jobs");
    assertIncludes(sources.page, "import feedData from \"@/data/jobs.json\"");
    assertIncludes(sources.page, "<JobBoard feed={activeFeed} />");
  });

  await run("FEAT-002", "Topbar brand and documentation links are present", () => {
    assertIncludes(sources.topbar, "href=\"/\"");
    assertIncludes(sources.topbar, "Endpoint Jobs home");
    assertIncludes(sources.topbar, "Endpoint Jobs");
    assertIncludes(
      sources.topbar,
      "https://github.com/jorgeasaurus/EndpointJobs/blob/main/powershell/EndpointJobs/README.md"
    );
    assertIncludes(sources.topbar, "Open PowerShell module documentation on GitHub");
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

  await run("FEAT-028", "Match reasons render on job cards", () => {
    assertIncludes(jobCardMarkup, "match-recommendation");
    assertIncludes(jobCardMarkup, "Why this role is included");
    assertIncludes(jobCardMarkup, "4 signals");
    assertIncludes(jobCardMarkup, "View 1 more");
    assertIncludes(jobCardMarkup, "Intune + Autopilot");
    assertIncludes(jobCardMarkup, "Device management");
    assertNotIncludes(jobCardMarkup, "confidence");

    const singleSignalMarkup = renderToStaticMarkup(
      createElement(MatchRecommendation, { reasons: ["Endpoint engineering"] })
    );
    assertIncludes(singleSignalMarkup, "1 signal");
    assertNotIncludes(singleSignalMarkup, "1 signals");
  });

  await run("FEAT-029", "Platform and tool tags render on job cards", () => {
    assertIncludes(jobCardMarkup, "Matched tools and platforms");
    assertIncludes(jobCardMarkup, "Windows");
    assertIncludes(jobCardMarkup, "Autopilot");
    assertIncludes(jobCardMarkup, "Platform: Windows");
    assertIncludes(jobCardMarkup, "Tool: Autopilot");
    assertIncludes(jobCardMarkup, 'role="group"');

    const sourceJob = feed.jobs[0];
    assertTruthy(sourceJob, "feed needs a source-link fixture");
    if (!sourceJob) return;
    const unsafeSourceMarkup = renderToStaticMarkup(
      createElement(JobContextCards, {
        job: { ...sourceJob, sourceUrl: "javascript:alert(1)" }
      })
    );
    assertNotIncludes(unsafeSourceMarkup, "View source listing");
    assertNotIncludes(unsafeSourceMarkup, 'href="javascript:');

    const normalizedSourceMarkup = renderToStaticMarkup(
      createElement(JobContextCards, {
        job: { ...sourceJob, sourceUrl: "https://EXAMPLE.com:443/jobs" }
      })
    );
    assertIncludes(normalizedSourceMarkup, 'href="https://example.com/jobs"');
    assertNotIncludes(normalizedSourceMarkup, "EXAMPLE.com:443");

    const groupedChipsMarkup = renderToStaticMarkup(
      createElement(ToolChips, {
        platforms: ["Windows"],
        tools: ["Intune"],
        variant: "grouped"
      })
    );
    assertIncludes(groupedChipsMarkup, "<h4>Platforms</h4>");
    assertIncludes(groupedChipsMarkup, "<h4>Tools</h4>");
    assertNotIncludes(groupedChipsMarkup, "<h3>");
  });

  await run("QA-022", "Facet counts and technology overflow use grammatical labels", () => {
    const workplaceMarkup = renderToStaticMarkup(
      createElement(WorkplaceFilters, {
        dispatch: () => undefined,
        workplace: "Any",
        workplaceCounts: { Any: 1, Remote: 0, Hybrid: 0, "On-site": 0 }
      })
    );
    assertIncludes(workplaceMarkup, 'aria-label="1 role"');
    assertNotIncludes(workplaceMarkup, 'aria-label="1 roles"');

    const overflowMarkup = renderToStaticMarkup(
      createElement(ToolChips, {
        platforms: ["Windows"],
        tools: ["Intune"],
        limit: 1
      })
    );
    assertIncludes(overflowMarkup, "1 additional technology; open job details to view");
    assertNotIncludes(overflowMarkup, "1 additional technologies");
  });

  await run("FEAT-077", "Technology chips stay compact and disclose overflow", () => {
    const denseJob = feed.jobs.find((job) => job.platforms.length + job.tools.length > 8);
    assertTruthy(denseJob, "feed needs a technology-dense listing fixture");
    if (!denseJob) return;

    const markup = renderToStaticMarkup(
      createElement(ToolChips, {
        platforms: denseJob.platforms,
        tools: denseJob.tools
      })
    );
    const hiddenCount = denseJob.platforms.length + denseJob.tools.length - 8;
    assertIncludes(markup, `+${hiddenCount} more`);
    assertIncludes(
      markup,
      `${hiddenCount} additional ${hiddenCount === 1 ? "technology" : "technologies"}`
    );
  });

  await run("FEAT-079", "Map fallback exposes one busy loading status", () => {
    const markup = renderToStaticMarkup(createElement(JobMapCanvasLoading));
    assertIncludes(markup, 'aria-busy="true"');
    assertIncludes(markup, 'role="status"');
    assertIncludes(markup, "Loading map");
    assertIncludes(markup, "beautiful-loading-state--orbit");
    assertEqual((markup.match(/role="status"/g) ?? []).length, 1);
    assertIncludes(sources.jobMap, 'import { JobMapCanvasLoading } from "./job-map-loading"');
    assertIncludes(sources.jobMap, "loading: () => <JobMapCanvasLoading />");
    assertIncludes(sources.jobBoardPrimitivesCss, "color: var(--white-60)");
    assertIncludes(sources.jobBoardPrimitivesCss, "@supports ((-webkit-background-clip: text) or (background-clip: text))");
    assertIncludes(sources.jobBoardPrimitivesCss, "-webkit-background-clip: text");
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
}
