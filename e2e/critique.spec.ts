import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const jobPath = "/jobs/serpapi-blue-light-it-llc-boca-raton-fl-endpoint-engineer-microsoft-365-intune-endpoint-security-76281fc12b";

test("server HTML includes the job before client paint", async ({ request }) => {
  const response = await request.get(jobPath);
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain("Endpoint Engineer - Microsoft 365, Intune");
  expect(html).toContain("Blue Light It LLC");
  expect(html).not.toContain("Loading endpoint roles");
  expect(html).toContain("<title>");
  expect(html).toContain("Manage and troubleshoot endpoints");
  expect(html).not.toContain("taskBonus");
  expect(html).not.toContain("〔");
});

test("home desktop keeps counts with their labels and shortens cards", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Endpoint Jobs" })).toBeVisible();

  const remote = page.getByRole("button", { name: /Remote/ }).first();
  const box = await remote.boundingBox();
  expect(box).toBeTruthy();
  const label = remote.locator("span").first();
  const count = remote.locator("strong");
  const labelBox = await label.boundingBox();
  const countBox = await count.boundingBox();
  expect(labelBox && countBox && box).toBeTruthy();
  if (!labelBox || !countBox || !box) return;
  expect(countBox.x).toBeGreaterThan(labelBox.x + labelBox.width - 2);
  expect(countBox.x - (labelBox.x + labelBox.width)).toBeLessThan(24);
  expect(box.x + box.width - (countBox.x + countBox.width)).toBeGreaterThan(12);

  const card = page.locator("article.job-card").first();
  await expect(card.getByRole("link", { name: "Apply" }).or(card.getByText("Apply"))).toBeVisible();
  await expect(card.locator(".match-recommendation")).toBeHidden();
  await expect(card.locator(".tool-chips")).toBeHidden();
  await card.locator("summary").click();
  await expect(card.locator(".match-recommendation")).toBeVisible();
  await expect(card.getByText("Why this role is included")).toBeVisible();
  await expect(card.locator(".description-body .tool-chip").first()).toBeVisible();

  const found = page.locator(".search-result-count");
  await expect(found).toHaveCount(0);

  await page.screenshot({ path: "/opt/cursor/artifacts/home-desktop-after.png", fullPage: false });
});

test("search empty state names the query", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/?q=zzzz");
  await expect(page.getByText(/Nothing matches search “zzzz”/)).toBeVisible();
  await expect(page.getByText("Try fewer tool filters")).toHaveCount(0);
});

test("job detail renders repaired lists", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto(jobPath);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Endpoint Engineer");
  const item = page.getByRole("listitem").filter({ hasText: "Manage and troubleshoot endpoints" });
  await expect(item).toBeVisible();
  const description = await page.locator(".job-detail-description").innerText();
  expect(description).not.toContain("taskBonus");
  expect(description).not.toContain("MDMHands");
  expect(description).not.toContain("〔");
  expect(description).toContain("What you need");
  await page.screenshot({ path: "/opt/cursor/artifacts/job-desktop-after.png", fullPage: false });
  await item.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/opt/cursor/artifacts/job-desktop-description-after.png", fullPage: false });
});

