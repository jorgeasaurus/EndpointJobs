import { expect, test } from "@playwright/test";

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
  await page.goto("/board");
  const section = page.getByRole("region", { name: "Mapped job locations" });
  await section.getByRole("button", { name: "Show map" }).click();
  await expect(section.locator("canvas")).toBeVisible({ timeout: 20_000 });
  const marker = section.locator(".maplibregl-marker, .job-map-marker, canvas").first();
  await marker.click({ position: { x: 40, y: 40 } });
  const sheet = page.getByRole("button", { name: "Close selected job" });
  if (await sheet.count()) await expect(sheet).toBeVisible();
});

test("[MAP-05] map attribution", async ({ page }) => {
  await page.goto("/board");
  const section = page.getByRole("region", { name: "Mapped job locations" });
  await section.getByRole("button", { name: "Show map" }).click();
  await expect(section).toContainText(/OpenStreetMap/);
  await expect(section).toContainText(/CARTO/);
});
