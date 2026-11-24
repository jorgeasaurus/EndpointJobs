import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";

import { bundleHarness } from "../../../scripts/audits/harness-bundle";

const origin = "http://harness.test";
const signedInAccount = new URL("../../../scripts/audits/fixtures/stubs/signed-in-account.ts", import.meta.url);

test("a filter change saves the preferences once and does not reload the account", { timeout: 60_000 }, async () => {
  const js = await bundleHarness(new URL("../../../scripts/audits/fixtures/account-board-harness.tsx", import.meta.url), {
    stubs: {
      "@/components/auth/sign-in-session": signedInAccount,
      "@/lib/supabase/client": signedInAccount,
      "@/lib/supabase/env": signedInAccount
    }
  });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/google-chrome"
  });

  try {
    const page = await browser.newPage();
    const saves: unknown[] = [];
    await page.route(`${origin}/api/account/preferences`, async (route) => {
      saves.push(route.request().postDataJSON());
      await route.fulfill({ json: { saved: true } });
    });
    await page.route(`${origin}/board`, (route) =>
      route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body><div id=\"root\"></div></body></html>" })
    );
    await page.goto(`${origin}/board`);
    await page.addScriptTag({ content: js });
    await page.getByText("1 saved, 1 viewed").waitFor();

    const save = page.waitForRequest(`${origin}/api/account/preferences`, { timeout: 5_000 }).catch(() => null);
    await page.getByRole("button", { name: "Search Intune" }).click();
    assert.ok(await save, "the filter change was never saved");
    // Outlast another save delay, so a reload or a second save would have landed.
    await page.waitForTimeout(1_000);

    const reads = await page.evaluate(() => (window as Window & { accountReads?: string[] }).accountReads);
    assert.deepEqual(reads, ["user_preferences", "job_views", "saved_jobs"], "the filter change reloaded the account");
    assert.equal(saves.length, 1);
    assert.equal((saves[0] as Record<string, unknown>).q, "Intune");
  } finally {
    await browser.close();
  }
});
