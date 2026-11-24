import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Browser } from "@playwright/test";

import { bundleHarness } from "../../../scripts/audits/harness-bundle";

const origin = "http://harness.test";
const signedInAccount = new URL("../../../scripts/audits/fixtures/stubs/signed-in-account.ts", import.meta.url);
const harness = bundleHarness(new URL("../../../scripts/audits/fixtures/account-board-harness.tsx", import.meta.url), {
  "@/components/auth/sign-in-session": signedInAccount,
  "@/lib/supabase/client": signedInAccount,
  "@/lib/supabase/env": signedInAccount
});

test("a filter change saves the preferences once and does not reload the account", { timeout: 60_000 }, async () => {
  await withBrowser(async (browser) => {
    const { page, bodies } = await openHarness(browser);
    const save = page.waitForRequest(`${origin}/api/account/preferences`, { timeout: 5_000 }).catch(() => null);
    await page.getByRole("button", { name: "Search Intune" }).click();
    assert.ok(await save, "the filter change was never saved");
    // Outlast another save delay, so a reload or a second save would have landed.
    await page.waitForTimeout(1_000);

    const reads = await page.evaluate(() => (window as Window & { accountReads?: string[] }).accountReads);
    assert.deepEqual(reads, ["user_preferences", "job_views", "saved_jobs"], "the filter change reloaded the account");
    const saves = bodies("/api/account/preferences");
    assert.equal(saves.length, 1);
    assert.equal(saves[0]?.q, "Intune");
  });
});

test("an opened job records one view through the views route", { timeout: 60_000 }, async () => {
  await withBrowser(async (browser) => {
    const { page, bodies } = await openHarness(browser);
    await page.waitForTimeout(500);
    assert.deepEqual(bodies("/api/account/views"), [{ jobId: "job-3" }]);
  });
});

async function withBrowser(run: (browser: Browser) => Promise<void>) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/google-chrome"
  });
  try {
    await run(browser);
  } finally {
    await browser.close();
  }
}

/** Loads the harness on a real origin, so the hooks' relative `/api/account/*` calls can be intercepted. */
async function openHarness(browser: Browser) {
  const page = await browser.newPage();
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  await page.route(`${origin}/api/account/**`, async (route) => {
    requests.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    await route.fulfill({ json: {} });
  });
  await page.route(`${origin}/board`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body><div id=\"root\"></div></body></html>" })
  );
  await page.goto(`${origin}/board`);
  await page.addScriptTag({ content: await harness });
  await page.getByText("1 saved, 1 viewed").waitFor();
  const bodies = (path: string) => requests.filter((request) => request.path === path).map(({ body }) => body);
  return { page, bodies };
}
