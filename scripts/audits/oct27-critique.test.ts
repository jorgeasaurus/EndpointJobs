import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as esbuild from "esbuild";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

import { initialFilterState } from "../../src/components/job-board/filter-model";
import { DescriptionContent } from "../../src/components/job-board/description-content";
import { queryBoardPage, selectLandingPreview } from "../../src/lib/board-page";
import { isDescriptionHeading, repairJobDescription, toDescriptionBlocks } from "../../src/lib/job-description";
import { getCardPostedLabel } from "../../src/lib/jobs";
import { cardSourceLabels, dedupeJobLead, isBoilerplateListingText } from "../../src/lib/listing-copy";
import { hasListedSalary, hasShownSalary } from "../../src/lib/shown-salary";
import { makeJob } from "./shared";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const srcRoot = fileURLToPath(new URL("../../src/", import.meta.url));

const adzunaPreview = "Adzuna listing preview for Experis: Kanton Genf, Schweiz · Unknown · Windows platform · macOS platform. Full description is available on the source posting.";

test("boilerplate listings are detected by structure, not one exact sentence", () => {
  assert.equal(isBoilerplateListingText(adzunaPreview), true);
  assert.equal(
    isBoilerplateListingText("Job posting preview for Northwind. The complete description is on the original posting."),
    true
  );
  assert.equal(
    isBoilerplateListingText("Listing preview for Contoso. A description is available on the employer site."),
    true
  );
  assert.equal(isBoilerplateListingText("Adzuna listing preview for Experis"), false);
  assert.equal(
    isBoilerplateListingText("We are hiring an endpoint engineer to manage Intune, Autopilot, and Windows devices for the company."),
    false
  );
  assert.equal(isBoilerplateListingText("Full description is available on the source posting."), false);
});

test("source headings render as text headings and list items stay marked", () => {
  const blocks = toDescriptionBlocks([
    "Key responsibilities",
    "",
    "Endpoint management (Microsoft Intune)",
    "",
    "- Design, build and maintain Intune configuration profiles.",
    "",
    "- Automate device, app and policy management.",
    "",
    "Qualifications",
    "",
    "-",
    " Scripting: strong PowerShell skills."
  ].join("\n"));

  assert.equal(isDescriptionHeading("Key responsibilities"), true);
  assert.equal(isDescriptionHeading("Endpoint management (Microsoft Intune)"), true);
  assert.equal(isDescriptionHeading("This is a full-time remote position that can be located anywhere in the U.S"), false);
  assert.deepEqual(blocks[0], { type: "heading", text: "Key responsibilities" });
  assert.deepEqual(blocks[1], { type: "heading", text: "Endpoint management (Microsoft Intune)" });
  assert.equal(blocks[2]?.type, "list");
  if (blocks[2]?.type === "list") {
    assert.deepEqual(blocks[2].items.slice(0, 2), [
      "Design, build and maintain Intune configuration profiles.",
      "Automate device, app and policy management."
    ]);
  }
  assert.deepEqual(blocks.at(-2), { type: "heading", text: "Qualifications" });
  assert.equal(blocks.at(-1)?.type, "list");

  const html = renderToStaticMarkup(createElement(DescriptionContent, { blocks }));
  assert.match(html, /<h3 class="description-heading">Key responsibilities<\/h3>/);
  assert.match(html, /<h3 class="description-heading">Endpoint management \(Microsoft Intune\)<\/h3>/);
  assert.match(html, /<ul class="description-list">/);
  assert.match(html, /<li>Design, build and maintain Intune configuration profiles\.<\/li>/);
  assert.equal(html.includes("dangerouslySetInnerHTML"), false);
  assert.equal(html.includes("<script"), false);

  const hostile = toDescriptionBlocks(repairJobDescription(
    "<h3><script>alert(1)</script>Key responsibilities</h3><ul><li>Deploy Intune</li><li><img src=x onerror=alert(1)>Review</li></ul>"
  ));
  const hostileHtml = renderToStaticMarkup(createElement(DescriptionContent, { blocks: hostile }));
  assert.equal(hostileHtml.includes("alert(1)"), false);
  assert.equal(hostileHtml.includes("onerror"), false);
  assert.match(hostileHtml, /Key responsibilities/);
  assert.match(hostileHtml, /Deploy Intune/);
});

test("a repeated lead is collapsed and dropped when the description body already contains it", () => {
  const summary = "Company Overview At Enlyte, we combine innovative technology, clinical expertise, and human compassion to help people recover after workplace injuries or auto accidents. Company Overview At Enlyte, we combine innovative technology, clinical expertise, and...";
  const kept = dedupeJobLead(summary, "Be part of a team that makes a real difference.");
  assert.equal(kept.match(/Company Overview At Enlyte/g)?.length, 1);
  assert.equal(kept.includes("..."), false);

  const dropped = dedupeJobLead(
    summary,
    "Company Overview At Enlyte, we combine innovative technology, clinical expertise, and human compassion to help people recover after workplace injuries or auto accidents."
  );
  assert.equal(dropped, "");
});

