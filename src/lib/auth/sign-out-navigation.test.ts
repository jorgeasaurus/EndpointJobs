import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { AccountMenu } from "@/components/auth/account-menu";

import { signOutRedirectDecision, signOutRedirectUrl, signOutRequestAllowed } from "./sign-out-navigation";

test("sign-out navigation returns the browser to the same origin", () => {
  const destination = signOutRedirectUrl("https://endpointjobs.dev/auth/sign-out?next=https://evil.example");
  assert.equal(destination.href, "https://endpointjobs.dev/");
});

test("sign-out is limited to this browser and this site", () => {
  assert.equal(signOutRedirectDecision({ error: null, stillSignedIn: false }), "home");
  assert.equal(signOutRedirectDecision({ error: new Error("revoke failed"), stillSignedIn: false }), "home");
  assert.equal(signOutRedirectDecision({ error: new Error("revoke failed"), stillSignedIn: true }), "unavailable");

  const host = "endpointjobs.dev";
  assert.equal(signOutRequestAllowed(host, { origin: "https://endpointjobs.dev", site: "same-origin" }), true);
  assert.equal(signOutRequestAllowed(host, { origin: null, site: null }), true);
  assert.equal(signOutRequestAllowed(host, { origin: "https://evil.example", site: "cross-site" }), false);
  assert.equal(signOutRequestAllowed(host, { origin: "https://evil.example", site: null }), false);
  assert.equal(signOutRequestAllowed("localhost:3000", { origin: "https://endpointjobs.dev", site: "same-origin" }), false);

  const source = readFileSync(new URL("../../app/auth/sign-out/route.ts", import.meta.url), "utf8");
  assert.match(source, /signOut\(\{\s*scope:\s*"local"\s*\}\)/);
  assert.doesNotMatch(source, /signOut\(\s*\)/);
});

test("the account menu posts to the sign-out route so the document reloads", () => {
  const html = renderToStaticMarkup(createElement(AccountMenu, { email: "a@example.com" }));
  assert.match(html, /method="post"/);
  assert.match(html, /action="\/auth\/sign-out"/);
  assert.match(html, /Sign out/);
  assert.doesNotMatch(html, /action="\/"/);
});
