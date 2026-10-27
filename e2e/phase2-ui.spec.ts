import { expect, test } from "@playwright/test";

const openRolesHref = "/board#open-roles";

test("[HOME-06] landing structured data names the application", async ({ page }) => {
  const home = await page.request.get("/");
  const types = jsonLdTypes(await home.text());
  expect(types).toEqual(expect.arrayContaining([
    "WebSite",
    "Organization",
    "WebApplication",
    "SoftwareApplication",
    "BreadcrumbList"
  ]));
  expect(types).not.toContain("ItemList");
  expect(types).not.toContain("CollectionPage");
});

test("[JOB-11] job and API links open the board", async ({ page }) => {
  await page.goto("/board");
  const href = await page.locator("a.job-title-link").first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.getByRole("link", { name: "All endpoint jobs" })).toHaveAttribute("href", openRolesHref);
  await expect(page.getByRole("link", { name: "Browse all roles" })).toHaveAttribute("href", openRolesHref);
  await page.goto("/api-docs");
  await expect(page.getByRole("link", { name: "Browse jobs" })).toHaveAttribute("href", openRolesHref);
  await page.goto("/");
  await expect(page.locator("#open-roles")).toHaveCount(0);
  await page.goto(openRolesHref);
  await expect(page.locator("#open-roles")).toBeVisible();
});

test("[BOARD-04] daily refresh stays visible", async ({ page }) => {
  await page.goto("/board");
  const region = page.getByRole("region", { name: "Job listings" });
  await expect(region.getByText("Daily refresh")).toBeVisible();
});

test("[FEED-01] top bar feedback stays reachable", async ({ page }) => {
  await page.goto("/board");
  const top = page.getByRole("link", { name: "Open feedback form on GitHub" });
  await expect(top).toBeVisible();
  await expect(top).toHaveAttribute("href", /report-or-request\.yml/);
  await expect(top).toHaveAttribute("target", "_blank");
});

test("[RESP-01] narrow labeled controls are at least 44px", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "390px measurement");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/board?e2e-auth=in");
  await page.locator("summary.advanced-filters-summary").click();
  await expect(page.locator(".hide-viewed-button")).toBeVisible();
  await expect(page.locator("article.job-card .save-button").first()).toBeVisible();
  const offenders = await page.evaluate(() => {
    const selectors = [
      "#role-family",
      "#freshness",
      "#location-query",
      ".quick-filters .facet-button",
      ".advanced-filters .facet-button",
      ".pagination-button",
      "article.job-card .compare-button",
      "article.job-card .save-button",
      "article.job-card .description-details summary",
      "article.job-card a.apply-link",
      ".hide-viewed-button",
      ".mode-button",
      ".advanced-filters-summary",
      ".workplace-filter-button",
      "#job-search-input",
      ".topbar .api-docs-link",
      ".topbar .mcp-docs-link",
      ".topbar .topbar-feedback-link",
      ".topbar .support-link",
      ".site-footer .footer-link"
    ];
    return selectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const name = (element.getAttribute("aria-label") || element.textContent || selector).replace(/\s+/g, " ").trim().slice(0, 80);
      return {
        selector,
        name,
        width: Math.round(box.width),
        height: Math.round(box.height),
        hidden: style.display === "none" || box.width === 0 || box.height === 0
      };
    })).filter((item) => !item.hidden && (item.width < 44 || item.height < 44));
  });
  expect(offenders, JSON.stringify(offenders)).toEqual([]);
});

test("[JOB-04] unknown job title", async ({ page }) => {
  const response = await page.goto("/jobs/phase2-not-a-job");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Job not found | Endpoint Jobs");
  await expect(page.getByRole("heading", { level: 1, name: "Job not found" })).toBeVisible();
  await expect(page.getByText("404: This page could not be found.")).toHaveCount(0);
  const content = await page.content();
  expect(content.toLowerCase()).toContain("noindex");
  const titles = [...content.matchAll(/<title[^>]*>([^<]*)<\/title>/gi)].map((match) => match[1]);
  expect(titles).toContain("Job not found | Endpoint Jobs");
  expect(titles.join("\n")).not.toContain("404:");
});

function jsonLdTypes(html: string) {
  const types: string[] = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const value = JSON.parse(match[1].replaceAll("\\u003c", "<"));
    collectTypes(value, types);
  }
  return types;
}

function collectTypes(value: unknown, types: string[]) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, types);
    return;
  }
  const record = value as { "@type"?: unknown; "@graph"?: unknown };
  const type = record["@type"];
  if (typeof type === "string") types.push(type);
  if (Array.isArray(type)) {
    for (const item of type) if (typeof item === "string") types.push(item);
  }
  collectTypes(record["@graph"], types);
}