test("mobile layout keeps the first job above collapsed stats", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const topbar = page.locator(".topbar");
  const topbarBox = await topbar.boundingBox();
  expect(topbarBox?.width).toBeLessThanOrEqual(390);
  const frame = await page.evaluate(() => {
    function metrics(selector: string) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        fontSize: Number.parseFloat(style.fontSize),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        text: (element.textContent ?? "").replace(/\s+/g, " ").trim()
      };
    }

    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pill: metrics(".refresh-pill"),
      brand: metrics(".brand > span:last-child"),
      role: metrics(".mini-field span"),
      summary: metrics(".description-details summary")
    };
  });
  expect(frame.overflow).toBeLessThanOrEqual(1);
  expect(frame.pill?.text).toMatch(/UTC|Pending refresh/);
  expect(frame.pill && frame.pill.scrollWidth).toBeLessThanOrEqual((frame.pill?.clientWidth ?? 0) + 1);
  expect(frame.brand?.text).toBe("Endpoint Jobs");
  expect(frame.brand && frame.brand.scrollWidth).toBeLessThanOrEqual((frame.brand?.clientWidth ?? 0) + 1);
  expect(frame.role?.fontSize).toBeGreaterThanOrEqual(12);
  expect(frame.summary?.fontSize).toBeGreaterThanOrEqual(12);

  const onSite = page.getByRole("button", { name: /On-site/ });
  await expect(onSite).toBeVisible();
  const onSiteText = await onSite.innerText();
  expect(onSiteText).toMatch(/On-site/);
  expect(onSiteText).not.toMatch(/79\.\.\.|On-sit$/);

  const firstCard = page.locator("article.job-card").first();
  const stats = page.locator(".search-coverage-mobile");
  const cardBox = await firstCard.boundingBox();
  const statsBox = await stats.boundingBox();
  expect(cardBox && statsBox).toBeTruthy();
  if (cardBox && statsBox) expect(cardBox.y).toBeLessThan(statsBox.y);
  await expect(stats).not.toHaveAttribute("open", "");

  await page.screenshot({ path: "/opt/cursor/artifacts/home-mobile-390-after.png", fullPage: false });
  await page.goto(jobPath);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Endpoint Engineer");
  await page.screenshot({ path: "/opt/cursor/artifacts/job-mobile-390-after.png", fullPage: false });
  const descriptionItem = page.getByRole("listitem").filter({ hasText: "Manage and troubleshoot endpoints" });
  await descriptionItem.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/opt/cursor/artifacts/job-mobile-description-after.png", fullPage: false });
});

test("measured label contrast is at least 4.5:1 and text is at least 12px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/");
  await page.locator("article.job-card").first().locator("summary").click();
  const samples = await page.evaluate(() => {
    function parseColor(value: string) {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
      const [red, green, blue, alpha = 1] = parts;
      return { red, green, blue, alpha };
    }

    function composite(foreground: { red: number; green: number; blue: number; alpha: number }, background: { red: number; green: number; blue: number }) {
      const alpha = foreground.alpha;
      return {
        red: Math.round(foreground.red * alpha + background.red * (1 - alpha)),
        green: Math.round(foreground.green * alpha + background.green * (1 - alpha)),
        blue: Math.round(foreground.blue * alpha + background.blue * (1 - alpha))
      };
    }

    function channel(value: number) {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }

    function luminance(color: { red: number; green: number; blue: number }) {
      return 0.2126 * channel(color.red) + 0.7152 * channel(color.green) + 0.0722 * channel(color.blue);
    }

    function contrast(foreground: { red: number; green: number; blue: number }, background: { red: number; green: number; blue: number }) {
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return (lighter + 0.05) / (darker + 0.05);
    }

    function backgroundOf(element: Element) {
      let current: Element | null = element;
      while (current) {
        const color = parseColor(getComputedStyle(current).backgroundColor);
        if (color && color.alpha > 0.95) return color;
        current = current.parentElement;
      }
      return { red: 7, green: 9, blue: 11, alpha: 1 };
    }

    const selectors = [
      [".mini-field span", "ROLE / FRESHNESS"],
      [".description-body .tool-chip--platform", "platform chip"],
      [".description-body .tool-chip--tool", "tool chip"],
      [".description-details summary", "More description"],
      [".posted-pill", "Posted date"],
      [".metadata-row span", "Metadata"],
      [".workplace-filter-label", "WORKPLACE"]
    ] as const;

    return selectors.flatMap(([selector, name]) => {
      const element = document.querySelector(selector);
      if (!element) return [];
      const style = getComputedStyle(element);
      const parsed = parseColor(style.color);
      const background = backgroundOf(element);
      if (!parsed) return [];
      const foreground = composite(parsed, background);
      return [{
        name,
        fontSize: style.fontSize,
        ratio: Number(contrast(foreground, background).toFixed(2)),
        color: style.color
      }];
    });
  });

  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  writeFileSync("/opt/cursor/artifacts/contrast-ratios.json", JSON.stringify(samples, null, 2));
  expect(samples.map((sample) => sample.name)).toEqual(expect.arrayContaining([
    "ROLE / FRESHNESS",
    "platform chip",
    "tool chip",
    "More description",
    "Posted date",
    "Metadata",
    "WORKPLACE"
  ]));
  for (const sample of samples) {
    expect(Number.parseFloat(sample.fontSize), sample.name).toBeGreaterThanOrEqual(12);
    expect(sample.ratio, sample.name).toBeGreaterThanOrEqual(4.5);
  }
});
