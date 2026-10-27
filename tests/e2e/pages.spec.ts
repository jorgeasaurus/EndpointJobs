import { expect, test } from "@playwright/test";

test("[JOB-03] job detail page", async ({ page }) => {
  await page.goto("/board");
  const card = page.locator("article.job-card").first();
  const href = await card.locator("a.job-title-link").getAttribute("href");
  const title = (await card.locator("a.job-title-link").innerText()).replace(/\s+/g, " ").trim();
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  const apply = page.getByRole("link", { name: "Apply for this role" });
  await expect(apply).toBeVisible();
  await expect(apply).toHaveAttribute("target", "_blank");
  await expect(apply).toHaveAttribute("rel", /noopener/);
  const html = await (await page.request.get(href!)).text();
  expect(html).toContain("<title>");
  expect(html).not.toContain("Loading endpoint roles");
  expect(html).toContain('property="og:image"');
});

test("[JOB-11] back to the job list", async ({ page }) => {
  await page.goto("/board");
  const href = await page.locator("a.job-title-link").first().getAttribute("href");
  await page.goto(href!);
  await expect(page.getByRole("link", { name: "All endpoint jobs" })).toHaveAttribute("href", "/#open-roles");
  await expect(page.getByRole("link", { name: "Browse all roles" })).toHaveAttribute("href", "/#open-roles");
  await page.goto("/api-docs");
  await expect(page.getByRole("link", { name: "Browse jobs" })).toHaveAttribute("href", "/#open-roles");
  await page.goto("/");
  await expect(page.locator("#open-roles")).toHaveCount(0);
  await page.goto("/board");
  await expect(page.locator("#open-roles")).toHaveCount(1);
});

test("[PAGE-02] directory page", async ({ page }) => {
  await page.goto("/jobs");
  await expect(page.getByRole("heading", { level: 1, name: "All endpoint jobs" })).toBeVisible();
  const links = page.locator("a[href^='/jobs/']");
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(50);
  const first = links.first();
  await expect(first).toBeVisible();
  await expect(first).toContainText(/\w/);
});

test("[API-03] api docs page", async ({ page }) => {
  await page.goto("/board");
  await page.getByRole("link", { name: "Open API documentation" }).click();
  await expect(page).toHaveURL(/\/api-docs$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Query endpoint roles");
  await expect(page.getByText("GET /api/jobs", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "OpenAPI specification" })).toHaveAttribute("href", "/openapi.json");
  await expect(page.getByRole("link", { name: /MCP/ }).first()).toBeVisible();
});

test("[MCP-02] mcp guide", async ({ page }) => {
  await page.goto("/mcp");
  const human = page.getByRole("button", { name: "Human" });
  const agent = page.getByRole("button", { name: "Agent", exact: true });
  await expect(human).toHaveAttribute("aria-pressed", "true");
  await expect(agent).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("https://endpointjobs.dev/api/mcp", { exact: true })).toBeVisible();
  await expect(page.getByText("search_jobs")).toBeVisible();
  await expect(page.getByText("get_job")).toBeVisible();
  await expect(page.getByText("get_filter_options")).toBeVisible();
  await agent.click();
  await expect(page.getByRole("button", { name: "Agent", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Agent instructions")).toBeVisible();
});

test("[PRIV-01] privacy policy", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await expect(page.getByText("Version 2026-10-24", { exact: true })).toBeVisible();
  await expect(page.getByText("October 24, 2026")).toBeVisible();
  await expect(page.getByText(/email address/i)).toBeVisible();
  await expect(page.getByText(/Filter preferences you choose to save/)).toBeVisible();
  await expect(page.getByText(/Jobs you save/)).toBeVisible();
  await expect(page.getByText(/listings you opened/)).toBeVisible();
  await expect(page.getByText("Supabase", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Vercel, for hosting and the existing Vercel Analytics.")).toBeVisible();
  await expect(page.getByText(/Google and GitHub/)).toBeVisible();
  await expect(page.getByText(/Filters keep working in the page/)).toBeVisible();
  await expect(page.getByText(/export your data, delete the account, and clear view history/)).toBeVisible();
  const html = await (await page.request.get("/privacy")).text();
  expect(html).not.toMatch(/noindex/i);
  expect(html).toContain('rel="canonical" href="https://endpointjobs.dev/privacy"');
});

test("[RESP-02] other pages at 390", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "390px layout");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const hero = await page.locator(".landing-hero").boundingBox();
  expect(hero && hero.width).toBeLessThanOrEqual(390);
  await page.goto("/api-docs");
  const copy = page.getByRole("button", { name: /Copy/ }).first();
  if (await copy.count()) {
    const box = await copy.boundingBox();
    expect(box && box.height).toBeGreaterThanOrEqual(44);
  }
  await page.goto("/mcp");
  const human = page.getByRole("button", { name: "Human" });
  const box = await human.boundingBox();
  expect(box && Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
});

test("[A11Y-03] reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/board");
  await expect(page.locator(".parallax-field")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".parallax-field canvas")).toHaveCount(0);
  const heading = page.locator(".results-panel h2 .sr-only");
  await expect(heading).toBeVisible();
});

test("[SEO-05] analytics script marker", async ({ page }) => {
  await page.goto("/");
  const script = page.locator("script[src*='insights'], script[src*='vercel-scripts']");
  await expect(script.first()).toBeAttached();
  await page.goto("/privacy");
  await expect(page.getByText("That measurement is not attached to an account here.")).toBeVisible();
});

test("[ACCT-04] no account route", async ({ page }) => {
  const response = await page.request.get("/account");
  expect(response.status()).toBe(404);
  await page.goto("/board");
  await expect(page.getByRole("link", { name: /^Account$/ })).toHaveCount(0);
});
