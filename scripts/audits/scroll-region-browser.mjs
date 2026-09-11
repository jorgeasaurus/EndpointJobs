import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3002";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function expectKeyboardScroll(region) {
  await expect(region).toHaveAttribute("tabindex", "0");
  await region.focus();
  await expect(region).toBeFocused();
  await region.press("ArrowRight");
  await expect.poll(() => region.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
}

try {
  await page.goto(`${baseUrl}/api-docs`, { waitUntil: "networkidle" });
  const parameters = page.getByRole("region", { name: "Jobs API query parameters" });
  await expectKeyboardScroll(parameters);
  await expectKeyboardScroll(page.getByRole("region", { name: "curl request code" }));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(parameters).not.toHaveAttribute("tabindex", "0");
  await page.setViewportSize({ width: 390, height: 844 });
  await expectKeyboardScroll(parameters);

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  for (let selected = 0; selected < 4; selected++) {
    await page.getByRole("button", { name: "Compare", exact: true }).first().click();
  }
  await expectKeyboardScroll(page.getByRole("region", { name: "Scrollable job comparison" }));

  await page.goto(`${baseUrl}/?sort=company`, { waitUntil: "networkidle" });
  const advanced = page.locator(".advanced-filters");
  await expect(advanced).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Clear all", exact: true }).first().click();
  await expect(advanced).toHaveAttribute("open", "");
  await advanced.locator("summary").click();
  await expect(advanced).not.toHaveAttribute("open", "");
  await page.getByRole("searchbox", { name: "Search jobs" }).fill("Intune");
  await expect(advanced).not.toHaveAttribute("open", "");
  await page.goto(`${baseUrl}/?sort=company&seniority=Senior`, { waitUntil: "networkidle" });
  await expect(advanced).toHaveAttribute("open", "");
  await advanced.locator("summary").click();
  await expect(advanced).not.toHaveAttribute("open", "");
  await page.getByRole("searchbox", { name: "Search jobs" }).fill("Jamf");
  await expect(advanced).not.toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Remove filter: Senior", exact: true }).first().click();
  await expect(advanced).not.toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: "Remove filter: Sort: Company", exact: true }).first()).toBeVisible();
  await advanced.locator("summary").press("Enter");
  await expect(advanced).toHaveAttribute("open", "");
  await advanced.locator("summary").press("Space");
  await expect(advanced).not.toHaveAttribute("open", "");
  await page.getByRole("searchbox", { name: "Search jobs" }).fill("Intune");
  await expect(advanced).not.toHaveAttribute("open", "");
  console.log("Passed: API and comparison keyboard scrolling, responsive focus, and advanced-filter expansion.");
} finally {
  await browser.close();
}
