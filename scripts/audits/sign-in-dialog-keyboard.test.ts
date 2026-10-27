import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import * as esbuild from "esbuild";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

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

test("opening the sign-in dialog focuses Continue with Google after the provider remount", { timeout: 60_000 }, async () => {
  const result = await esbuild.build({
    absWorkingDir: fileURLToPath(new URL("../..", import.meta.url)),
    entryPoints: [fileURLToPath(new URL("./fixtures/sign-in-dialog-harness.tsx", import.meta.url))],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    plugins: [
      {
        name: "dialog-stubs",
        setup(build) {
          build.onResolve({ filter: /^next\/link$/ }, () => ({ path: "next-link", namespace: "dialog-stubs" }));
          build.onResolve({ filter: /sign-in-session$/ }, () => ({ path: "sign-in-session", namespace: "dialog-stubs" }));
          build.onLoad({ filter: /.*/, namespace: "dialog-stubs" }, (args) => ({
            loader: "js",
            resolveDir: fileURLToPath(new URL("../..", import.meta.url)),
            contents: args.path === "next-link"
              ? `import { createElement } from "react";
                export default function Link(props) {
                  return createElement("a", { href: props.href, onClick: props.onClick }, props.children);
                }`
              : `export function canShowSignInOffer(session) {
                  return Boolean(session.configured && session.email === null);
                }
                export function useSignInSession() {
                  return { configured: true, email: null };
                }`
          }));
        }
      },
      {
        name: "at-alias",
        setup(build) {
          build.onResolve({ filter: /^@\// }, (args) => {
            const base = resolve(fileURLToPath(new URL("../../src", import.meta.url)), args.path.slice(2));
            for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`]) {
              if (existsSync(candidate)) return { path: candidate };
            }
            return { path: base };
          });
        }
      }
    ]
  });
  const css = readFileSync(new URL("../../src/app/auth-menu.css", import.meta.url), "utf8");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/google-chrome"
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<!doctype html><html><head><style>:root{--lime:#bef264;--black:#000;--white:#fff;--white-60:#aaa;--danger:#fb7185;--glass:transparent;--glass-border:#333;--shadow:none;--glow-lime:none;--sans:system-ui,sans-serif;--mono:monospace}${css}</style></head><body><div id="root"></div></body></html>`);
    await page.addScriptTag({ content: result.outputFiles[0]?.text ?? "" });
    const signIn = page.getByRole("button", { name: "Sign in" });
    await signIn.waitFor();

    await signIn.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => {
      const active = document.activeElement;
      return active instanceof HTMLButtonElement
        && active.classList.contains("auth-provider")
        && active.textContent?.includes("Continue with Google")
        && !active.textContent.includes("GitHub");
    });
    await page.keyboard.press("Tab");
    assert.match(await page.evaluate(() => document.activeElement?.textContent ?? ""), /Continue with GitHub/);

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("dialog")?.open === false);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => {
      const active = document.activeElement;
      return active instanceof HTMLButtonElement
        && active.classList.contains("auth-provider")
        && active.textContent?.includes("Continue with Google")
        && !active.textContent.includes("GitHub");
    });
  } finally {
    await browser.close();
  }
});
