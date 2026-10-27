import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const menu = readFileSync(new URL("../../src/components/auth/auth-menu.tsx", import.meta.url), "utf8");
const buttons = readFileSync(new URL("../../src/components/auth/auth-provider-buttons.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/app/auth-menu.css", import.meta.url), "utf8");

test("the sign-in dialog is a centered site card with the short signed-out copy", () => {
  assert.match(menu, /Sign in to Endpoint Jobs/);
  assert.match(menu, /Save jobs, keep your filters, and hide what you've seen\./);
  assert.match(menu, /<AuthProviderButtons/);
  assert.match(buttons, /Continue with Google/);
  assert.match(buttons, /Continue with GitHub/);
  assert.match(menu, /By continuing you agree to the/);
  assert.match(menu, /href="\/privacy"/);
  assert.match(menu, /aria-label="Close"/);
  assert.match(buttons, /<GoogleMark \/>/);
  assert.match(buttons, /<GitHubMark \/>/);
  assert.match(buttons, /#4285F4/);
  assert.match(buttons, /startProviderSignIn/);
  assert.doesNotMatch(buttons, /signInWithOAuth/);
  assert.doesNotMatch(menu, /signInWithOAuth/);
  assert.match(
    readFileSync(new URL("../../src/lib/auth/start-provider-sign-in.ts", import.meta.url), "utf8"),
    /signInWithOAuth/
  );
  assert.match(menu, /closeDialogOnBackdrop/);
  assert.match(menu, /addEventListener\("click", closeDialogOnBackdrop\)/);
  assert.match(menu, /function trapTab/);
  assert.match(menu, /addEventListener\("keydown", trapTab\)/);
  assert.doesNotMatch(menu, /clientX/);
  assert.doesNotMatch(menu, /getBoundingClientRect/);
  const backdrop = readFileSync(new URL("../../src/components/auth/dialog-backdrop.ts", import.meta.url), "utf8");
  assert.match(backdrop, /event\.target !== event\.currentTarget/);
  assert.doesNotMatch(backdrop, /clientX/);
  assert.doesNotMatch(backdrop, /getBoundingClientRect/);
  assert.doesNotMatch(menu, /Sign in or create an account/);
  assert.doesNotMatch(menu, /never sees/);
  assert.doesNotMatch(menu, />\s*Close\s*</);

  assert.match(css, /\.auth-dialog\s*\{[^}]*margin:\s*auto/);
  assert.match(css, /width:\s*min\(400px,\s*calc\(100% - 32px\)\)/);
  assert.match(css, /backdrop-filter:\s*blur\(8px\)/);
  assert.match(css, /\.auth-provider\s*\{[^}]*min-height:\s*46px/);
  assert.match(css, /\.auth-dialog-close\s*\{[^}]*width:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /:focus:not\(:focus-visible\)/);
  assert.doesNotMatch(css, /\.auth-provider[^{]*\{[^}]*text-transform:\s*uppercase/);
});
