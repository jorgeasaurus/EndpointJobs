import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as esbuild from "esbuild";
import { chromium, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

import { AccountMenu } from "../../src/components/auth/account-menu";

const email = "a-very-long-account-email-address-that-must-truncate@example.com";
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const srcRoot = fileURLToPath(new URL("../../src", import.meta.url));

test("the closed account menu truncates the email and posts sign-out", () => {
  const html = renderToStaticMarkup(createElement(AccountMenu, { email }));
  assert.match(html, new RegExp(`title="${email}"`));
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /method="post"/);
  assert.match(html, /action="\/auth\/sign-out"/);
  assert.match(html, /Sign out/);

  const css = readFileSync(new URL("../../src/app/auth-menu.css", import.meta.url), "utf8");
  assert.match(css, /\.auth-menu-email\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /\.auth-menu-email\s*\{[^}]*text-overflow:\s*ellipsis/);
  assert.match(css, /\.auth-menu-action\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.auth-menu-action\s*\{[^}]*min-width:\s*44px/);
  assert.doesNotMatch(css, /\.auth-menu-panel\s*\{[^}]*right:\s*0/);
});

test("the open account menu stays inside 390 and 1280 and dismisses", { timeout: 60_000 }, async () => {
  const js = await bundle(fileURLToPath(new URL("./fixtures/account-menu-harness.tsx", import.meta.url)));
  const css = `${variables}\n${readFileSync(new URL("../../src/app/auth-menu.css", import.meta.url), "utf8")}\n${harnessCss}`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/google-chrome"
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body data-email="${email}"><div id="root"></div></body></html>`);
    await page.addScriptTag({ content: js });
    const trigger = page.getByRole("button", { name: `Account menu for ${email}` });
    await trigger.waitFor();

    await trigger.click();
    await assertInside(page, 390);
    await assertDismiss(page, trigger);

    await page.setViewportSize({ width: 1280, height: 800 });
    await trigger.click();
    await assertInside(page, 1280);
    const anchored = await page.evaluate(() => {
      const triggerBox = document.querySelector(".auth-entry")?.getBoundingClientRect();
      const panelBox = document.querySelector(".auth-menu-panel")?.getBoundingClientRect();
      if (!triggerBox || !panelBox) return 99;
      return Math.abs(triggerBox.right - panelBox.right);
    });
    assert.ok(anchored <= 2, `panel right edge drifted ${anchored}px from the trigger`);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const panel = document.querySelector(".auth-menu-panel");
      if (!panel) return false;
      const box = panel.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      return box.left >= 8 && box.right <= width - 8 && box.width > 0;
    });
  } finally {
    await browser.close();
  }
});

async function assertInside(page: Page, viewportWidth: number) {
  const panel = page.locator(".auth-menu-panel");
  await panel.waitFor({ state: "visible" });
  const box = await panel.boundingBox();
  assert.ok(box, "account menu panel has no box");
  assert.ok(box.x >= 8, `left ${box.x} at ${viewportWidth}`);
  assert.ok(box.x + box.width <= viewportWidth - 8, `right ${box.x + box.width} at ${viewportWidth}`);
  assert.ok(box.y >= 8, `top ${box.y} at ${viewportWidth}`);

  const hit = await page.evaluate(() => {
    const node = document.querySelector(".auth-menu-panel");
    if (!node) return false;
    const rect = node.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + 4, rect.top + 4);
    return node === target || node.contains(target);
  });
  assert.equal(hit, true, `panel is clipped at ${viewportWidth}`);
  assert.equal(await panel.evaluate((node) => node.parentElement?.tagName), "BODY");

  const emailNode = panel.locator(".auth-menu-email");
  const truncation = await emailNode.evaluate((node) => ({
    title: node.getAttribute("title"),
    overflow: getComputedStyle(node).textOverflow,
    truncated: node.scrollWidth > node.clientWidth + 1
  }));
  assert.equal(truncation.title, email);
  assert.equal(truncation.overflow, "ellipsis");
  assert.equal(truncation.truncated, true);

  const signOut = await page.getByRole("button", { name: "Sign out" }).boundingBox();
  assert.ok(signOut, "sign out has no box");
  assert.ok(signOut.height >= 44, `sign out height ${signOut.height}`);
  assert.ok(signOut.width >= 44, `sign out width ${signOut.width}`);
}

async function assertDismiss(page: Page, trigger: ReturnType<Page["getByRole"]>) {
  const panel = page.locator(".auth-menu-panel");
  await page.getByRole("button", { name: "Sign out" }).focus();
  await page.keyboard.press("Escape");
  await panel.waitFor({ state: "hidden" });
  await page.waitForFunction((name) => document.activeElement?.getAttribute("aria-label") === name, `Account menu for ${email}`);

  await trigger.click();
  await panel.waitFor({ state: "visible" });
  await page.mouse.click(8, 800);
  await panel.waitFor({ state: "hidden" });
  await page.waitForFunction((name) => document.activeElement?.getAttribute("aria-label") === name, `Account menu for ${email}`);
}

async function bundle(entry: string) {
  const result = await esbuild.build({
    absWorkingDir: repoRoot,
    entryPoints: [entry],
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
          build.onResolve({ filter: /^@\// }, (args) => ({
            path: resolveAlias(args.path)
          }));
        }
      }
    ]
  });
  return result.outputFiles[0]?.text ?? "";
}

const variables = `
  :root {
    --black: #000;
    --white: #f3f4f6;
    --white-60: rgb(243 244 246 / 64%);
    --lime: #bef264;
    --glass: rgb(255 255 255 / 4%);
    --glass-border: rgb(255 255 255 / 11%);
    --danger: #fb7185;
    --shadow: 0 22px 70px rgb(0 0 0 / 44%);
    --glow-lime: 0 0 0 1px rgb(190 242 100 / 14%);
    --sans: system-ui, sans-serif;
    --mono: ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: #07090b; color: var(--white); overflow-x: hidden; }
  button { padding: 0; border: 0; background: transparent; font: inherit; }
`;

const harnessCss = `
  .site-frame { overflow-x: clip; padding: 8px; }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    padding: 0 8px;
    background: rgb(7 9 11 / 88%);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
  }
  .topbar-actions { display: flex; gap: 4px; margin-left: auto; }
  .brand { color: white; font-weight: 700; }
  .topbar .feedback-link {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    min-width: 44px;
    max-width: 44px;
    height: 44px;
    overflow: hidden;
    color: var(--lime);
  }
  h1 { margin: 24px 8px; font-size: 2rem; }
`;

function resolveAlias(specifier: string) {
  const base = resolve(srcRoot, specifier.slice(2));
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`]) {
    if (existsSync(candidate)) return candidate;
  }
  return base;
}
