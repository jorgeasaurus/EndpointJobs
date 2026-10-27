import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { LandingSignIn } from "../../src/components/auth/landing-sign-in";
import { canShowSignInOffer } from "../../src/components/auth/sign-in-session";

const line = "Sign in to save jobs, filters, and viewed job history";

test("the home sign-in line is hidden unless auth is configured and the user is signed out", () => {
  const unconfigured = renderToStaticMarkup(createElement(LandingSignIn, {
    session: { configured: false, email: null },
    children: line
  }));
  const signedOut = renderToStaticMarkup(createElement(LandingSignIn, {
    session: { configured: true, email: null },
    children: line
  }));
  const signedIn = renderToStaticMarkup(createElement(LandingSignIn, {
    session: { configured: true, email: "a@example.com" },
    children: line
  }));

  assert.equal(unconfigured, "");
  assert.equal(signedIn, "");
  assert.match(signedOut, /<button/);
  assert.match(signedOut, new RegExp(line));
  assert.equal(canShowSignInOffer({ configured: false, email: null }), false);
  assert.equal(canShowSignInOffer({ configured: true, email: null }), true);
  assert.equal(canShowSignInOffer({ configured: true, email: "a@example.com" }), false);

  const menu = readFileSync(new URL("../../src/components/auth/auth-menu.tsx", import.meta.url), "utf8");
  const landing = readFileSync(new URL("../../src/components/auth/landing-sign-in.tsx", import.meta.url), "utf8");
  assert.match(menu, /canShowSignInOffer/);
  assert.match(landing, /canShowSignInOffer/);
});
