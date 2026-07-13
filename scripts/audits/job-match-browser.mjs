import { expect } from "@playwright/test";

export async function auditJobMatchBrowser({
  browser,
  matchScenario,
  mobileViewport,
  newPage,
  run
}) {
  await run("FEAT-074", "Personalized preferences score and explain matching roles", async () => {
    const page = await newPage(browser, mobileViewport);
    await page.getByRole("searchbox", { name: "Search jobs" }).fill(matchScenario.job.title);
    await expect(page.locator(".job-card").first()).toBeVisible();

    await page.getByText("Personalized matches").click();
    await page.getByRole("group", { name: "Platforms" })
      .getByRole("button", { name: matchScenario.platform, exact: true })
      .click();
    await page.getByRole("group", { name: "Tools" })
      .getByRole("button", { name: matchScenario.tool, exact: true })
      .click();
    await page.getByLabel("Preferred location").fill(matchScenario.location);
    await page.getByLabel("Minimum salary").fill(String(matchScenario.salaryFloor));
    await page.getByLabel("Preferred seniority").selectOption(matchScenario.job.seniority);

    const firstCard = page.locator(".job-card").first();
    await expect(firstCard.locator(".personal-match-label")).toHaveText("Strong match");
    await expect(firstCard.locator(".personal-match-heading strong")).toHaveText("100%");
    await expect(firstCard.locator(".personal-match-reasons .is-match")).toHaveCount(5);
    await expect(page.locator(".match-profile-count")).toHaveText("5 configured");

    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    await page.getByRole("button", { name: "Reset preferences" }).click();
    await expect(firstCard.locator(".personal-match")).toHaveCount(0);
    await expect(page.locator(".match-profile-count")).toHaveText("Set preferences");
    await page.close();
  });
}
