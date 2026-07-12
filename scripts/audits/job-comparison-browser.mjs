import { expect } from "@playwright/test";

export async function auditJobComparisonBrowser({
  browser,
  desktopViewport,
  mobileViewport,
  newPage,
  run
}) {
  await run("FEAT-070", "Job comparison supports two to four roles on desktop and mobile", async () => {
    const desktopPage = await newPage(browser, desktopViewport);
    const desktopCompareButtons = desktopPage.getByRole("button", { name: "Compare", exact: true });
    expect(await desktopCompareButtons.count()).toBeGreaterThanOrEqual(5);

    await desktopCompareButtons.first().click();
    const prompt = desktopPage.locator(".comparison-prompt");
    await expect(prompt.getByText("Select one more role to compare.")).toBeVisible();
    await prompt.getByRole("button", { name: "Clear" }).click();
    await expect(prompt).toHaveCount(0);
    await desktopPage.getByRole("button", { name: "Compare", exact: true }).first().click();

    for (let selectedCount = 1; selectedCount < 4; selectedCount += 1) {
      await desktopPage.getByRole("button", { name: "Compare", exact: true }).first().click();
    }

    await expect(desktopPage.getByRole("heading", { name: "Compare 4 roles" })).toBeVisible();
    const table = desktopPage.getByRole("table", { name: "Job comparison" });
    await expect(table).toBeVisible();
    await expectCategoriesInFirstHeaderCell(table);
    for (const label of ["Employer", "Salary", "Location", "Workplace", "Seniority", "Tools", "Freshness", "Apply"]) {
      await expect(table.getByRole("rowheader", { name: label })).toBeVisible();
    }
    await expect(desktopPage.getByRole("button", { name: "Compare", exact: true }).first()).toBeDisabled();

    const search = desktopPage.getByRole("searchbox", { name: "Search jobs" });
    await search.fill("no matching comparison card");
    await expect(desktopPage.getByText("No matching roles")).toBeVisible();
    await expect(desktopPage.getByRole("heading", { name: "Compare 4 roles" })).toBeVisible();
    await search.fill("");
    await expect(desktopPage.locator(".job-card").first()).toBeVisible();

    await desktopPage.locator(".comparison-remove").first().click();
    await expect(desktopPage.getByRole("heading", { name: "Compare 3 roles" })).toBeVisible();
    await expect(desktopPage.getByRole("button", { name: "Compare", exact: true }).first()).toBeEnabled();
    await desktopPage.getByRole("button", { name: "Clear comparison" }).click();
    await expect(table).toHaveCount(0);
    await desktopPage.close();

    const mobilePage = await newPage(browser, mobileViewport);
    for (let selectedCount = 0; selectedCount < 4; selectedCount += 1) {
      await mobilePage.getByRole("button", { name: "Compare", exact: true }).first().click();
    }
    await expect(mobilePage.getByRole("heading", { name: "Compare 4 roles" })).toBeVisible();
    const mobileTable = mobilePage.getByRole("table", { name: "Job comparison" });
    await expectCategoriesInFirstHeaderCell(mobileTable);
    const scrollRegion = mobilePage.getByRole("region", { name: "Scrollable job comparison" });
    await scrollRegion.focus();
    await expect(scrollRegion).toBeFocused();
    const overflow = await mobilePage.evaluate(() => {
      const comparison = document.querySelector(".comparison-scroll");

      if (!(comparison instanceof HTMLElement)) {
        throw new Error("comparison scroll container missing");
      }

      return {
        documentOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        comparisonScrolls: comparison.scrollWidth > comparison.clientWidth
      };
    });
    expect(overflow.documentOverflows).toBeFalsy();
    expect(overflow.comparisonScrolls).toBeTruthy();
    await mobilePage.close();
  });
}

async function expectCategoriesInFirstHeaderCell(table) {
  const categories = table.getByRole("columnheader", { name: "Categories" });
  await expect(categories).toBeVisible();

  const position = await categories.evaluate((cell) => ({
    cellIndex: cell.cellIndex,
    rowIndex: cell.parentElement?.rowIndex
  }));

  expect(position).toEqual({ cellIndex: 0, rowIndex: 0 });
}
