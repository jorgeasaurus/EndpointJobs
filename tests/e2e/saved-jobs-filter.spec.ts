import { expect, test } from "@playwright/test";

const savedJobId = "e2e-platform-chip-fixture";

test("[BOARD-06] signed-out board omits Saved jobs only", async ({ page }) => {
  const html = await (await page.request.get("/board")).text();
  expect(html).not.toMatch(/<button[^>]*saved-only-button/);
  expect(html).not.toContain("Saved jobs only");
  const flagged = await (await page.request.get("/board?savedOnly=1&saved=1")).text();
  expect(flagged).not.toMatch(/<button[^>]*saved-only-button/);
  expect(flagged).not.toContain("Saved jobs only");

  await page.goto("/board?savedOnly=1&saved=1");
  await expect(page.locator(".saved-only-button")).toHaveCount(0);
  await expect(page.locator("article.job-card").nth(1)).toBeVisible();
  await expect(page.locator(".results-panel h2 .sr-only")).not.toHaveText("1");
});

test("[BOARD-06] a shared flag does not turn the filter on", async ({ page }) => {
  await page.goto("/board?e2e-auth=in&savedOnly=1&saved=1");
  const button = page.locator(".saved-only-button");
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button).toHaveAttribute("aria-label", "Saved jobs only");
  await expect(page.locator("article.job-card").nth(1)).toBeVisible();
});

test("[BOARD-06] saved jobs only lists the shortlist and drops an unsaved role", async ({ page }) => {
  await page.goto(`/board?e2e-auth=in&e2e-saved=${savedJobId}`);
  await expect(page.locator(`#job-${savedJobId} .save-button`)).toHaveAttribute("aria-pressed", "true");
  await page.locator(".saved-only-button").click();
  await expect(page.locator(".saved-only-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("article.job-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Platform chip alignment fixture" })).toBeVisible();
  await expect(page.locator(".results-panel h2 .sr-only")).toHaveText("1");
  await expect(page).not.toHaveURL(/[?&]saved=/);
  await expect(page).not.toHaveURL(/savedOnly=/);

  await page.locator("article.job-card .save-button").click();
  await expect(page.locator("article.job-card")).toHaveCount(0);
  await expect(page.getByText(/no saved jobs yet/i)).toBeVisible();
  await expect(page.getByText(/press Save/)).toBeVisible();
});

test("[BOARD-06] saved jobs only ANDs with search and keeps a viewed saved job", async ({ page }) => {
  await page.goto(`/board?e2e-auth=in&e2e-saved=${savedJobId}&q=zzzz-no-such-endpoint-role`);
  await expect(page.locator(".saved-only-button")).toBeVisible();
  await page.locator(".saved-only-button").click();
  await expect(page.getByText(/None of your saved jobs match/)).toBeVisible();
  await expect(page.locator("article.job-card")).toHaveCount(0);

  await page.goto(`/board?e2e-auth=in&e2e-saved=${savedJobId}&e2e-viewed=${savedJobId}&e2e-hide-viewed=1&e2e-saved-only=1`);
  await expect(page.locator(".hide-viewed-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".saved-only-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("article.job-card")).toHaveCount(1);
  await expect(page.locator(".viewed-pill")).toBeVisible();
});

test("[BOARD-06] signing out hides the control and shows the full board", async ({ page }) => {
  await page.goto(`/board?e2e-auth=in&e2e-saved=${savedJobId}&e2e-saved-only=1`);
  await expect(page.locator("article.job-card")).toHaveCount(1);
  await page.goto("/board?e2e-auth=out");
  await expect(page.locator(".saved-only-button")).toHaveCount(0);
  await expect(page.locator(".hide-viewed-button")).toHaveCount(0);
  await expect(page.locator("article.job-card").nth(1)).toBeVisible();
});
