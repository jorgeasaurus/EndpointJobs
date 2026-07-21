import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { formatUpdatedAt, isActiveJob } from "../../src/lib/jobs";

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
}
