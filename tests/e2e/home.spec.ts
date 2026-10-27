import { expect, test } from "@playwright/test";

test("[HOME-01] landing hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "The board for endpoint engineers." })).toBeVisible();
  await expect(page.getByText("Daily listings for macOS, Windows, MDM, and endpoint security roles.")).toBeVisible();
  const jobs = page.getByRole("link", { name: "See the jobs" });
  await expect(jobs).toBeVisible();
  await expect(jobs).toHaveAttribute("href", "/board");
  const html = await page.request.get("/");
  expect(html.headers()["x-robots-tag"] ?? "").not.toMatch(/noindex/i);
  const body = await html.text();
  expect(body).toContain("The board for endpoint engineers.");
});

test("[HOME-02] landing counts", async ({ page }) => {
  const board = await page.request.get("/api/board");
  expect(board.ok()).toBeTruthy();
  const payload = await board.json() as {
    total: number;
    metrics: { remoteJobsCount: number; salaryJobsCount: number };
  };
  await page.goto("/");
  const stats = page.locator(".landing-stats");
  await expect(stats.getByText("Open roles", { exact: true })).toBeVisible();
  await expect(stats.getByText("Remote or hybrid", { exact: true })).toBeVisible();
  await expect(stats.getByText("Salary shown", { exact: true })).toBeVisible();
  const format = new Intl.NumberFormat("en-US");
  await expect(stats).toContainText(format.format(payload.total));
  await expect(stats).toContainText(format.format(payload.metrics.remoteJobsCount));
  await expect(stats).toContainText(format.format(payload.metrics.salaryJobsCount));
});

test("[HOME-03] newest roles preview", async ({ page }) => {
  const board = await page.request.get("/api/board");
  const payload = await board.json() as {
    jobs: { id: string; title: string; company: string }[];
  };
  await page.goto("/");
  const preview = page.getByRole("complementary", { name: "Newest open roles" });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("link", { name: "All roles" })).toHaveAttribute("href", "/board");
  const rows = preview.locator("ol a");
  const count = await rows.count();
  expect(count).toBeLessThanOrEqual(4);
  expect(count).toBe(Math.min(4, payload.jobs.length));
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    await expect(row).toHaveAttribute("href", `/jobs/${payload.jobs[index].id}`);
    await expect(row).toContainText(payload.jobs[index].title);
    await expect(row).toContainText(payload.jobs[index].company);
    await expect(row.locator(".landing-workplace")).not.toBeEmpty();
  }
});

test("[HOME-04] why an account", async ({ page }) => {
  await page.goto("/");
  const copy = page.locator(".landing-account");
  await expect(copy).toContainText("An account is optional.");
  await expect(copy).toContainText("Sign in with Google or GitHub");
  await expect(copy).toContainText("jobs you save");
  await expect(copy).toContainText("filters you choose to keep");
  await expect(copy).toContainText("listings you have opened");
  await expect(copy.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
});

test("[HOME-06] landing structured data", async ({ page }) => {
  const home = await page.request.get("/");
  const homeHtml = await home.text();
  const homeTypes = jsonLdTypes(homeHtml);
  expect(homeTypes).toContain("WebSite");
  expect(homeTypes).toContain("Organization");
  expect(homeTypes).toContain("SoftwareApplication");
  expect(homeTypes).toContain("BreadcrumbList");
  expect(homeTypes).not.toContain("ItemList");
  expect(homeTypes).not.toContain("CollectionPage");

  const board = await page.request.get("/board");
  const boardHtml = await board.text();
  const boardTypes = jsonLdTypes(boardHtml);
  expect(boardTypes).toContain("CollectionPage");
  expect(boardTypes).toContain("ItemList");
});

function jsonLdTypes(html: string) {
  const types: string[] = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const json = JSON.parse(match[1]) as { "@graph"?: { "@type"?: string }[] };
    for (const node of json["@graph"] ?? []) {
      if (node["@type"]) types.push(node["@type"]);
    }
  }
  return types;
}
