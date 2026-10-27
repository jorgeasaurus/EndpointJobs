import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";

import { closeDialogOnBackdrop } from "../../src/components/auth/dialog-backdrop";

const errorCopy = "Sign-in could not start. Try again in a moment.";

test("keyboard activation of a provider keeps the dialog and its error open", async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/google-chrome"
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`<!doctype html>
      <style>
        dialog { width: 400px; margin: auto; padding: 24px; }
        button { display: block; min-height: 46px; }
      </style>
      <dialog id="sign-in">
        <button type="button" id="google">Continue with Google</button>
        <button type="button" id="github">Continue with GitHub</button>
        <p id="error" role="alert" hidden></p>
      </dialog>`);
    await page.evaluate((source) => {
      const closeDialogOnBackdrop = new Function(`return (${source});`)() as (event: MouseEvent) => void;
      const dialog = document.querySelector("dialog");
      const error = document.querySelector("#error");
      if (!dialog || !error) throw new Error("dialog fixture missing");
      dialog.addEventListener("click", closeDialogOnBackdrop);
      for (const id of ["google", "github"]) {
        document.getElementById(id)?.addEventListener("click", () => {
          error.textContent = "Sign-in could not start. Try again in a moment.";
          error.removeAttribute("hidden");
        });
      }
      dialog.showModal();
    }, closeDialogOnBackdrop.toString());

    for (const id of ["google", "github"]) {
      await page.locator(`#${id}`).focus();
      await page.keyboard.press(id === "google" ? "Enter" : " ");
      const state = await page.evaluate((buttonId) => {
        const dialog = document.querySelector("dialog");
        const error = document.querySelector("#error");
        const box = dialog?.getBoundingClientRect();
        return {
          open: dialog?.open ?? false,
          error: error?.textContent ?? "",
          visible: Boolean(error && error.getClientRects().length > 0),
          top: box?.top ?? 0
        };
      }, id);
      assert.equal(state.open, true, `${id} keyboard activation closed the dialog`);
      assert.equal(state.error, errorCopy);
      assert.equal(state.visible, true, "the OAuth error is not visible");
      assert.ok(state.top > 0, "the dialog is not clear of the 0,0 keyboard click");
    }

    await page.mouse.click(12, 12);
    const closed = await page.evaluate(() => {
      const dialog = document.querySelector("dialog");
      const error = document.querySelector("#error");
      return {
        open: dialog?.open ?? true,
        errorVisible: Boolean(error && error.getClientRects().length > 0)
      };
    });
    assert.equal(closed.open, false);
    assert.equal(closed.errorVisible, false);
  } finally {
    await browser.close();
  }
});
