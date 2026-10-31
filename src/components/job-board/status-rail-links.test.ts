import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { BoardMetrics } from "@/lib/board-page";
import { initialFilterState, filterReducer, type FilterState } from "./filter-model";
import { filterStateFromLocation } from "./filter-url";
import { CommandStatusRail } from "./status-rail";
import {
  boardStatFilterAction,
  boardStatFilterHref,
  type BoardStatFilter
} from "./status-rail-links";

const router = {
  bfcacheId: "audit",
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {}
};

const metrics: BoardMetrics = {
  mappedJobsCount: 2,
  remoteJobsCount: 3,
  salaryJobsCount: 1,
  leadershipJobsCount: 1,
  seniorityCounts: {
    Associate: 0,
    Mid: 2,
    Senior: 1,
    Staff: 0,
    Lead: 0,
    Manager: 1
  },
  topLocations: [
    { metroArea: "Austin, TX", count: 2 },
    { metroArea: "Seattle, WA", count: 1 }
  ],
  toolCounts: [
    { tool: "Intune", count: 2 },
    { tool: "Workspace ONE", count: 1 },
    { tool: "Kandji", count: 1 }
  ]
};

function assertHrefMapsToFilter(filters: FilterState, stat: BoardStatFilter, currentSearch = "") {
  const href = boardStatFilterHref(filters, stat, currentSearch);
  const url = new URL(href, "https://endpointjobs.dev");
  const parsed = filterStateFromLocation(url.pathname, url.searchParams);
  const expected = filterReducer(filters, boardStatFilterAction(filters, stat));

  assert.deepEqual(parsed, expected);
  return url;
}

test("stat links apply and clear the existing board filters", () => {
  const searching: FilterState = { ...initialFilterState, query: "jamf" };

  const salary = assertHrefMapsToFilter(initialFilterState, { type: "salary" });
  assert.equal(salary.pathname, "/board");
  assert.equal(salary.searchParams.get("salary"), "1");

  const salaryOff = assertHrefMapsToFilter(
    { ...initialFilterState, salaryOnly: true },
    { type: "salary" }
  );
  assert.equal(salaryOff.searchParams.get("salary"), null);

  const leadership = assertHrefMapsToFilter(searching, { type: "leadership" });
  assert.equal(leadership.searchParams.get("q"), "jamf");
  assert.equal(leadership.searchParams.get("leadership"), "1");

  const seniority = assertHrefMapsToFilter(searching, { type: "seniority", seniority: "Senior" });
  assert.equal(seniority.searchParams.get("seniority"), "Senior");
  assert.equal(seniority.searchParams.get("q"), "jamf");

  const seniorityOff = assertHrefMapsToFilter(
    { ...initialFilterState, seniority: "Senior" },
    { type: "seniority", seniority: "Senior" }
  );
  assert.equal(seniorityOff.searchParams.get("seniority"), null);

  const metro = assertHrefMapsToFilter(initialFilterState, { type: "metro", metroArea: "Austin, TX" });
  assert.equal(metro.searchParams.get("metroAreas"), "Austin, TX");

  const metroOff = assertHrefMapsToFilter(
    { ...initialFilterState, selectedMetroAreas: ["Austin, TX"] },
    { type: "metro", metroArea: "Austin, TX" }
  );
  assert.equal(metroOff.searchParams.get("metroAreas"), null);

  const addedMetro = assertHrefMapsToFilter(
    { ...initialFilterState, selectedMetroAreas: ["Austin, TX"] },
    { type: "metro", metroArea: "Seattle, WA" }
  );
  assert.equal(addedMetro.searchParams.get("metroAreas"), "Austin, TX|Seattle, WA");

  const tool = assertHrefMapsToFilter(searching, { type: "tool", tool: "Intune" });
  assert.equal(tool.pathname, "/intune");
  assert.equal(tool.searchParams.get("tools"), null);
  assert.equal(tool.searchParams.get("q"), "jamf");

  const workspace = assertHrefMapsToFilter(initialFilterState, { type: "tool", tool: "Workspace ONE" });
  assert.equal(workspace.pathname, "/workspace-one");

  const secondTool = assertHrefMapsToFilter(
    { ...initialFilterState, selectedTools: ["Intune"] },
    { type: "tool", tool: "Jamf" }
  );
  assert.equal(secondTool.pathname, "/board");
  assert.equal(secondTool.searchParams.get("tools"), "Intune,Jamf");

  const toolOff = assertHrefMapsToFilter(
    { ...initialFilterState, selectedTools: ["Intune"] },
    { type: "tool", tool: "Intune" }
  );
  assert.equal(toolOff.pathname, "/board");
  assert.equal(toolOff.search, "");

  const preserved = assertHrefMapsToFilter(
    initialFilterState,
    { type: "leadership" },
    "utm_source=test&remote=1"
  );
  assert.equal(preserved.searchParams.get("utm_source"), "test");
  assert.equal(preserved.searchParams.get("leadership"), "1");
  assert.equal(preserved.searchParams.get("remote"), null);
});

