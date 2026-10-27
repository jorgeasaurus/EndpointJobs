import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import * as esbuild from "esbuild";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

import { signInStartError } from "../../src/lib/auth/start-provider-sign-in";

test("inline provider buttons keep focus and show a failed OAuth start", { timeout: 60_000 }, async () => {
  const result = await esbuild.build({
    absWorkingDir: fileURLToPath(new URL("../..", import.meta.url)),
    entryPoints: [fileURLToPath(new URL("./fixtures/provider-buttons-harness.tsx", import.meta.url))],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    plugins: [
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
  const css = `
    :root { --lime: #bef264; --black: #000; --white: #fff; --danger: #fb7185; --glow-lime: none; --sans: system-ui, sans-serif; }
    ${readFileSync(new URL("../../src/app/auth-menu.css", import.meta.url), "utf8")}
    ${readFileSync(new URL("../../src/app/landing.css", import.meta.url), "utf8")}
  `;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/google-chrome"
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div id="root"></div></body></html>`);
    await page.addScriptTag({ content: result.outputFiles[0]?.text ?? "" });
    const google = page.getByRole("button", { name: "Continue with Google" });
    const github = page.getByRole("button", { name: "Continue with GitHub" });
    await google.waitFor();
    await github.waitFor();
    assert.equal(await page.getByText("Sign in to save").count(), 0);
    assert.equal(await page.getByRole("heading").count(), 0);

    const layout = await page.locator(".landing-sign-in").evaluate((node) => getComputedStyle(node).display);
    assert.equal(layout, "flex");

    await google.focus();
    await page.keyboard.press("Enter");
    const alert = page.getByRole("alert");
    await alert.waitFor();
    assert.equal(await alert.innerText(), signInStartError);
    const focused = await page.evaluate(() => ({
      name: document.activeElement?.textContent?.trim() ?? "",
      outline: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : ""
    }));
    assert.match(focused.name, /Continue with Google/);
    assert.equal(focused.outline, "solid");

    await github.focus();
    await page.keyboard.press(" ");
    assert.equal(await alert.innerText(), signInStartError);
    assert.match(await page.evaluate(() => document.activeElement?.textContent ?? ""), /Continue with GitHub/);
  } finally {
    await browser.close();
  }
});