test("card dates use one relative label and unknown ingest dates stay unknown", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");
  assert.equal(getCardPostedLabel(makeJob({
    postedAt: "2026-10-25T12:00:00.000Z",
    fetchedAt: "2026-10-27T11:00:00.000Z"
  }), now), "2d ago");
  assert.equal(getCardPostedLabel(makeJob({
    postedAt: "2026-10-27T09:00:00.000Z",
    fetchedAt: "2026-10-27T11:00:00.000Z"
  }), now), "3h ago");
  assert.equal(getCardPostedLabel(makeJob({
    postedAt: "2026-10-27T11:00:00.000Z",
    fetchedAt: "2026-10-27T11:00:00.000Z",
    tags: ["Full-time"]
  }), now), "Date unknown");
});

test("a card keeps one source name", () => {
  assert.deepEqual(cardSourceLabels("Arbeitnow", "Arbeitnow"), { badge: "Arbeitnow", detail: undefined });
  assert.deepEqual(cardSourceLabels("Adzuna", "Adzuna"), { badge: "Adzuna", detail: undefined });
  assert.deepEqual(cardSourceLabels("SerpAPI Google Jobs", "Google Jobs via SerpAPI"), {
    badge: "SerpAPI Google Jobs",
    detail: undefined
  });
  assert.deepEqual(cardSourceLabels("Greenhouse", "Greenhouse / Anduril"), {
    badge: undefined,
    detail: "Greenhouse / Anduril"
  });
});

test("the salary stat counts assumed currencies and the newest preview does not", () => {
  const stated = makeJob({
    id: "stated",
    title: "Stated",
    company: "Stated",
    location: "Seattle, WA",
    postedAt: "2026-10-26T00:00:00.000Z",
    sourceUrl: "https://example.com/stated",
    applyUrl: "https://example.com/stated/apply",
    salary: { min: 120000, max: 150000, currency: "USD", currencySource: "source", label: "$120k-$150k" }
  });
  const estimated = makeJob({
    id: "estimated",
    title: "Estimated",
    company: "Estimated",
    location: "Austin, TX",
    postedAt: "2026-10-27T00:00:00.000Z",
    sourceUrl: "https://example.com/estimated",
    applyUrl: "https://example.com/estimated/apply",
    salary: { min: 90000, max: 110000, currency: "USD", currencySource: "default", label: "$90k-$110k" }
  });
  const jobs = [estimated, stated];
  const page = queryBoardPage({
    updatedAt: "2026-10-27T00:00:00.000Z",
    source: { name: "Audit", url: "https://example.com/audit" },
    jobs
  }, initialFilterState, 1);

  assert.equal(hasListedSalary(estimated), true);
  assert.equal(hasShownSalary(estimated), false);
  assert.equal(page.metrics.salaryJobsCount, 2);
  assert.deepEqual(selectLandingPreview(jobs, initialFilterState).map((job) => job.id), ["stated"]);
});

test("the mobile overflow menu opens, closes on Escape and outside click, and moves focus", { timeout: 60_000 }, async () => {
  const js = await bundle(fileURLToPath(new URL("./fixtures/topbar-overflow-harness.tsx", import.meta.url)));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/google-chrome"
  });

  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body><div id=\"root\"></div></body></html>");
    await page.addScriptTag({ content: js });
    const menu = page.getByRole("button", { name: "More links" });
    await menu.waitFor();
    await assert.equal(await menu.getAttribute("aria-expanded"), "false");
    assert.ok(await menu.getAttribute("aria-controls"));

    await menu.click();
    await assert.equal(await menu.getAttribute("aria-expanded"), "true");
    await page.getByRole("link", { name: "API docs" }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "API docs");

    await page.keyboard.press("Escape");
    await assert.equal(await menu.getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "More links");

    await menu.click();
    await page.getByRole("button", { name: "Outside" }).click();
    await assert.equal(await menu.getAttribute("aria-expanded"), "false");
  } finally {
    await browser.close();
  }
});

async function bundle(entry: string) {
  const result = await esbuild.build({
    absWorkingDir: repoRoot,
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    plugins: [{
      name: "at-alias",
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => ({ path: resolveAlias(args.path) }));
      }
    }]
  });
  return result.outputFiles[0]?.text ?? "";
}

function resolveAlias(specifier: string) {
  const base = resolve(srcRoot, specifier.slice(2));
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`]) {
    if (existsSync(candidate)) return candidate;
  }
  return base;
}
