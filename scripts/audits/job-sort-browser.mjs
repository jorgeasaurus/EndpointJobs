import { chromium, expect } from "@playwright/test";
import feed from "../../src/data/jobs.json" with { type: "json" };
import { isActiveJob } from "../../src/lib/jobs.ts";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3002";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const jobs = feed.jobs.filter((job) => isActiveJob(job));
const comparators = {
  newest: (a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt),
  salary: (a, b) => (b.salary?.max ?? b.salary?.min ?? 0) - (a.salary?.max ?? a.salary?.min ?? 0),
  company: (a, b) => a.company.localeCompare(b.company)
};
const links = page.locator("#open-roles .job-title-link");
const sort = page.getByRole("combobox", { name: "Sort by", exact: true });

async function expectOrder(key) {
  const expected = [...jobs].sort(comparators[key]).slice(0, 20);
  await expect(links).toHaveCount(expected.length);
  await expect.poll(() => links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))))
    .toEqual(expected.map((job) => `/jobs/${encodeURIComponent(job.id)}`));
}

try {
  await page.goto(`${baseUrl}/board`, { waitUntil: "networkidle" });
  await expect(sort).toBeVisible();
  await expect(sort).toHaveValue("newest");
  await expectOrder("newest");
  await page.getByRole("button", { name: "Go to job page 2", exact: true }).first().click();
  await sort.selectOption("company");
  await expect(page).toHaveURL(/sort=company/);
  await expect(page.locator("#open-roles .pagination-summary").first()).toContainText("Showing 1-20");
  await expectOrder("company");
  await sort.selectOption("newest");
  await expectOrder("newest");
  await expect(page.locator("#open-roles .pagination-summary").first()).toContainText("Showing 1-20");
  await page.getByRole("button", { name: "Go to job page 2", exact: true }).first().click();
  const advanced = page.locator(".advanced-filters");
  const advancedSort = advanced.locator(".field", { hasText: "Sort" }).locator("select");
  if (!(await advancedSort.isVisible())) await advanced.locator("summary").click();
  await advancedSort.selectOption("salary");
  await expectOrder("salary");
  await advancedSort.selectOption("newest");
  await expectOrder("newest");
  await expect(page.locator("#open-roles .pagination-summary").first()).toContainText("Showing 1-20");
  await sort.selectOption("company");
  await page.reload({ waitUntil: "networkidle" });
  await expect(sort).toHaveValue("company");
  await expectOrder("company");
  await sort.selectOption("salary");
  await expect(page).toHaveURL(/sort=salary/);
  await expectOrder("salary");
  await sort.selectOption("newest");
  await expect.poll(() => new URL(page.url()).searchParams.has("sort")).toBe(false);
  await expectOrder("newest");
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await sort.scrollIntoViewIfNeeded();
    await expect(sort).toBeVisible();
    const box = await sort.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await sort.focus();
  await expect(sort).toBeFocused();
  console.log("Passed: visible sorting, all three orders, pagination reset, URL persistence, keyboard focus, and responsive layout.");
} finally {
  await browser.close();
}
