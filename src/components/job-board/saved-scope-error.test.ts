import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";

import { queryBoardPage } from "../../lib/board-page";
import { bundleHarness, nextLinkStub } from "../../../scripts/audits/harness-bundle";
import { makeJob } from "../../../scripts/audits/shared";
import { initialFilterState } from "./filter-model";

const title = "Visible public role";

test("a failed saved-jobs request keeps the last results and the Saved jobs only control", { timeout: 60_000 }, async () => {
  const pageData = queryBoardPage({
    updatedAt: "2026-10-27T00:00:00.000Z",
    source: { name: "Audit", url: "https://example.com/audit" },
    jobs: [
      makeJob({
        id: "visible-role",
        title,
        company: "Visible Co",
        sourceUrl: "https://example.com/visible-role",
        applyUrl: "https://example.com/visible-role/apply"
      })
    ]
  }, initialFilterState, 1, 20);
  const js = await bundleHarness(new URL("../../../scripts/audits/fixtures/saved-scope-error-harness.tsx", import.meta.url), {
    stubs: { "next/link": nextLinkStub }
  });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/google-chrome"
  });

  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><body><script type="application/json" id="board-page">${JSON.stringify(pageData).replaceAll("<", "\\u003c")}</script><div id="root"></div></body></html>`);
    await page.addScriptTag({ content: js });
    const control = page.getByRole("button", { name: "Saved jobs only" });
    await control.waitFor();
    await page.getByRole("heading", { name: title }).waitFor();

    await control.click();
    await page.getByRole("button", { name: "Try again" }).waitFor();

    const afterFailure = await page.evaluate((jobTitle) => {
      const button = document.querySelector(".saved-only-button");
      const heading = [...document.querySelectorAll("h2")].some((node) => node.textContent?.includes(jobTitle));
      return {
        heading,
        control: button instanceof HTMLButtonElement && !button.hidden,
        pressed: button?.getAttribute("aria-pressed") ?? "",
        alert: document.querySelector(".board-query-error")?.textContent ?? ""
      };
    }, title);
    assert.equal(afterFailure.heading, true, "the last job disappeared after the saved request failed");
    assert.equal(afterFailure.control, true, "Saved jobs only unmounted after the saved request failed");
    assert.equal(afterFailure.pressed, "true");
    assert.match(afterFailure.alert, /Try again/);

    await control.click();
    await page.waitForFunction(() => document.querySelector(".saved-only-button")?.getAttribute("aria-pressed") === "false");
    assert.equal(
      await page.evaluate((jobTitle) => [...document.querySelectorAll("h2")].some((node) => node.textContent?.includes(jobTitle)), title),
      true
    );
  } finally {
    await browser.close();
  }
});
