import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { AccountMenu } from "@/components/auth/account-menu";

import { signOutRedirectUrl } from "./sign-out-navigation";

test("sign-out navigation returns the browser to the same origin", () => {
  const destination = signOutRedirectUrl("https://endpointjobs.dev/auth/sign-out?next=https://evil.example");
  assert.equal(destination.href, "https://endpointjobs.dev/");
});

test("the account menu posts to the sign-out route so the document reloads", () => {
  const html = renderToStaticMarkup(createElement(AccountMenu, { email: "a@example.com" }));
  assert.match(html, /method="post"/);
  assert.match(html, /action="\/auth\/sign-out"/);
  assert.match(html, /Sign out/);
  assert.doesNotMatch(html, /action="\/"/);
});
