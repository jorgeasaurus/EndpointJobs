import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { initialFilterState } from "../../src/components/job-board/filter-model";
import { getActiveBoardFeed } from "../../src/lib/board-page";
import { filterJobs } from "../../src/lib/job-filters";
import type { Job, JobsFeed } from "../../src/types/job";

const feedData = JSON.parse(readFileSync(new URL("../../src/data/jobs.json", import.meta.url), "utf8")) as JobsFeed;

test("[A11Y-02] comparison scroll region", async ({ page }) => {
  await page.goto("/board");
  const buttons = page.locator("article.job-card .compare-button");
  await buttons.nth(0).click();
  await buttons.nth(1).click();
  const region = page.getByRole("region", { name: "Scrollable job comparison" });
  await expect(region).toBeVisible();
  const tabIndex = await region.getAttribute("tabindex");
  const overflow = await region.evaluate((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
  if (overflow) expect(tabIndex).toBe("0");
  else expect(tabIndex).not.toBe("0");
});

test("[A11Y-02] focus stays on a fitting region", async ({ page }) => {
  await page.goto("/api-docs");
  const regions = page.getByRole("region", { name: /code$/ });
  const count = await regions.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const region = regions.nth(index);
    const overflow = await region.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    const tabIndex = await region.getAttribute("tabindex");
    if (!overflow) expect(tabIndex).not.toBe("0");
  }
});

test("[SEARCH-02] shortcut ignores contenteditable", async ({ page }) => {
  await page.goto("/board");
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.contentEditable = "true";
    host.id = "phase2-editable";
    host.textContent = "note";
    document.body.append(host);
  });
  await page.locator("#phase2-editable").focus();
  await page.keyboard.press("/");
  await expect(page.locator("#job-search-input")).not.toBeFocused();
});

test("[MAP-04] coarse pointer sheet", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "coarse pointer");
  const query = singleMappedLocationQuery();
  await page.goto(`/board?location=${encodeURIComponent(query)}`);
  await page.waitForLoadState("networkidle");
  const section = page.getByRole("region", { name: "Mapped job locations" });
  await section.getByRole("button", { name: "Show map" }).click();
  const canvas = section.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => {
    const text = await section.locator(".job-map-zoom-readout").textContent();
    return Number(text?.replace("%", "") ?? 0);
  }).toBeGreaterThanOrEqual(800);

  const box = await canvas.boundingBox();
  expect(box, "map canvas has no box").toBeTruthy();
  const center = { x: Math.round(box!.width / 2), y: Math.round(box!.height / 2) };
  const close = page.getByRole("button", { name: "Close selected job" });
  const offsets = [
    [0, 0],
    [-12, 0],
    [12, 0],
    [0, -12],
    [0, 12],
    [-20, -20],
    [20, -20],
    [-20, 20],
    [20, 20]
  ];
  for (const [offsetX, offsetY] of offsets) {
    await canvas.tap({
      position: {
        x: Math.min(Math.max(center.x + offsetX, 4), Math.round(box!.width - 4)),
        y: Math.min(Math.max(center.y + offsetY, 4), Math.round(box!.height - 4))
      }
    });
    if (await close.isVisible()) break;
  }
  await expect(close).toBeVisible();
  await close.click();
  await expect(close).toHaveCount(0);
});

function singleMappedLocationQuery() {
  const jobs = getActiveBoardFeed(feedData).jobs;
  const candidates = new Map<string, string>();
  const add = (value: string | undefined) => {
    const query = value?.replace(/\s+/g, " ").trim() ?? "";
    if (!query.includes(" ")) return;
    candidates.set(query.toLowerCase(), query);
    const city = query.split(",")[0]?.trim() ?? "";
    if (city.includes(" ")) candidates.set(city.toLowerCase(), city);
  };
  for (const job of jobs) {
    if (!job.mapLocation || !job.applyUrl) continue;
    add(job.mapLocation.label);
    add(job.location);
  }

  let best: { query: string; score: number } | undefined;
  for (const query of candidates.values()) {
    const matching = filterJobs(jobs, { ...initialFilterState, locationQuery: query });
    const mapped = matching.filter((job: Job) => job.mapLocation && job.applyUrl);
    if (mapped.length !== 1) continue;
    const score = matching.length === 1 ? 100 : 0;
    if (!best || score > best.score) best = { query, score };
  }
  if (!best) throw new Error("no single mapped location for the coarse map sheet");
  return best.query;
}

test("[MAP-05] map attribution", async ({ page }) => {
  await page.goto("/board");
  const section = page.getByRole("region", { name: "Mapped job locations" });
  await section.getByRole("button", { name: "Show map" }).click();
  await expect(section).toContainText(/OpenStreetMap/);
  await expect(section).toContainText(/CARTO/);
});
