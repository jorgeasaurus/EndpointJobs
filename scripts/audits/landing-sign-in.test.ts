import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { LandingSignIn } from "../../src/components/auth/landing-sign-in";
import { canShowSignInOffer } from "../../src/components/auth/sign-in-session";

const phrase = ["Sign in to save", "jobs, filters, and viewed job history"].join(" ");

test("the home shows provider buttons only when signed out and auth is configured", () => {
  const unconfigured = renderToStaticMarkup(createElement(LandingSignIn, {
    session: { configured: false, email: null }
  }));
  const signedOut = renderToStaticMarkup(createElement(LandingSignIn, {
    session: { configured: true, email: null }
  }));
  const signedIn = renderToStaticMarkup(createElement(LandingSignIn, {
    session: { configured: true, email: "a@example.com" }
  }));

  assert.equal(unconfigured, "");
  assert.equal(signedIn, "");
  assert.match(signedOut, /Continue with Google/);
  assert.match(signedOut, /Continue with GitHub/);
  assert.match(signedOut, /#4285F4/);
  assert.match(signedOut, /class="auth-provider"/);
  assert.doesNotMatch(signedOut, /<h[1-6]/);
  assert.doesNotMatch(signedOut, /<a\b/);
  assert.doesNotMatch(signedOut, new RegExp(phrase));
  assert.equal(canShowSignInOffer({ configured: false, email: null }), false);
  assert.equal(canShowSignInOffer({ configured: true, email: null }), true);
  assert.equal(canShowSignInOffer({ configured: true, email: "a@example.com" }), false);

  const menu = readFileSync(new URL("../../src/components/auth/auth-menu.tsx", import.meta.url), "utf8");
  const landing = readFileSync(new URL("../../src/components/auth/landing-sign-in.tsx", import.meta.url), "utf8");
  const buttons = readFileSync(new URL("../../src/components/auth/auth-provider-buttons.tsx", import.meta.url), "utf8");
  assert.match(menu, /canShowSignInOffer/);
  assert.match(landing, /canShowSignInOffer/);
  assert.match(landing, /AuthProviderButtons/);
  assert.match(menu, /AuthProviderButtons/);
  assert.match(buttons, /role="alert"/);
  assert.doesNotMatch(landing, /openSignInDialog/);
});

test("the sign-in sentence is not in the app source", () => {
  const src = fileURLToPath(new URL("../../src", import.meta.url));
  const hits = filesUnder(src).filter((file) => readFileSync(file, "utf8").includes(phrase));
  assert.deepEqual(hits, []);
});

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else found.push(path);
  }
  return found;
}
