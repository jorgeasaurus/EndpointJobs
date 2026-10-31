import { expect, test } from "@playwright/test";

test("[ROAD-01] learning roadmap page", async ({ page }) => {
  const response = await page.goto("/roadmap");
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/Learning roadmap/);
  await expect(page.getByRole("heading", { level: 1, name: "Learning roadmap" })).toBeVisible();
  await expect(page.getByText("Progress stays in this browser.")).toBeVisible();
  const jumps = page.getByRole("navigation", { name: "Roadmap tracks" });
  await expect(jumps.getByRole("link", { name: "Microsoft Intune" })).toHaveAttribute("href", "#intune");
  await expect(jumps.getByRole("link", { name: "Jamf" })).toHaveAttribute("href", "#jamf");
  await expect(page.getByRole("heading", { level: 3, name: "Foundations" })).toHaveCount(2);
  await expect(page.getByRole("heading", { level: 3, name: "Architect" })).toHaveCount(2);
  const html = await response!.text();
  expect(html).toContain('rel="canonical" href="https://endpointjobs.dev/roadmap"');
  expect(html).not.toMatch(/noindex/i);

  await jumps.getByRole("link", { name: "Jamf" }).click();
  await expect(page).toHaveURL(/\/roadmap#jamf$/);
  const heading = page.getByRole("heading", { level: 2, name: "Jamf" });
  await expect(heading).toBeVisible();
  const headingBox = await heading.boundingBox();
  const topbarBox = await page.locator(".topbar").boundingBox();
  expect(headingBox).toBeTruthy();
  expect(topbarBox).toBeTruthy();
  if (!headingBox || !topbarBox) return;
  expect(headingBox.y).toBeGreaterThanOrEqual(topbarBox.y + topbarBox.height - 1);
});

test("[ROAD-02] checked skills stay in this browser", async ({ page }) => {
  await page.goto("/roadmap");
  const skill = page.getByRole("checkbox", { name: "Separate MDM from MAM" });
  await expect(skill).not.toBeChecked();
  const track = page.getByRole("progressbar", { name: "Microsoft Intune progress" });
  await expect(track).toHaveAttribute("aria-valuenow", "0");
  await skill.check();
  await expect(skill).toBeChecked();
  await expect(track).not.toHaveAttribute("aria-valuenow", "0");
  const stored = await page.evaluate(() => localStorage.getItem("endpointjobs.roadmap.completed.v1"));
  expect(stored).toContain("intune.foundations.mdm-mam");
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Separate MDM from MAM" })).toBeChecked();
  await expect(page.getByRole("progressbar", { name: "Microsoft Intune progress" })).not.toHaveAttribute("aria-valuenow", "0");
});

test("[ROAD-03] skill sources open in a new tab", async ({ page }) => {
  await page.goto("/roadmap");
  const source = page.getByRole("link", { name: /What is Microsoft Intune\?/ });
  await expect(source).toHaveAttribute("href", "https://learn.microsoft.com/en-us/intune/fundamentals/what-is-intune");
  await expect(source).toHaveAttribute("target", "_blank");
  await expect(source).toHaveAttribute("rel", /noopener/);
  await expect(source).toContainText("opens in a new tab");
});

test("[NAV-01] roadmap is in the header and footer", async ({ page }, info) => {
  await page.goto("/board");
  const footer = page.getByRole("navigation", { name: "Project links" });
  await expect(footer.getByRole("link", { name: "Roadmap" })).toHaveAttribute("href", "/roadmap");
  await expect(footer.getByRole("link", { name: "Open API documentation" })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "Open API documentation" })).toHaveCount(0);
  await expect(page.locator("header").getByRole("link", { name: "Open feedback form on GitHub" })).toHaveCount(0);

  if (info.project.name === "mobile") {
    const more = page.getByRole("button", { name: "More links" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const roadmap = page.locator("header").getByRole("link", { name: "Learning roadmap" });
    await expect(roadmap).toBeVisible();
    const box = await roadmap.boundingBox();
    expect(box && box.height).toBeGreaterThanOrEqual(44);
    await roadmap.click();
  } else {
    await page.locator("header").getByRole("link", { name: "Learning roadmap" }).click();
  }
  await expect(page).toHaveURL(/\/roadmap$/);
});
