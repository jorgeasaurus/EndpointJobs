import { expect, test, type Page } from "@playwright/test";

async function openCoverage(page: Page) {
  await page.goto("/board");
  const summary = page.locator("details.search-coverage-mobile > summary");
  if (await summary.isVisible()) await summary.click();
  const rail = page.locator(".command-status").locator("visible=true");
  await expect(rail).toHaveCount(1);
  return rail;
}

test("[STAT-01] headline totals stay visible and breakdowns start collapsed", async ({ page }) => {
  const rail = await openCoverage(page);
  await expect(rail.getByText("Mapped", { exact: true })).toBeVisible();
  await expect(rail.getByText("Remote / hybrid", { exact: true })).toBeVisible();
  await expect(rail.getByRole("link", { name: /Filter by Salary shown/ })).toBeVisible();

  for (const name of ["Leadership breakdown", "Seniority breakdown", "Top metros breakdown", "Jobs per tool breakdown"]) {
    const toggle = rail.getByRole("button", { name });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const box = await toggle.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }

  await expect(rail.getByRole("link", { name: /Filter by Leadership/ })).toBeHidden();
  await expect(rail.getByRole("link", { name: /Filter by Senior,/ })).toBeHidden();
  await expect(rail.locator(".status-section-panel:not([hidden])")).toHaveCount(0);
});

test("[STAT-01] keyboard opens a breakdown and its filter link still applies", async ({ page }) => {
  const rail = await openCoverage(page);
  await rail.getByRole("link", { name: /Filter by Salary shown/ }).click();
  await expect(page).toHaveURL(/salary=1/);

  const seniority = rail.getByRole("button", { name: "Seniority breakdown" });
  await seniority.focus();
  await page.keyboard.press(" ");
  await expect(seniority).toHaveAttribute("aria-expanded", "true");
  const seniorityPanel = rail.locator(`[id="${await seniority.getAttribute("aria-controls")}"]`);
  const seniorityLink = seniorityPanel.getByRole("link").first();
  await expect(seniorityLink).toBeVisible();
  await expect(rail.getByRole("button", { name: "Leadership breakdown" })).toHaveAttribute("aria-expanded", "false");
  await expect(rail.getByRole("link", { name: /Filter by Leadership/ })).toBeHidden();

  const leadership = rail.getByRole("button", { name: "Leadership breakdown" });
  await leadership.focus();
  await page.keyboard.press("Enter");
  await expect(leadership).toHaveAttribute("aria-expanded", "true");
  const leadershipLink = rail.getByRole("link", { name: /Filter by Leadership/ });
  await expect(leadershipLink).toBeVisible();
  await leadershipLink.click();
  await expect(page).toHaveURL(/leadership=1/);
  await expect(page).toHaveURL(/salary=1/);
  await expect(rail.getByRole("link", { name: /Remove Leadership filter/ })).toBeVisible();

  await leadership.focus();
  await page.keyboard.press("Enter");
  await expect(leadership).toHaveAttribute("aria-expanded", "false");
  await expect(rail.getByRole("link", { name: /Leadership filter/ })).toBeHidden();
});

test("[STAT-01] stat links keep unrelated query parameters", async ({ page }) => {
  await page.goto("/board?utm_source=newsletter");
  const summary = page.locator("details.search-coverage-mobile > summary");
  if (await summary.isVisible()) await summary.click();
  const salary = page.locator(".command-status").locator("visible=true").getByRole("link", { name: /Filter by Salary shown/ });
  await expect(salary).toHaveAttribute("href", /utm_source=newsletter/);
  await expect(salary).toHaveAttribute("href", /salary=1/);
});

test("[STAT-01] a tool breakdown link still filters", async ({ page }) => {
  const rail = await openCoverage(page);
  const tools = rail.getByRole("button", { name: "Jobs per tool breakdown" });
  await tools.click();
  const panel = rail.locator(`[id="${await tools.getAttribute("aria-controls")}"]`);
  const toolLink = panel.getByRole("link").first();
  await expect(toolLink).toBeVisible();
  const href = await toolLink.getAttribute("href");
  expect(href).toMatch(/^\//);
  await toolLink.click();
  await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