test("status rail links the filterable figures and leaves the others static", () => {
  const html = renderRail(initialFilterState);

  assert.match(html, /<div class="status-meter"><div><span>Mapped<\/span><strong>2<\/strong>/);
  assert.match(html, /<div class="status-meter"><div><span>Remote \/ hybrid<\/span><strong>3<\/strong>/);
  assert.equal(html.includes("Filter by Mapped"), false);
  assert.equal(html.includes("Filter by Remote / hybrid"), false);

  assert.match(html, /href="\/board\?salary=1"/);
  assert.match(html, /aria-label="Filter by Salary shown, 1 of 4 jobs"/);
  assert.match(html, /aria-label="Filter by Leadership, 1 of 4 jobs"/);
  assert.match(html, /href="\/board\?leadership=1"/);
  assert.match(html, /href="\/board\?seniority=Mid"/);
  assert.match(html, /href="\/board\?seniority=Senior"/);
  assert.match(html, /href="\/board\?seniority=Manager"/);
  assert.equal(html.includes("seniority=Associate"), false);
  assert.equal(html.includes(">Staff<"), false);
  assert.match(html, /href="\/board\?metroAreas=Austin%2C\+TX"/);
  assert.match(html, /aria-label="Filter by Austin, TX, 2 of 4 jobs"/);
  assert.match(html, /href="\/intune"/);
  assert.match(html, /href="\/workspace-one"/);
  assert.match(html, /aria-label="Filter by Kandji\/Iru, 1 of 4 jobs"/);
  assertBreakdownsCollapsed(html);
  assert.ok(html.indexOf("Filter by Salary shown") < html.indexOf("status-section"));

  const active = renderRail({ ...initialFilterState, seniority: "Senior", salaryOnly: true });
  assert.match(active, /aria-current="true"/);
  assert.match(active, /aria-label="Remove Senior filter, 1 of 4 jobs"/);
  assert.match(active, /aria-label="Remove Salary shown filter, 1 of 4 jobs"/);
  assert.match(active, /href="\/board\?salary=1&amp;seniority=Mid"/);
  assertBreakdownsCollapsed(active);

  const open = renderRail(initialFilterState, true);
  for (const label of ["Leadership", "Seniority", "Top metros", "Jobs per tool"]) {
    const button = open.match(
      new RegExp(`<button\\b([^>]*)>\\s*<span>${label}</span><span class="sr-only"> breakdown</span>`)
    );
    assert.ok(button, label);
    assert.match(button[1], /aria-expanded="true"/);
  }
  assert.equal(open.includes("status-section-panel\" hidden"), false);
});

test("clickable stat rows and breakdown toggles expose a visible focus style", () => {
  const css = readFileSync(new URL("../../app/job-board.css", import.meta.url), "utf8");
  assert.match(css, /a\.status-meter:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--lime\)/);
  assert.match(css, /\.status-section-toggle\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.status-section-toggle:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--lime\)/);
  assert.match(css, /\.status-section-panel:not\(\[hidden\]\)\s*\{[^}]*display:\s*grid/);
});

function assertBreakdownsCollapsed(html: string) {
  for (const label of ["Leadership", "Seniority", "Top metros", "Jobs per tool"]) {
    const button = html.match(
      new RegExp(`<button\\b([^>]*)>\\s*<span>${label}</span><span class="sr-only"> breakdown</span>`)
    );
    assert.ok(button, label);
    assert.match(button[1], /type="button"/);
    assert.match(button[1], /aria-expanded="false"/);
    assert.match(button[1], /aria-controls="[^"]+"/);
  }
  assert.equal(html.match(/class="status-section-panel" hidden=""/g)?.length, 4);
}

function renderRail(filters: FilterState, breakdownsOpen = false) {
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: router },
      createElement(CommandStatusRail, {
        activeJobsCount: 4,
        breakdownsOpen,
        filters,
        metrics,
        onFilter() {},
        visibleJobsCount: 4
      })
    )
  );
}
