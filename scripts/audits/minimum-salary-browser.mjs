import { expect } from "@playwright/test";

export async function auditMinimumSalaryBrowser({
  browser,
  minimumSalaryScenario,
  mobileViewport,
  newPage,
  run
}) {
  await run("FEAT-074", "Minimum salary dropdown filters and persists in the URL", async () => {
    const page = await newPage(browser, mobileViewport);
    await page.getByText("More filters").click();
    const mobileFilterStack = page.locator(".hero-filter-stack--mobile");
    await mobileFilterStack.getByLabel("Minimum salary").selectOption(
      minimumSalaryScenario.threshold
    );

    const expectedLabel = `$${Number(minimumSalaryScenario.threshold) / 1000}k+`;
    await expect(page.locator(".active-filter-chip", { hasText: `Minimum: ${expectedLabel}` })).toBeVisible();
    await expect(page.locator(".results-heading h2")).toContainText(
      `${minimumSalaryScenario.resultCount} endpoint opportunities`
    );
    expect(new URL(page.url()).searchParams.get("minSalary")).toBe(
      minimumSalaryScenario.threshold
    );

    const search = page.getByRole("searchbox", { name: "Search jobs" });
    await search.fill(minimumSalaryScenario.includedTitle);
    await expect(page.locator(".job-card").first()).toBeVisible();
    await search.fill(minimumSalaryScenario.excludedTitle);
    await expect(page.getByText("No matching roles")).toBeVisible();
    await search.fill("");

    await page.getByRole("button", { name: `Remove filter: Minimum: ${expectedLabel}` }).click();
    await expect(mobileFilterStack.getByLabel("Minimum salary")).toHaveValue("Any");
    expect(new URL(page.url()).searchParams.has("minSalary")).toBeFalsy();
    await page.close();
  });
}
