import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { initialFilterState } from "../../src/components/job-board/filter-model";
import { getActiveSourceFeed, selectLandingPreview } from "../../src/lib/board-page";
import type { JobsFeed } from "../../src/types/job";

const feedData = JSON.parse(readFileSync(new URL("../../src/data/jobs.json", import.meta.url), "utf8")) as JobsFeed;

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
  await expect(stats.getByText("Remote/hybrid", { exact: true })).toBeVisible();
  await expect(stats.getByText("Salary shown", { exact: true })).toBeVisible();
  const format = new Intl.NumberFormat("en-US");
  await expect(stats).toContainText(format.format(payload.total));
  await expect(stats).toContainText(format.format(payload.metrics.remoteJobsCount));
  await expect(stats).toContainText(format.format(payload.metrics.salaryJobsCount));
});

test("[HOME-03] newest roles preview", async ({ page }) => {
  const jobs = selectLandingPreview(getActiveSourceFeed(feedData).jobs, initialFilterState);
  await page.goto("/");
  const preview = page.getByRole("complementary", { name: "Newest roles with salary" });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("link", { name: "All roles" })).toHaveAttribute("href", "/board");
  const rows = preview.locator("ol a");
  const count = await rows.count();
  expect(count).toBeLessThanOrEqual(4);
  expect(count).toBe(jobs.length);
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    await expect(row).toHaveAttribute("href", `/jobs/${jobs[index].id}`);
    await expect(row).toContainText(jobs[index].title);
    await expect(row).toContainText(jobs[index].company);
    await expect(row.locator(".landing-salary")).not.toBeEmpty();
    await expect(row.locator(".landing-workplace")).not.toBeEmpty();
  }
});

test("[HOME-04] why an account", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".landing-account")).toHaveCount(0);
  await expect(page.getByText("An account is optional.")).toHaveCount(0);
  const signIn = page.getByRole("button", { name: "Sign in to save jobs, filters, and viewed job history" });
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    await expect(signIn).toBeVisible();
  } else {
    const html = await (await page.request.get("/")).text();
    expect(html).toContain("Sign in to save jobs, filters, and viewed job history");
  }
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
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
